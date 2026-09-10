<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { chatText, endpointJson, endpointRouterModels, routerEndpoint, siblingWorkerEndpoint, type OpenAIModel } from '$lib/openai';

  let baseUrl = '';
  let model = '';
  let models: OpenAIModel[] = [];
  let systemPrompt = 'You are a helpful local assistant. Give concise, accurate answers.';
  let prompt = '';
  let temperature = 0.2;
  let maxTokens = 1024;
  let response = '';
  let status = 'The local language-model worker is starting.';
  let busy = false;
  let downloading = false;
  let downloadEvents: EventSource | null = null;
  let repo = 'bartowski/Qwen2.5-3B-Instruct-GGUF';
  let quant = 'Q4_K_M';
  let ggufFile = 'Qwen2.5-3B-Instruct-Q4_K_M.gguf';

  $: downloadUrl = `https://huggingface.co/${repo.trim() || '<owner/repository>'}/resolve/main/${encodeURIComponent(ggufFile.trim() || '<model.gguf>')}?download=true`;

  function save() {
    localStorage.setItem('audiocpp.llama.settings', JSON.stringify({
      model, systemPrompt, temperature, maxTokens, repo, quant, ggufFile
    }));
  }

  async function refreshModels() {
    busy = true;
    status = 'Checking the local llama.cpp worker…';
    try {
      models = await endpointRouterModels(baseUrl);
      if (!models.some((entry) => entry.id === model)) model = models[0]?.id || model;
      status = models.length ? `${models.length} local model${models.length === 1 ? '' : 's'} available.` : 'llama.cpp is online, but no model is loaded.';
      save();
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
    }
  }

  async function infer() {
    if (!model.trim() || !prompt.trim()) return;
    busy = true;
    response = '';
    status = 'Generating locally…';
    const controller = new AbortController();
    try {
      const messages = [];
      if (systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt.trim() });
      messages.push({ role: 'user', content: prompt.trim() });
      const result = await endpointJson<any>(baseUrl, 'chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: model.trim(), messages, temperature, max_tokens: maxTokens, stream: false })
      }, controller.signal);
      response = chatText(result);
      status = 'Inference complete.';
      save();
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
    }
  }

  function modelManagerUrl(path = 'models'): string {
    return routerEndpoint(baseUrl, path);
  }

  function downloadEvent(event: MessageEvent) {
    try {
      const payload = JSON.parse(event.data);
      const data = payload.data || payload;
      const files = payload.event === 'download_progress' && data && typeof data === 'object'
        ? Object.values(data) as Array<any>
        : [];
      const downloaded = files.length
        ? files.reduce((sum, item) => sum + Number(item?.done || 0), 0)
        : Number(data.downloaded_bytes ?? data.downloaded ?? 0);
      const total = files.length
        ? files.reduce((sum, item) => sum + Number(item?.total || 0), 0)
        : Number(data.total_bytes ?? data.total ?? 0);
      const percent = total > 0 ? ` ${Math.min(100, downloaded / total * 100).toFixed(1)}%` : '';
      status = String(data.message || data.status?.value || payload.event || 'Downloading model…') + percent;
      if (payload.event === 'download_finished' || payload.event === 'download_failed') {
        downloading = false;
        downloadEvents?.close();
        downloadEvents = null;
        if (payload.event === 'download_finished') void refreshModels();
      }
    } catch {
      if (event.data) status = String(event.data);
    }
  }

  async function downloadWithLlama() {
    const modelRef = `${repo.trim()}:${quant.trim()}`;
    if (!repo.trim() || !quant.trim()) return;
    downloading = true;
    status = `Starting ${modelRef} download…`;
    downloadEvents?.close();
    downloadEvents = new EventSource(modelManagerUrl('models/sse'));
    downloadEvents.onmessage = downloadEvent;
    downloadEvents.onerror = () => {
      downloading = false;
      downloadEvents?.close();
      downloadEvents = null;
      status = 'Download request sent; live progress is unavailable. Refresh models when it completes.';
    };
    for (const name of ['download_progress', 'model_download_progress']) {
      downloadEvents.addEventListener(name, downloadEvent as EventListener);
    }
    const finish = async (event: Event) => {
      if (event instanceof MessageEvent) downloadEvent(event);
      downloading = false;
      downloadEvents?.close();
      downloadEvents = null;
      await refreshModels();
    };
    downloadEvents.addEventListener('download_finished', finish);
    downloadEvents.addEventListener('download_failed', (event) => {
      if (event instanceof MessageEvent) downloadEvent(event);
      downloading = false;
      downloadEvents?.close();
      downloadEvents = null;
    });
    try {
      const result = await fetch(modelManagerUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelRef })
      });
      if (!result.ok) throw new Error(`${result.status} ${await result.text()}`);
      status = `llama.cpp is downloading ${modelRef} in the background…`;
      save();
    } catch (error) {
      downloading = false;
      downloadEvents?.close();
      downloadEvents = null;
      status = error instanceof Error ? `Download failed: ${error.message}` : String(error);
    }
  }

  onMount(() => {
    baseUrl = siblingWorkerEndpoint(8082);
    try {
      const saved = JSON.parse(localStorage.getItem('audiocpp.llama.settings') || '{}');
      model = saved.model || model;
      systemPrompt = saved.systemPrompt || systemPrompt;
      temperature = Number(saved.temperature ?? temperature);
      maxTokens = Number(saved.maxTokens ?? maxTokens);
      repo = saved.repo || repo;
      quant = saved.quant || quant;
      ggufFile = saved.ggufFile || ggufFile;
    } catch { /* use defaults */ }
    refreshModels();
  });

  onDestroy(() => downloadEvents?.close());
