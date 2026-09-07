<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { browserDecodeToWav } from '$lib/audio';
  import { apiEndpoint, chatText, endpointBlob, endpointJson, endpointModels, endpointRouterModels, routerEndpoint, type OpenAIModel } from '$lib/openai';

  type Stage = 'idle' | 'upload' | 'diarization' | 'stt' | 'llm' | 'tts' | 'done';

  let audioBaseUrl = '';
  let llmBaseUrl = '';
  let models: OpenAIModel[] = [];
  let llmModels: OpenAIModel[] = [];
  let diarizationModel = '';
  let sttModel = '';
  let llmModel = '';
  let ttsModel = '';
  let voice = '';
  let voices: string[] = [];
  let language = '';
  let systemPrompt = 'You are a helpful voice assistant. Answer naturally and concisely because your response will be spoken aloud.';
  let useDiarization = true;
  let temperature = 0.2;
  let maxTokens = 512;
  let sourceFile: File | null = null;
  let sourceInput: HTMLInputElement | null = null;
  let recorder: MediaRecorder | null = null;
  let recordingStream: MediaStream | null = null;
  let recording = false;
  let running = false;
  let stage: Stage = 'idle';
  let status = 'Choose or record a WAV file.';
  let transcript = '';
  let llmResponse = '';
  let diarization: any = null;
  let outputUrl = '';
  let aborter: AbortController | null = null;

  $: diarizationModels = models.filter((entry) => entry.task === 'diar');
  $: sttModels = models.filter((entry) => ['asr', 'stt'].includes(entry.task || ''));
  $: ttsModels = models.filter((entry) => ['tts', 'clon'].includes(entry.task || ''));
  $: canRun = Boolean(sourceFile && sttModel && llmModel && ttsModel && (!useDiarization || diarizationModel));

  function save() {
    localStorage.setItem('audiocpp.pipeline.settings', JSON.stringify({
      diarizationModel, sttModel, llmModel, ttsModel,
      voice, language, systemPrompt, useDiarization, temperature, maxTokens
    }));
  }

  async function refreshAudioModels() {
    models = await endpointModels(audioBaseUrl);
    const nextDiarization = models.filter((entry) => entry.task === 'diar');
    const nextStt = models.filter((entry) => ['asr', 'stt'].includes(entry.task || ''));
    const nextTts = models.filter((entry) => ['tts', 'clon'].includes(entry.task || ''));
    if (!nextDiarization.some((entry) => entry.id === diarizationModel)) diarizationModel = nextDiarization[0]?.id || '';
    if (!nextStt.some((entry) => entry.id === sttModel)) sttModel = nextStt[0]?.id || '';
    if (!nextTts.some((entry) => entry.id === ttsModel)) ttsModel = nextTts[0]?.id || '';
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
    try {
      const result = await endpointJson<{ voices?: string[] }>(audioBaseUrl, `audio/voices?model=${encodeURIComponent(ttsModel)}`);
      voices = result.voices || [];
      if (!voices.includes(voice)) voice = voices[0] || '';
    } catch { voices = []; }
  }

  function chooseFile(file: File | null) {
    sourceFile = file;
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

  function labelTranscript(text: string, diar: any, stt: any): string {
    const turns = Array.isArray(diar?.speaker_turns) ? diar.speaker_turns : [];
    const words = Array.isArray(stt?.words) ? stt.words : [];
    if (!turns.length || !words.length) return text;
    const lines: Array<{ speaker: string; words: string[] }> = [];
    for (const word of words) {
      const start = Number(word.start_sample || 0);
      const end = Number(word.end_sample || start);
      const midpoint = (start + end) / 2;
      const turn = turns.find((item: any) => midpoint >= Number(item.start_sample) && midpoint <= Number(item.end_sample));
      const speaker = String(turn?.speaker_id ?? 'unknown');
      const previous = lines[lines.length - 1];
      if (!previous || previous.speaker !== speaker) lines.push({ speaker, words: [] });
      lines[lines.length - 1].words.push(String(word.word || '').trim());
    }
    const labelled = lines
      .map((line) => `Speaker ${line.speaker}: ${line.words.filter(Boolean).join(' ')}`)
      .filter((line) => !line.endsWith(': '))
      .join('\n');
    return labelled || text;
  }

  async function runPipeline() {
    if (!sourceFile || !canRun) return;
    aborter?.abort();
    aborter = new AbortController();
    running = true;
    transcript = '';
    llmResponse = '';
    diarization = null;
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = '';
    try {
      step('upload', 'Preparing 16 kHz WAV input…');
      const audioPath = await uploadAudio(sourceFile, aborter.signal);

      if (useDiarization) {
        step('diarization', 'Separating speaker turns…');
        diarization = await endpointJson<any>(audioBaseUrl, 'tasks/run', {
          method: 'POST',
          body: JSON.stringify({ model: diarizationModel, audio: audioPath })
        }, aborter.signal);
      }

      step('stt', 'Transcribing speech…');
      const stt = await endpointJson<any>(audioBaseUrl, 'audio/transcriptions/details', {
        method: 'POST',
        body: JSON.stringify({ model: sttModel, audio: audioPath, language })
      }, aborter.signal);
      const plainTranscript = typeof stt.text === 'string' ? stt.text.trim() : '';
      transcript = useDiarization ? labelTranscript(plainTranscript, diarization, stt) : plainTranscript;
      if (!transcript) throw new Error('STT returned an empty transcript.');

      step('llm', 'Generating an instruct-model response…');
      const messages = [];
      if (systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt.trim() });
      messages.push({ role: 'user', content: transcript });
      const llm = await endpointJson<any>(llmBaseUrl, 'chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: llmModel, messages, temperature, max_tokens: maxTokens, stream: false })
      }, aborter.signal);
      llmResponse = chatText(llm);

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

      step('tts', 'Synthesizing the response…');
      const speechBody: Record<string, unknown> = { model: ttsModel, input: llmResponse, response_format: 'wav' };
      if (voice) speechBody.voice = voice;
      const output = await endpointBlob(audioBaseUrl, 'audio/speech', speechBody, aborter.signal);
      outputUrl = URL.createObjectURL(output);
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
    const workerUrl = new URL(document.baseURI);
    workerUrl.port = '8082';
    workerUrl.pathname = '/v1/';
    workerUrl.search = '';
    workerUrl.hash = '';
    llmBaseUrl = workerUrl.toString().replace(/\/$/, '');
    try {
      const saved = JSON.parse(localStorage.getItem('audiocpp.pipeline.settings') || '{}');
      diarizationModel = saved.diarizationModel || '';
      sttModel = saved.sttModel || '';
      llmModel = saved.llmModel || '';
      ttsModel = saved.ttsModel || '';
      voice = saved.voice || '';
      language = saved.language || '';
      systemPrompt = saved.systemPrompt || systemPrompt;
      useDiarization = saved.useDiarization ?? useDiarization;
      temperature = Number(saved.temperature ?? temperature);
      maxTokens = Number(saved.maxTokens ?? maxTokens);
    } catch { /* use defaults */ }
    refreshAll();
  });

  onDestroy(() => {
    aborter?.abort();
    if (recorder?.state === 'recording') recorder.stop();
    recordingStream?.getTracks().forEach((track) => track.stop());
    if (outputUrl) URL.revokeObjectURL(outputUrl);
  });
