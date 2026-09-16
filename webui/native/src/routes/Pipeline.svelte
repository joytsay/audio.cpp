<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { uploadFile } from '$lib/api';
  import { browserDecodeToWav } from '$lib/audio';
  import { catalog } from '$lib/catalog';
  import MediaPreview from '$lib/MediaPreview.svelte';
  import { apiEndpoint, chatText, endpointBlob, endpointJson, endpointModels, endpointRouterModels, formatChatMessages, routerEndpoint, siblingWorkerEndpoint, type ChatMessage, type OpenAIModel } from '$lib/openai';
  import { graphCitations, graphContext, graphSearch, matchedExampleOutput } from '$lib/rag';
  import type { CatalogEntry, InstallPackageChoice, StringMap } from '$lib/types';
  import { createLocalId, deleteVoice as deleteSavedVoice, listVoices, saveVoice, type SavedVoice } from '$lib/voices';
  import bundledKnowledgeSystemPrompt from '../../../../knowledge/system-prompt.md?raw';
  import systemPromt from '../../../../prompt.csv?raw';

  type Stage = 'idle' | 'upload' | 'diarization' | 'stt' | 'rag' | 'llm' | 'tts' | 'done';
  type PromptMode = 'system' | 'graphrag';

  interface PipelineAudioModel extends OpenAIModel {
    selectionId: string;
    modelId: string;
    label: string;
    path?: string;
    mode?: string;
    loadOptions?: StringMap;
    sessionOptions?: StringMap;
    builtinVoices?: string[];
  }

  interface PackageInventory {
    state: 'idle' | 'running' | 'complete' | 'failed';
    data: Array<{ id: string; installed: boolean }>;
  }

  let audioBaseUrl = '';
  let llmBaseUrl = '';
  let models: PipelineAudioModel[] = [];
  let llmModels: OpenAIModel[] = [];
  let diarizationModel = '';
  let sttModel = '';
  let llmModel = '';
  let ttsModel = '';
  let voice = '';
  let voices: string[] = [];
  let language = '';
  let systemPrompt = systemPromt.trim();
  let promptMode: PromptMode = 'system';
  let useDiarization = true;
  let useRag = true;
  let useLlm = true;
  let useTts = true;
  let temperature = 0.2;
  let maxTokens = 512;
  let sourceFile: File | null = null;
  let inputUrl = '';
  let sourceInput: HTMLInputElement | null = null;
  let cloneVoiceInput: HTMLInputElement | null = null;
  let cloneVoiceFile: File | null = null;
  let cloneReferenceText = '';
  let cloneVoiceName = '';
  let savedCloneVoices: SavedVoice[] = [];
  let savedCloneVoiceId = '';
  let savingCloneVoice = false;
  let recorder: MediaRecorder | null = null;
  let recordingStream: MediaStream | null = null;
  let recording = false;
  let running = false;
  let stage: Stage = 'idle';
  let status = 'Choose or record a WAV file.';
  let diarizationText = '';
  let sttText = '';
  let ragText = '';
  let ragSources: string[] = [];
  let transcript = '';
  let llmResponse = '';
  let llmInputPreview = '';
  let diarization: any = null;
  let outputUrl = '';
  let aborter: AbortController | null = null;

  $: diarizationModels = models.filter((entry) => entry.task === 'diar');
  $: sttModels = models.filter((entry) => ['asr', 'stt'].includes(entry.task || ''));
  $: ttsModels = models.filter((entry) => ['tts', 'clon'].includes(entry.task || ''));
  $: selectedTtsModel = selectedAudioModel(ttsModel);
  // A model loaded from server configuration may only expose its ID in an
  // older cached model response. Recognize Qwen3-TTS by either source so the
  // clone controls are never hidden merely because that metadata is absent.
  $: selectedTtsIsQwen = selectedTtsModel?.family === 'qwen3_tts' ||
    /^qwen3-tts(?:-|$)/i.test(selectedTtsModel?.modelId || '');
  $: supportsVoiceClone = selectedTtsModel?.task === 'clon' ||
    (selectedTtsIsQwen && !/custom/i.test(selectedTtsModel?.modelId || ''));
  $: pipelineSteps = [
    ...(useDiarization ? [['diarization', 'Diarization']] : []),
    ['stt', 'Speech to text'],
    ...(promptMode === 'graphrag' && useRag ? [['rag', 'RAG']] : []),
    ...(useLlm ? [['llm', 'Language model']] : []),
    ...(useTts ? [['tts', 'Text to speech']] : [])
  ];
  $: canRun = Boolean(sourceFile && sttModel &&
    (!useDiarization || diarizationModel) &&
    (!useLlm || llmModel) &&
    (!useTts || ttsModel));

  function save() {
    localStorage.setItem('audiocpp.pipeline.settings', JSON.stringify({
      diarizationModel, sttModel, llmModel, ttsModel,
      voice, language, promptMode, useDiarization, useRag, useLlm, useTts, temperature, maxTokens
    }));
  }

  function saveSystemPromptCsv() {
    localStorage.setItem('audiocpp.pipeline.systemPrompt', systemPrompt);
    const url = URL.createObjectURL(new Blob([systemPrompt], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'prompt.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    status = 'System prompt saved and prompt.csv downloaded.';
  }

  function resolvedModelPath(path: string, modelsRoot: string): string {
    const normalized = path.replace(/\\/g, '/');
    if (!modelsRoot || !normalized.startsWith('models/')) return path;
    return `${modelsRoot.replace(/[\\/]+$/, '')}/${normalized.slice('models/'.length)}`;
  }

  function installedAudioModels(
    inventory: PackageInventory,
    modelsRoot: string
  ): PipelineAudioModel[] {
    const installed = new Set(inventory.data.filter((item) => item.installed).map((item) => item.id));
    return catalog.flatMap((entry: CatalogEntry) => {
      if (!['diar', 'asr', 'stt', 'tts', 'clon'].includes(entry.task)) return [];
      const choices = (entry.install_packages || []).filter((choice) => installed.has(choice.id));
      return choices.map((choice: InstallPackageChoice) => ({
        selectionId: `package:${entry.id}:${choice.id}`,
        modelId: entry.id,
        id: entry.id,
        label: `${entry.display_name} · ${choice.label}`,
        family: entry.family,
        task: entry.task,
        mode: entry.mode || 'offline',
        path: resolvedModelPath(choice.path, modelsRoot),
        loadOptions: entry.load_options,
        sessionOptions: { ...(entry.session_options || {}), ...(choice.session_options || {}) },
        builtinVoices: entry.builtin_voices
      }));
    });
  }

  function configuredAudioModel(entry: OpenAIModel & { path?: string; mode?: string }): PipelineAudioModel {
    return {
      ...entry,
      selectionId: `configured:${entry.id}`,
      modelId: entry.id,
      label: entry.id,
      path: entry.path,
      mode: entry.mode || 'offline'
    };
  }

  function keepSelection(options: PipelineAudioModel[], current: string): string {
    return options.find((entry) => entry.selectionId === current)?.selectionId ||
      options.find((entry) => entry.modelId === current)?.selectionId ||
      options[0]?.selectionId || '';
  }

  function selectedAudioModel(selectionId: string): PipelineAudioModel | undefined {
    return models.find((entry) => entry.selectionId === selectionId);
  }

  async function ensureAudioModel(selectionId: string, signal: AbortSignal): Promise<PipelineAudioModel> {
    const selected = selectedAudioModel(selectionId);
    if (!selected) throw new Error('The selected audio model is no longer available. Refresh the model list.');
    if (selected.selectionId.startsWith('package:') && selected.path && selected.family && selected.task) {
      await endpointJson(audioBaseUrl, 'models/load', {
        method: 'POST',
        body: JSON.stringify({
          id: selected.modelId,
          path: selected.path,
          family: selected.family,
          task: selected.task,
          mode: selected.mode || 'offline',
          load_options: selected.loadOptions || {},
          session_options: selected.sessionOptions || {}
        })
      }, signal);
    }
    return selected;
  }

  async function refreshAudioModels() {
    const configured = (await endpointModels(audioBaseUrl)) as Array<OpenAIModel & { path?: string; mode?: string }>;
    let installed: PipelineAudioModel[] = [];
    try {
      const [inventory, root] = await Promise.all([
        endpointJson<PackageInventory>(audioBaseUrl, 'ui/models/package-sizes'),
        endpointJson<{ models_root: string }>(audioBaseUrl, 'ui/models-root')
      ]);
      installed = installedAudioModels(inventory, root.models_root);
    } catch { /* configured-only servers do not expose package management */ }
    const installedPaths = new Set(installed.map((entry) => `${entry.modelId}\n${entry.path || ''}`));
    models = [
      ...installed,
      ...configured.map(configuredAudioModel).filter((entry) =>
        !installedPaths.has(`${entry.modelId}\n${entry.path || ''}`))
    ];
    const nextDiarization = models.filter((entry) => entry.task === 'diar');
    const nextStt = models.filter((entry) => ['asr', 'stt'].includes(entry.task || ''));
    const nextTts = models.filter((entry) => ['tts', 'clon'].includes(entry.task || ''));
    diarizationModel = keepSelection(nextDiarization, diarizationModel);
    sttModel = keepSelection(nextStt, sttModel);
    ttsModel = keepSelection(nextTts, ttsModel);
    await refreshVoices();
    save();
  }

  async function refreshLlmModels() {
    llmModels = await endpointRouterModels(llmBaseUrl);
    if (!llmModels.some((entry) => entry.id === llmModel)) llmModel = llmModels[0]?.id || llmModel;
    save();
  }

  async function refreshAll() {
    running = true;
    status = 'Discovering local models…';
    const results = await Promise.allSettled([refreshAudioModels(), refreshLlmModels()]);
    const failures = results.filter((entry) => entry.status === 'rejected') as PromiseRejectedResult[];
    status = failures.length ? failures.map((entry) => entry.reason?.message || String(entry.reason)).join(' · ') : 'Local model services are ready.';
    running = false;
  }

  async function refreshVoices() {
    if (!ttsModel) { voices = []; return; }
    const selected = selectedAudioModel(ttsModel);
    try {
      const result = await endpointJson<{ voices?: string[] }>(audioBaseUrl, `audio/voices?model=${encodeURIComponent(selected?.modelId || ttsModel)}`);
      voices = result.voices || selected?.builtinVoices || [];
      if (!voices.includes(voice)) voice = voices[0] || '';
    } catch { voices = selected?.builtinVoices || []; }
  }

  async function currentKnowledgeSystemPrompt(signal?: AbortSignal): Promise<string> {
    try {
      const response = await endpointJson<{ files?: Array<{ path: string; content: string }> }>(audioBaseUrl, 'ui/knowledge', {}, signal);
      return response.files?.find((file) => file.path === 'system-prompt.md')?.content || bundledKnowledgeSystemPrompt;
    } catch {
      return bundledKnowledgeSystemPrompt;
    }
  }

  async function refreshSavedCloneVoices() {
    try {
      savedCloneVoices = await listVoices();
    } catch (error) {
      status = `Voice library unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  function chooseCloneVoice(file: File | null) {
    const changed = Boolean(file && cloneVoiceFile && cloneVoiceFile.name !== file.name);
    cloneVoiceFile = file;
    savedCloneVoiceId = '';
    if (file) {
      voice = '';
      cloneVoiceName = file.name.replace(/\.[^.]+$/, '');
      if (changed) cloneReferenceText = '';
    }
  }

  function chooseSavedCloneVoice(id: string) {
    savedCloneVoiceId = id;
    const saved = savedCloneVoices.find((entry) => entry.id === id);
    if (!saved) return;
    voice = '';
    cloneVoiceFile = new File([saved.audio], `${saved.name}.wav`, { type: 'audio/wav' });
    cloneReferenceText = saved.transcript;
    cloneVoiceName = saved.name;
    if (cloneVoiceInput) cloneVoiceInput.value = '';
    status = `Selected saved voice “${saved.name}”.`;
  }

  function clearCloneVoice() {
    cloneVoiceFile = null;
    cloneReferenceText = '';
    cloneVoiceName = '';
    savedCloneVoiceId = '';
    if (cloneVoiceInput) cloneVoiceInput.value = '';
  }

  async function storeCloneVoice() {
    if (!cloneVoiceFile || savingCloneVoice) return;
    savingCloneVoice = true;
    try {
      const name = cloneVoiceName.trim() || cloneVoiceFile.name.replace(/\.[^.]+$/, '') || 'Saved voice';
      status = `Saving voice “${name}”…`;
      const audio = await browserDecodeToWav(cloneVoiceFile);
      const id = createLocalId();
      await saveVoice({ id, name, transcript: cloneReferenceText.trim(), audio, createdAt: Date.now() });
      await refreshSavedCloneVoices();
      savedCloneVoiceId = id;
      cloneVoiceName = name;
      status = `Saved voice “${name}” in this browser.`;
    } catch (error) {
      status = `Could not save voice: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      savingCloneVoice = false;
    }
  }

  async function removeCloneVoice() {
    if (!savedCloneVoiceId) return;
    const saved = savedCloneVoices.find((entry) => entry.id === savedCloneVoiceId);
    try {
      await deleteSavedVoice(savedCloneVoiceId);
      clearCloneVoice();
      await refreshSavedCloneVoices();
      status = `Deleted saved voice “${saved?.name || ''}”.`;
    } catch (error) {
      status = `Could not delete voice: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  function chooseFile(file: File | null) {
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    sourceFile = file;
    inputUrl = file ? URL.createObjectURL(file) : '';
    status = file ? `${file.name} is ready.` : 'Choose or record a WAV file.';
  }

  async function toggleRecording() {
    if (recording && recorder) { recorder.stop(); return; }
    try {
      recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      recorder = new MediaRecorder(recordingStream);
      recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
      recorder.onstop = async () => {
        recording = false;
        recordingStream?.getTracks().forEach((track) => track.stop());
        const recorded = new File(chunks, 'microphone-recording.webm', { type: recorder?.mimeType || 'audio/webm' });
        try {
          const wav = await browserDecodeToWav(recorded, 16000, 1);
          chooseFile(new File([wav], 'microphone-recording.wav', { type: 'audio/wav' }));
        } catch (error) {
          status = error instanceof Error ? error.message : String(error);
        }
      };
      recorder.start();
      recording = true;
      status = 'Recording microphone…';
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
  }

  async function uploadAudio(file: File, signal: AbortSignal): Promise<string> {
    const wav = await browserDecodeToWav(file, 16000, 1);
    const response = await fetch(apiEndpoint(audioBaseUrl, 'ui/upload'), {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav', 'X-AudioCPP-Filename': 'pipeline-input.wav' },
      body: wav,
      signal
    });
    if (!response.ok) throw new Error(`Audio upload failed: ${response.status} ${await response.text()}`);
    return (await response.json()).path;
  }

  function step(next: Stage, message: string) {
    stage = next;
    status = message;
  }

  function formatDiarization(result: any): string {
    const turns = Array.isArray(result?.speaker_turns) ? result.speaker_turns : [];
    if (!turns.length) return JSON.stringify(result, null, 2) || 'No speaker turns detected.';
    const sampleRate = Number(result.sample_rate) || 16000;
    return turns.map((turn: any) => {
      const start = Number(turn.start_sample || 0) / sampleRate;
      const end = Number(turn.end_sample || 0) / sampleRate;
      return `Speaker ${turn.speaker_id ?? 'unknown'}: ${start.toFixed(1)}–${end.toFixed(1)}s`;
    }).join('\n');
  }

  async function runPipeline() {
    if (!sourceFile || !canRun) return;
    aborter?.abort();
    aborter = new AbortController();
    running = true;
    diarizationText = '';
    sttText = '';
    ragText = '';
    ragSources = [];
    transcript = '';
    llmResponse = '';
    llmInputPreview = '';
    diarization = null;
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = '';
    try {
      step('upload', 'Preparing 16 kHz WAV input…');
      const audioPath = await uploadAudio(sourceFile, aborter.signal);

      if (useDiarization) {
        step('diarization', 'Separating speaker turns…');
        const diarModel = await ensureAudioModel(diarizationModel, aborter.signal);
        diarization = await endpointJson<any>(audioBaseUrl, 'tasks/run', {
          method: 'POST',
          body: JSON.stringify({ model: diarModel.modelId, audio: audioPath })
        }, aborter.signal);
        diarizationText = formatDiarization(diarization);
      }

      step('stt', 'Transcribing speech…');
      const speechModel = await ensureAudioModel(sttModel, aborter.signal);
      const stt = await endpointJson<any>(audioBaseUrl, 'audio/transcriptions/details', {
        method: 'POST',
        body: JSON.stringify({ model: speechModel.modelId, audio: audioPath, language })
      }, aborter.signal);
      const plainTranscript = typeof stt.text === 'string' ? stt.text.trim() : '';
      sttText = plainTranscript;
      // Graph retrieval and normalization must receive exactly the STT text.
      // Speaker labels and word-joining added by diarization weaken matching
      // against complete examples and terminology entries.
      transcript = plainTranscript;
      if (!transcript) throw new Error('STT returned an empty transcript.');

      let llmSystemPrompt = systemPrompt.trim();
      let exampleOutput = '';
      if (promptMode === 'graphrag' && useRag) {
        step('rag', 'Retrieving semiconductor knowledge…');
        const ragResult = await graphSearch(audioBaseUrl, transcript, 'local', 5, aborter.signal);
        ragText = graphContext(ragResult);
        ragSources = graphCitations(ragResult);
        if (!ragText) throw new Error('RAG returned no relevant knowledge.');
        exampleOutput = matchedExampleOutput(ragResult, transcript);
        const knowledgeSystemPrompt = await currentKnowledgeSystemPrompt(aborter.signal);
        llmSystemPrompt = `${knowledgeSystemPrompt.trim()}\n\n# 檢索知識\n\n以下內容是本次正規化的權威參考資料。必須套用明確命中的「左側詞 => 右側詞」。若最高相關結果是與使用者相同話語的完整「輸入／輸出」範例，即使 STT 含有重複、標點、語助詞、漏字或近音誤字，也必須只輸出該範例的「輸出：」內容。不要輸出來源、分數、解釋或範例說明。\n\n${ragText}`;
      }

      const messages: ChatMessage[] = [];
      if (llmSystemPrompt) messages.push({ role: 'system', content: llmSystemPrompt });
      messages.push({ role: 'user', content: transcript });
      llmInputPreview = formatChatMessages(messages);
      if (useLlm) {
        step('llm', 'Generating an instruct-model response…');
        const llm = await endpointJson<any>(llmBaseUrl, 'chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: llmModel, messages, temperature, max_tokens: maxTokens, stream: false }),
          signal: aborter.signal
        }, aborter.signal);
        llmResponse = exampleOutput || chatText(llm);

        // Jetson uses unified memory. Release the LLM worker before the TTS
        // worker creates its CUDA/cuBLAS context for this sequential pipeline.
        try {
          await fetch(routerEndpoint(llmBaseUrl, 'models/unload'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: llmModel }),
            signal: aborter.signal
          });
        } catch { /* TTS can still proceed if this llama.cpp version cannot unload */ }
      } else {
        // Preserve the exact STT result for an STT -> TTS pipeline.
        llmResponse = transcript;
      }

      if (useTts) {
        step('tts', 'Synthesizing the response…');
        const voiceModel = await ensureAudioModel(ttsModel, aborter.signal);
        const speechBody: Record<string, unknown> = { model: voiceModel.modelId, input: llmResponse, response_format: 'wav' };
        if (cloneVoiceFile && supportsVoiceClone) {
          if (voiceModel.family === 'qwen3_tts' && !cloneReferenceText.trim()) {
            throw new Error('Qwen3-TTS voice cloning requires the matching reference transcript.');
          }
          speechBody.voice_ref = await uploadFile(cloneVoiceFile, aborter.signal);
          if (cloneReferenceText.trim()) speechBody.reference_text = cloneReferenceText.trim();
        } else if (voice) {
          speechBody.voice = voice;
        }
        const output = await endpointBlob(audioBaseUrl, 'audio/speech', speechBody, aborter.signal);
        outputUrl = URL.createObjectURL(output);
      }
      step('done', 'Pipeline complete.');
      save();
    } catch (error) {
      stage = 'idle';
      status = error instanceof Error && error.name === 'AbortError' ? 'Pipeline stopped.' : error instanceof Error ? error.message : String(error);
    } finally {
      running = false;
    }
  }

  onMount(() => {
    audioBaseUrl = new URL('v1/', document.baseURI).toString().replace(/\/$/, '');
    llmBaseUrl = siblingWorkerEndpoint(8082);
    try {
      const saved = JSON.parse(localStorage.getItem('audiocpp.pipeline.settings') || '{}');
      diarizationModel = saved.diarizationModel || '';
      sttModel = saved.sttModel || '';
      llmModel = saved.llmModel || '';
      ttsModel = saved.ttsModel || '';
      voice = saved.voice || '';
      language = saved.language || '';
      systemPrompt = localStorage.getItem('audiocpp.pipeline.systemPrompt') || systemPrompt;
      promptMode = saved.promptMode === 'graphrag' ? 'graphrag' : 'system';
      useDiarization = saved.useDiarization ?? useDiarization;
      useRag = saved.useRag ?? useRag;
      useLlm = saved.useLlm ?? useLlm;
      useTts = saved.useTts ?? useTts;
      temperature = Number(saved.temperature ?? temperature);
      maxTokens = Number(saved.maxTokens ?? maxTokens);
    } catch { /* use defaults */ }
    refreshAll();
    refreshSavedCloneVoices();
  });

  onDestroy(() => {
    aborter?.abort();
    if (recorder?.state === 'recording') recorder.stop();
    recordingStream?.getTracks().forEach((track) => track.stop());
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
  });