</script>

<section class="page-head llama-head">
  <p class="eyebrow">LOCAL LANGUAGE MODEL</p>
  <h1>llama.cpp</h1>
  <p>Download an instruct GGUF and run local chat inference through the container's built-in worker.</p>
</section>

<div class="llama-grid">
  <section class="panel page-panel">
    <div class="section-title"><div><span>01 · MODEL</span><h2>Download & load</h2></div></div>
    <div class="field-grid">
      <label>Hugging Face repository
        <input bind:value={repo} placeholder="owner/model-GGUF" on:change={save} />
      </label>
      <label>Quantization
        <input bind:value={quant} placeholder="Q4_K_M" on:change={save} />
      </label>
    </div>
    <label>GGUF filename
      <input bind:value={ggufFile} placeholder="model-Q4_K_M.gguf" on:change={save} />
    </label>
    <div class="download-row">
      <button class="primary" disabled={downloading || !repo.trim() || !quant.trim()} on:click={downloadWithLlama}>{downloading ? 'Downloading…' : 'Download in llama.cpp'}</button>
      <a class="button-link" href={downloadUrl} target="_blank" rel="noreferrer">Direct GGUF</a>
      <a class="button-link" href={`https://huggingface.co/${repo}/tree/main`} target="_blank" rel="noreferrer">Browse repository</a>
    </div>
    <p class="field-help">The model is downloaded into the persistent container volume and loaded by the internal llama.cpp worker.</p>
    <div class="connect-row">
      <label>Loaded model
        <select bind:value={model} on:change={save}>
          {#if !models.length && model}<option value={model}>{model}</option>{/if}
          {#each models as entry}<option value={entry.id}>{entry.id}</option>{/each}
        </select>
      </label>
      <button disabled={busy} on:click={refreshModels}>Refresh models</button>
    </div>
  </section>

  <section class="panel page-panel">
    <div class="section-title"><div><span>02 · INSTRUCT</span><h2>System prompt</h2></div></div>
    <label>System instructions
      <textarea bind:value={systemPrompt} rows="8" on:change={save}></textarea>
    </label>
    <div class="field-grid compact-fields">
      <label>Temperature<input type="number" min="0" max="2" step="0.05" bind:value={temperature} /></label>
      <label>Max tokens<input type="number" min="1" max="32768" step="1" bind:value={maxTokens} /></label>
    </div>
  </section>

  <section class="panel page-panel llama-chat">
    <div class="section-title"><div><span>03 · INFERENCE</span><h2>Chat</h2></div></div>
    <label>User message<textarea bind:value={prompt} rows="6" placeholder="Ask the local model…"></textarea></label>
    <div class="page-runbar">
      <button class="primary" disabled={busy || !model.trim() || !prompt.trim()} on:click={infer}>{busy ? 'Working…' : 'Generate'}</button>
      <span class:busy>{status}</span>
    </div>
    {#if response}<article class="llm-response"><span>ASSISTANT</span><p>{response}</p></article>{/if}
  </section>
</div>