</script>

<section class="page-head pipeline-head">
  <p class="eyebrow">VOICE AGENT PIPELINE</p>
  <h1>Diarization → STT → LLM → TTS</h1>
  <p>A Python-free voice round trip using audio.cpp, llama.cpp, and this Svelte interface.</p>
</section>

<section class="pipeline-steps" aria-label="Pipeline progress">
  {#each [['diarization', 'Diarization'], ['stt', 'Speech to text'], ['llm', 'Language model'], ['tts', 'Text to speech']] as item, index}
    <div class:active={stage === item[0]} class:complete={stage === 'done' || ['diarization', 'stt', 'llm', 'tts'].indexOf(stage) > index}>
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
      <label>Diarization model<select bind:value={diarizationModel} on:change={save}>{#each diarizationModels as entry}<option value={entry.id}>{entry.id}</option>{/each}</select></label>
    {/if}
    <label>STT model<select bind:value={sttModel} on:change={save}>{#each sttModels as entry}<option value={entry.id}>{entry.id}</option>{/each}</select></label>
    <label>LLM instruct model<select bind:value={llmModel} on:change={save}>{#if !llmModels.length && llmModel}<option value={llmModel}>{llmModel}</option>{/if}{#each llmModels as entry}<option value={entry.id}>{entry.id}</option>{/each}</select></label>
    <label>TTS model<select bind:value={ttsModel} on:change={() => { refreshVoices(); save(); }}>{#each ttsModels as entry}<option value={entry.id}>{entry.id}</option>{/each}</select></label>
    <div class="field-grid">
      <label>Voice<select bind:value={voice} on:change={save}><option value="">Model default</option>{#each voices as item}<option value={item}>{item}</option>{/each}</select></label>
      <label>STT language<input bind:value={language} placeholder="auto" on:change={save} /></label>
    </div>
  </section>

  <section class="panel page-panel pipeline-input">
    <div class="section-title"><div><span>INPUT</span><h2>Audio & instructions</h2></div></div>
    <input class="hidden-file" bind:this={sourceInput} type="file" accept="audio/*" on:change={(event) => chooseFile(event.currentTarget.files?.[0] || null)} />
    <div class="audio-drop">
      <strong>{sourceFile?.name || 'No audio selected'}</strong>
      <span>WAV, MP3, FLAC, or browser recording</span>
      <div><button on:click={() => sourceInput?.click()}>Choose audio</button><button class:danger={recording} on:click={toggleRecording}>{recording ? 'Stop recording' : 'Record microphone'}</button></div>
    </div>
    <label>System prompt<textarea bind:value={systemPrompt} rows="6" on:change={save}></textarea></label>
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
    <div class="section-title"><div><span>RESULTS</span><h2>Conversation</h2></div></div>
    {#if diarization?.speaker_turns?.length}
      <div class="speaker-turns">
        {#each diarization.speaker_turns as turn}
          <span><strong>Speaker {turn.speaker_id}</strong> {((turn.start_sample || 0) / (diarization.sample_rate || 16000)).toFixed(1)}–{((turn.end_sample || 0) / (diarization.sample_rate || 16000)).toFixed(1)}s</span>
        {/each}
      </div>
    {/if}
    {#if transcript}<article class="pipeline-message user"><span>TRANSCRIPT</span><p>{transcript}</p></article>{/if}
    {#if llmResponse}<article class="pipeline-message assistant"><span>ASSISTANT</span><p>{llmResponse}</p></article>{/if}
    {#if outputUrl}<div class="pipeline-audio"><audio controls autoplay src={outputUrl}></audio><a href={outputUrl} download="voice-response.wav">Save WAV</a></div>{/if}
    {#if !transcript && !llmResponse && !outputUrl}<div class="empty-output"><div class="wave">∿</div><p>Pipeline results will appear here.</p></div>{/if}
  </section>
</div>