</script>

<section class="page-head pipeline-head">
  <p class="eyebrow">VOICE AGENT PIPELINE</p>
  <h1>Diar → STT → RAG → LLM → TTS</h1>
  <p>A Python-free voice round trip using audio.cpp, llama.cpp, and this Svelte interface.</p>
</section>

<section class="pipeline-steps" aria-label="Pipeline progress">
  {#each pipelineSteps as item, index}
    <div class:active={stage === item[0]} class:complete={stage === 'done' || pipelineSteps.findIndex((entry) => entry[0] === stage) > index}>
      <span>{index + 1}</span><strong>{item[1]}</strong>
    </div>
  {/each}
</section>

<div class="pipeline-grid">
  <section class="panel page-panel pipeline-config">
    <div class="section-title"><div><span>WORKERS</span><h2>Local pipeline</h2></div><button disabled={running} on:click={refreshAll}>Refresh</button></div>
    <p class="field-help">The WebUI securely uses the audio and language-model workers inside this container.</p>
    <label class="toggle pipeline-toggle"><input type="checkbox" bind:checked={useDiarization} on:change={save} /><span></span>Run speaker diarization</label>
    {#if useDiarization}
      <label>Diarization model<select bind:value={diarizationModel} on:change={save}>{#each diarizationModels as entry}<option value={entry.selectionId}>{entry.label}</option>{/each}</select></label>
    {/if}
    <label>STT model<select bind:value={sttModel} on:change={save}>{#each sttModels as entry}<option value={entry.selectionId}>{entry.label}</option>{/each}</select></label>
    <label>STT language<input bind:value={language} placeholder="auto" on:change={save} /></label>
    <label class="toggle pipeline-toggle"><input type="checkbox" bind:checked={useLlm} on:change={save} /><span></span>Run LLM instruct model</label>
    {#if useLlm}
      <label>LLM instruct model<select bind:value={llmModel} on:change={save}>{#if !llmModels.length && llmModel}<option value={llmModel}>{llmModel}</option>{/if}{#each llmModels as entry}<option value={entry.id}>{entry.id}</option>{/each}</select></label>
    {/if}
    <label class="toggle pipeline-toggle"><input type="checkbox" bind:checked={useTts} on:change={save} /><span></span>Run text to speech</label>
    {#if useTts}
      <label>TTS model<select bind:value={ttsModel} on:change={() => { refreshVoices(); save(); }}>{#each ttsModels as entry}<option value={entry.selectionId}>{entry.label}</option>{/each}</select></label>
      <div class="field-grid">
        <label>Voice<select bind:value={voice} on:change={() => { if (voice) clearCloneVoice(); save(); }}><option value="">Model default</option>{#each voices as item}<option value={item}>{item}</option>{/each}</select></label>
      </div>
    {/if}
    {#if useTts && supportsVoiceClone}
      <div class="pipeline-clone-voice">
        <div class="section-title"><div><span>VOICE CLONE</span><h2>Reference voice</h2></div></div>
        <input class="hidden-file" bind:this={cloneVoiceInput} type="file" accept="audio/*" on:change={(event) => chooseCloneVoice(event.currentTarget.files?.[0] || null)} />
        <div class="media-actions">
          <button type="button" on:click={() => cloneVoiceInput?.click()}>Choose reference audio</button>
          <button type="button" disabled={!cloneVoiceFile} on:click={clearCloneVoice}>Clear</button>
          {#if cloneVoiceFile}<span>{cloneVoiceFile.name}</span>{/if}
        </div>
        <MediaPreview file={cloneVoiceFile} kind="audio" label="Reference preview" />
        <label>Reference transcript<textarea rows="2" bind:value={cloneReferenceText} placeholder="Exact words spoken in the reference audio"></textarea></label>
        <div class="voice-library pipeline-voice-library">
          <label>Saved voices<select value={savedCloneVoiceId} on:change={(event) => chooseSavedCloneVoice(event.currentTarget.value)}><option value="">Choose saved voice…</option>{#each savedCloneVoices as item}<option value={item.id}>{item.name}</option>{/each}</select></label>
          <label>Voice name<input bind:value={cloneVoiceName} placeholder="Reference voice name" /></label>
          <div class="library-actions">
            <button type="button" disabled={!cloneVoiceFile || savingCloneVoice} on:click={storeCloneVoice}>{savingCloneVoice ? 'Saving…' : 'Save voice'}</button>
            <button class="danger" type="button" disabled={!savedCloneVoiceId} on:click={removeCloneVoice}>Delete</button>
          </div>
        </div>
      </div>
    {/if}
  </section>

  <section class="panel page-panel pipeline-input">
    <div class="section-title"><div><span>INPUT</span><h2>Audio & instructions</h2></div></div>
    <input class="hidden-file" bind:this={sourceInput} type="file" accept="audio/*" on:change={(event) => chooseFile(event.currentTarget.files?.[0] || null)} />
    <div class="audio-drop">
      <strong>{sourceFile?.name || 'No audio selected'}</strong>
      <span>WAV, MP3, FLAC, or browser recording</span>
      <div><button on:click={() => sourceInput?.click()}>Choose audio</button><button class:danger={recording} on:click={toggleRecording}>{recording ? 'Stop recording' : 'Record microphone'}</button></div>
      {#if inputUrl}<audio class="pipeline-input-audio" controls src={inputUrl}></audio>{/if}
    </div>
    <label>LLM grounding<select bind:value={promptMode} on:change={save}><option value="system">System prompt (prompt.csv)</option><option value="graphrag">RAG (knowledge/)</option></select></label>
    <label class="toggle pipeline-toggle"><input type="checkbox" bind:checked={useRag} disabled={promptMode !== 'graphrag'} on:change={save} /><span></span>Run RAG retrieval</label>
    {#if promptMode === 'system' || !useRag}
      <label>System prompt (prompt.csv)<textarea bind:value={systemPrompt} rows="6"></textarea></label>
      <div class="prompt-actions"><button on:click={saveSystemPromptCsv}>Save CSV</button></div>
    {:else}
      <p class="field-help">The STT transcript retrieves related terms and rules from the local knowledge graph before the LLM runs.</p>
    {/if}
    <div class="field-grid compact-fields">
      <label>Temperature<input type="number" min="0" max="2" step="0.05" bind:value={temperature} /></label>
      <label>Max tokens<input type="number" min="1" max="32768" bind:value={maxTokens} /></label>
    </div>
    <div class="page-runbar">
      <button class="primary" disabled={running || !canRun} on:click={runPipeline}>{running ? 'Running…' : 'Run full pipeline'}</button>
      {#if running}<button on:click={() => aborter?.abort()}>Stop</button>{/if}
      <span class:busy={running}>{status}</span>
    </div>
  </section>

  <section class="panel page-panel pipeline-results">
    <div class="section-title"><div><span>RESULTS</span><h2>Stage outputs</h2></div></div>
    {#if diarizationText}<article class="pipeline-message diarization"><span>DIARIZATION</span><p>{diarizationText}</p></article>{/if}
    {#if sttText}<article class="pipeline-message user"><span>STT</span><p>{sttText}</p></article>{/if}
    {#if ragText}
      <article class="pipeline-message diarization"><span>RAG</span><p>{ragText}</p></article>
      {#if ragSources.length}<div class="rag-citations"><strong>Sources</strong>{#each ragSources as citation}<code>{citation}</code>{/each}</div>{/if}
    {/if}
    {#if llmInputPreview}
      <label class="llm-input-preview">LLM input<textarea readonly rows="14" value={llmInputPreview}></textarea></label>
    {/if}
    {#if llmResponse}<article class="pipeline-message assistant"><span>{useLlm ? 'LLM' : 'STT · LLM BYPASSED'}</span><p>{llmResponse}</p></article>{/if}
    {#if outputUrl}
      <div class="pipeline-audio-result">
        <span>TTS</span>
        <div class="pipeline-audio"><audio controls autoplay src={outputUrl}></audio><a href={outputUrl} download="voice-response.wav">Save WAV</a></div>
      </div>
    {/if}
    {#if !diarizationText && !sttText && !ragText && !llmResponse && !outputUrl}<div class="empty-output"><div class="wave">∿</div><p>Pipeline results will appear here.</p></div>{/if}
  </section>
</div>
