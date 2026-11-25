import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

async function loadDemoModule(directory, name) {
  // Strip-only loading is supported by both Node 22 and Node 26.
  const source = stripTypeScriptTypes(await readFile(path.join(directory, name), 'utf8'), { mode: 'strip' });
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
export async function loadDialogue(directory = '/dialogue') {
  return (await loadDemoModule(directory, 'n8n-dialogue.ts')).ivrDialogue;
}
export async function loadGreetingReader(directory = '/dialogue') {
  return (await loadDemoModule(directory, 'greetings.ts')).readGreetingCsv;
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

export function createDialogueServer({ dialogue, readGreetingCsv, normalizeTranscript = text => text,
  correctAsrTranscript, defaultAsrModel, fetchImpl = fetch,
  saveCallLogs = false,
  audioUrl = process.env.SIP_DIALOGUE_AUDIO_URL || 'http://voice-ai:8081',
  llmUrl = process.env.SIP_DIALOGUE_LLM_URL || 'http://voice-ai:8082/v1',
  asrPostprocessUrl = process.env.SIP_DIALOGUE_ASR_POSTPROCESS_URL || 'http://voice-ai:8089/v1',
  workflowUrl = process.env.SIP_DIALOGUE_WORKFLOW_URL || 'http://127.0.0.1:5678/webhook/ivr-agent',
} = {}) {
  // SIP calls that started an IVR engine session (the selected call script).
  // The engine itself keeps the call state; this only remembers which calls use it.
  const engineCalls = new Map();
  const rememberCall = (sessionId, scenarioId) => {
    engineCalls.set(sessionId, {scenarioId, seen: Date.now()});
    for (const [id, call] of engineCalls) if (Date.now() - call.seen > 2 * 60 * 60 * 1000) engineCalls.delete(id);
  };
  const saveLog = async (sessionId, entries) => {
    const start = saveCallLogs && typeof sessionId === 'string' && /^sip-(\d{13})$/.exec(sessionId);
    if (!start) return;
    try {
      const response = await fetchImpl(`${audioUrl}/v1/ui/demo-call-log`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({session_id: sessionId, started_at_ms: Number(start[1]), entries}),
        signal: AbortSignal.timeout(1000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.warn('[sip-dialogue] Could not save call log:', error.message);
    }
  };
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET' && req.url === '/health') { res.setHeader('Content-Type', 'application/json'); res.end('{"status":"ok"}'); return; }
    if (req.method !== 'POST' || !['/dialogue', '/normalize', '/settings', '/tts-config'].includes(req.url)) { res.writeHead(404); res.end(); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('SIP dialogue timed out')), 300_000);
    let caller;
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    const send = item => { if (!res.destroyed) res.write(JSON.stringify(item) + '\n'); };
    try {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 256 * 1024) throw new Error('SIP dialogue request is too large'); }
      const body = JSON.parse(raw);
      if (req.url === '/normalize') {
        if (typeof body.text !== 'string') throw new Error('Invalid transcript');
        const context = typeof body.context === 'string' ? body.context : '';
        let text = normalizeTranscript(body.text, context);
        let postprocess;
        const transcript = text.trim();
        if (body.postprocess === true && correctAsrTranscript && transcript) {
          try {
            const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(2000)]);
            const response = await fetchImpl(`${audioUrl}/v1/ui/demo-settings`, {signal, cache:'no-store'});
            if (!response.ok) throw new Error(`Could not read saved demo settings (${response.status})`);
            const saved = (await response.json()).settings || {};
            if (saved.asr_postprocess_enabled !== false) {
              text = await correctAsrTranscript(transcript, saved.asr_postprocess_model || defaultAsrModel,
                context, llmUrl, controller.signal, {defaultBase:asrPostprocessUrl, limitInputLength:false});
              postprocess = 'completed';
            }
          } catch {
            postprocess = 'fallback';
          }
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({text, postprocess}));
        return;
      }
      if (req.url === '/settings' || req.url === '/tts-config') {
        const signal=controller.signal;
        const response=await fetchImpl(`${audioUrl}/v1/ui/demo-settings`,{signal,cache:'no-store'});
        if(!response.ok)throw new Error(`Could not read saved demo settings (${response.status})`);
        const saved=(await response.json()).settings||{};
        let model = body.model;
        const keypadGreeting = req.url === '/tts-config' && body.keypadGreeting === true;
        const welcomeGreeting = req.url === '/tts-config' && body.welcomeGreeting === true;
        const streaming = !keypadGreeting && saved.tts_streaming === true;
        let reference, greeting, awaitingLanguage;
        if (req.url === '/tts-config') {
          if (welcomeGreeting) {
            if (!readGreetingCsv) throw new Error('Greeting reader is unavailable');
            const response = await fetchImpl(`${audioUrl}/v1/ui/greetings`, { signal, cache: 'no-store' });
            if (!response.ok) throw new Error(`Could not read greetings.csv (${response.status})`);
            greeting = readGreetingCsv((await response.json()).content);
            // An empty saved scenario ID turns the call script off for SIP.
            if (dialogue && saved.llm_enabled !== false && saved.sip_scenario_id !== '' && typeof body.sessionId === 'string') {
              try {
                const scenarioId = saved.sip_scenario_id || undefined;
                const opening = await dialogue({sessionId: body.sessionId, start: true, scenarioId},
                  AbortSignal.any([signal, AbortSignal.timeout(10_000)]), {workflowUrl});
                rememberCall(body.sessionId, scenarioId);
                greeting = `${greeting.trim()}\n${opening.reply}`.trim();
                awaitingLanguage = opening.awaitingLanguage || undefined;
              } catch (error) {
                if (!signal.aborted) console.warn('[sip-dialogue] Call script opening unavailable:', error.message);
              }
            }
            const entries = [{role: 'Call', text: 'Started'}];
            if (greeting.trim()) entries.push({role: 'AI', text: greeting});
            await saveLog(body.sessionId, entries);
          }
          const selected = saved.tts_model_id && saved.tts_model_family && saved.tts_model_path;
          if (streaming && !selected) throw new Error('Save a streaming-capable TTS model in the demo settings first');
          if (selected) {
            const mode = streaming ? 'streaming' : 'offline';
            model = `demo-${saved.tts_model_id}${streaming ? "-streaming" : ""}`;
            const loaded = await fetchImpl(`${audioUrl}/v1/models/load`, {method:'POST', headers:{'Content-Type':'application/json'}, signal, body:JSON.stringify({id:model, family:saved.tts_model_family, path:saved.tts_model_path, task:saved.tts_model_task||'tts', mode, load_options:saved.tts_load_options||{}, session_options:saved.tts_session_options||{}})});
            if (!loaded.ok) throw new Error(`Could not load selected TTS (${loaded.status}): ${(await loaded.text()).slice(0,500)}`);
          }
          if (!keypadGreeting && saved.tts_voice_id && !saved.tts_voice_id.startsWith('preset-')) {
            const voices = await fetchImpl(`${audioUrl}/v1/ui/voices`, {signal, cache:'no-store'});
            if (!voices.ok) throw new Error(`Could not read saved voices (${voices.status})`);
            const voice = (await voices.json()).voices?.find(voice => voice.id === saved.tts_voice_id);
            if (!voice?.audio) throw new Error('Selected reference voice is unavailable');
            reference = {audio: voice.audio, text: saved.tts_reference_text || voice.transcript || ''};
          }
        }
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify({model, streaming, reference, greeting, awaitingLanguage, voice: !keypadGreeting && saved.tts_voice_id?.startsWith('preset-') ? (saved.tts_voice_id === 'preset-wangSG9s' ? 'WangSG' : 'lingCL') : undefined, vad_end_silence_ms:saved.vad_end_silence_ms??2000}));return;
      }
      if (typeof body.text !== 'string' || !body.text.trim() || typeof body.model !== 'string' || typeof body.prompt !== 'string' || !Array.isArray(body.messages) || body.messages.length > 12 || body.messages.some(m => !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) throw new Error('Invalid SIP dialogue request');
      caller = {sessionId: body.sessionId, role: 'Caller', text: body.text};
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
      const complete = async (prompt, history, maxTokens) => {
        const ready = await ensureModel(llmUrl, model, signal, fetchImpl);
        const completion = await fetchImpl(`${llmUrl}/chat/completions?autoload=true`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
          body: JSON.stringify({ model: ready, messages: [{ role: 'system', content: prompt }, ...history], max_tokens: maxTokens, temperature: 0.2, stream: false }),
        });
        if (!completion.ok) throw new Error(`LLM request failed (${completion.status})`);
        return (await completion.json()).choices?.[0]?.message?.content;
      };
      let reply, awaitingLanguage, engine;
      if (saved.llm_enabled === false) reply = body.text;
      else if (engineCalls.has(body.sessionId) || source === 'n8n') {
        // The IVR engine answers from the call script and keeps the call state.
        const call = engineCalls.get(body.sessionId);
        if (!dialogue) throw new Error('IVR dialogue client is unavailable');
        engine = await dialogue({sessionId: body.sessionId, text: body.text, scenarioId: call?.scenarioId}, signal, {
          workflowUrl,
          // The SIP pipeline speaks the first progress event of a turn.
          noticeDelaySeconds: saved.lookup_notice_delay_seconds,
          onNotice: text => send({type: 'progress', text}),
          onWorkflow: state => send({ type: 'event', event: `N8N_WORKFLOW_${state.toUpperCase()}`, summary: 'GeoVision · Workflow' }),
        });
        // Only calls that started a call script stay on it; a call that reached
        // the engine through the n8n source follows later source changes.
        if (call) rememberCall(body.sessionId, call.scenarioId);
        reply = engine.reply;
        awaitingLanguage = engine.awaitingLanguage;
        if (engine.work_order) send({type: 'event', event: 'WORK_ORDER_COMPLETED', summary: engine.work_order.order_id});
      } else reply = await complete(body.prompt, messages, 256);
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('Dialogue returned an empty reply');
      // Script replies are already written text; normalize only free LLM replies.
      if (!engine) reply = normalizeTranscript(reply.trim());
      await saveLog(caller.sessionId, [{role: caller.role, text: caller.text}, {role: 'AI', text: reply}]);
      send({ type: 'reply', reply, ...(awaitingLanguage ? {awaitingLanguage} : {}) });
      res.end();
    } catch (error) {
      if (caller) await saveLog(caller.sessionId, [{role: caller.role, text: caller.text}, {role: 'Call', text: 'Reply failed'}]);
      if (!res.destroyed) {
        if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.message })); }
        else { send({ type: 'error', message: error.message }); res.end(); }
      }
    } finally { clearTimeout(timer); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = process.env.SIP_DIALOGUE_SOURCE_DIR || '/dialogue';
  const [dialogue, readGreetingCsv, { normalizeTranscript, correctAsrTranscript, DEFAULT_ASR_POSTPROCESS_MODEL }] = await Promise.all([
    loadDialogue(directory),
    loadGreetingReader(directory),
    import(pathToFileURL(path.join(directory, 'transcript.mjs')).href),
  ]);
  createDialogueServer({ dialogue, readGreetingCsv, normalizeTranscript, correctAsrTranscript,
    defaultAsrModel: DEFAULT_ASR_POSTPROCESS_MODEL, saveCallLogs: true }).listen(Number(process.env.SIP_DIALOGUE_PORT || 8086), '0.0.0.0', () => console.log('[sip-dialogue] Ready on port 8086'));
}
