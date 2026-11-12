import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Load the shared browser/SIP transport for the n8n AI Agent webhook.
export async function loadDialogue(directory = '/dialogue') {
  // Strip-only loading is supported by both Node 22 and Node 26.
  const compile = async name => stripTypeScriptTypes(await readFile(path.join(directory, name), 'utf8'), { mode: 'strip' });
  const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  return (await import(url(await compile('n8n-dialogue.ts')))).n8nDialogue;
}

export async function ensureModel(base, model, signal, fetchImpl = fetch) {
  const root = base.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const deadline = Date.now() + 180_000;
  let requested = false;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const response = await fetchImpl(`${root}/models`, { signal });
    if (!response.ok) throw new Error(`LLM model discovery failed (${response.status})`);
    const data = await response.json();
    const entry = data.data?.find(entry => entry.id === model || entry.aliases?.includes(model));
    if (!entry) throw new Error(`Selected LLM is unavailable: ${model}`);
    const state = entry.status?.value;
    if (entry.loaded || ['loaded', 'sleeping'].includes(state)) return entry.id;
    if (['incomplete', 'downloading'].includes(state)) throw new Error(`Selected LLM download is ${state}: ${model}`);
    if (requested && entry.status?.failed) throw new Error(`Selected LLM failed to start: ${model}`);
    if (!requested && state !== 'loading') {
      const loaded = await fetchImpl(`${root}/models/load`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: entry.id }), signal });
      if (!loaded.ok) throw new Error(`Selected LLM could not be loaded (${loaded.status})`);
      requested = true;
    }
    await new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 500);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  throw new Error(`Selected LLM did not become ready: ${model}`);
}

export function createDialogueServer({ dialogue, normalizeTranscript = text => text, fetchImpl = fetch,
  audioUrl = process.env.SIP_DIALOGUE_AUDIO_URL || 'http://voice-ai:8081',
  llmUrl = process.env.SIP_DIALOGUE_LLM_URL || 'http://voice-ai:8082/v1',
  workflowUrl = process.env.SIP_DIALOGUE_WORKFLOW_URL || 'http://127.0.0.1:5678/webhook/ivr-agent',
} = {}) {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET' && req.url === '/health') { res.setHeader('Content-Type', 'application/json'); res.end('{"status":"ok"}'); return; }
    if (req.method !== 'POST' || !['/dialogue', '/normalize'].includes(req.url)) { res.writeHead(404); res.end(); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('SIP dialogue timed out')), 300_000);
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    const send = item => { if (!res.destroyed) res.write(JSON.stringify(item) + '\n'); };
    try {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 256 * 1024) throw new Error('SIP dialogue request is too large'); }
      const body = JSON.parse(raw);
      if (req.url === '/normalize') {
        if (typeof body.text !== 'string' || body.text.length > 20000) throw new Error('Invalid transcript');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({text: normalizeTranscript(body.text, typeof body.context === 'string' ? body.context : '')}));
        return;
      }
      if (typeof body.text !== 'string' || !body.text.trim() || typeof body.model !== 'string' || typeof body.prompt !== 'string' || !Array.isArray(body.messages) || body.messages.length > 12 || body.messages.some(m => !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) throw new Error('Invalid SIP dialogue request');
      const signal = controller.signal;
      const response = await fetchImpl(`${audioUrl}/v1/ui/demo-settings`, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not read saved demo settings (${response.status})`);
      const saved = (await response.json()).settings || {};
      const source = saved.dialogue_source || 'prompt.csv';
      if (!['n8n', 'prompt.csv'].includes(source)) throw new Error('Unsupported saved dialogue source');
      const model = saved.llm_model || body.model;
      res.setHeader('Content-Type', 'application/x-ndjson');
      send({ type: 'configuration', source, model });
      const messages = [...body.messages, { role: 'user', content: body.text }];
      let reply;
      if (saved.llm_enabled === false) reply = body.text;
      else {
        const ready = await ensureModel(llmUrl, model, signal, fetchImpl);
        if (source === 'n8n') {
          if (!dialogue) throw new Error('n8n dialogue handler is unavailable');
          reply = await dialogue({ sessionId: body.sessionId, text: body.text, model: ready, messages }, signal, {
            workflowUrl,
            onProgress: text => send({type: 'progress', text}),
            onWorkflow: state => send({ type: 'event', event: `N8N_WORKFLOW_${state.toUpperCase()}`, summary: 'GeoVision · Workflow' }),
            onTool: (name, state) => send({ type: 'event', event: `MCP_TOOL_${state.toUpperCase()}`, summary: name }),
          });
        } else {
          const completion = await fetchImpl(`${llmUrl}/chat/completions?autoload=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: ready, messages: [{ role: 'system', content: body.prompt }, ...messages], max_tokens: 256, temperature: 0.2, stream: false }), signal });
          if (!completion.ok) throw new Error(`LLM request failed (${completion.status})`);
          reply = (await completion.json()).choices?.[0]?.message?.content;
        }
      }
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('Dialogue returned an empty reply');
      send({ type: 'reply', reply: normalizeTranscript(reply.trim()) });
      res.end();
    } catch (error) {
      if (!res.destroyed) {
        if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
        else { send({ type: 'error', message: error.message }); res.end(); }
      }
    } finally { clearTimeout(timer); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dialogue = await loadDialogue(process.env.SIP_DIALOGUE_SOURCE_DIR || '/dialogue');
  const { normalizeTranscript } = await import(pathToFileURL(path.join(process.env.SIP_DIALOGUE_SOURCE_DIR || '/dialogue', 'transcript.mjs')).href);
  createDialogueServer({ dialogue, normalizeTranscript }).listen(Number(process.env.SIP_DIALOGUE_PORT || 8086), '0.0.0.0', () => console.log('[sip-dialogue] Ready on port 8086'));
}
