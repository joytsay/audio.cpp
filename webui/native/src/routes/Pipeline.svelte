<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { browserDecodeToWav, encodePcm16Wav } from '$lib/audio';
  import { traditionalAsrText, traditionalChineseText } from '$lib/asr-text';
  import { catalog } from '$lib/catalog';
  import MediaPreview from '$lib/MediaPreview.svelte';
  import { apiEndpoint, chatText, endpointBlob, endpointJson, endpointModels, endpointRouterModels, formatChatMessages, routerEndpoint, siblingWorkerEndpoint, type ChatMessage, type OpenAIModel } from '$lib/openai';
  import { graphCitations, graphContext, graphSearch, ragSearch } from '$lib/rag';
  import type { CatalogEntry, InstallPackageChoice, StringMap } from '$lib/types';
  import { createLocalId, deleteVoice as deleteSavedVoice, listVoices, saveVoice, type SavedVoice } from '$lib/voices';
  import systemPromt from '../../../../prompt.csv?raw';
  import bundledHotwords from '../../../../hotword.csv?raw';
  import centralStationExample from '../../../../assets/resources/中央監控站2.mp3?url';
  import controlRoomExample from '../../../../assets/resources/中控室.mp3?url';
  import employeeCheckpointExample from '../../../../assets/resources/員工檢查哨.mp3?url';
  import lobbyExample from '../../../../assets/resources/大廳.mp3?url';
  import vehicleCheckpointExample from '../../../../assets/resources/車輛檢查哨.mp3?url';

  type Stage = 'idle' | 'upload' | 'vad' | 'stt' | 'rag' | 'llm' | 'tts' | 'done';
  type PromptMode = 'system' | 'rag' | 'graphrag';

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
  let vadModel = 'silero-vad';
  const sileroVadFields = [
    { key: 'threshold', label: 'Speech threshold', value: 0.5, min: 0.01, max: 1, step: 0.01, help: 'Lower values detect quieter speech; higher values reject more noise.' },
    { key: 'min_speech_duration_ms', label: 'Minimum speech (ms)', value: 250, min: 0, max: 10000, step: 1, help: 'Discard speech segments shorter than this.' },
    { key: 'min_silence_duration_ms', label: 'Minimum silence (ms)', value: 100, min: 0, max: 10000, step: 1, help: 'Silence required to separate speech segments.' },
    { key: 'speech_pad_ms', label: 'Speech padding (ms)', value: 30, min: 0, max: 5000, step: 1, help: 'Keep extra audio before and after each speech segment.' },
    { key: 'max_speech_duration_s', label: 'Maximum segment (s)', value: 0, min: 0, max: 3600, step: 0.1, help: 'Split longer segments. Use 0 for unlimited. Microphone turns still stop at 15 seconds.' },
    { key: 'neg_threshold', label: 'Silence threshold', value: -1, min: -1, max: 1, step: 0.01, help: 'End speech below this probability. Use -1 for automatic: speech threshold minus 0.15, at least 0.01.' },
    { key: 'min_silence_at_max_speech_ms', label: 'Silence at maximum segment (ms)', value: 98, min: 0, max: 10000, step: 1, help: 'Minimum pause used to split a segment at its maximum duration.' }
  ];
  let sileroVadSettings: Record<string, number> = Object.fromEntries(sileroVadFields.map((field) => [field.key, field.value]));
  let vadUseLongestSilence = true;

  function normalizeVadSettings(settings: Record<string, number>) {
    return Object.fromEntries(sileroVadFields.map((field) => {
      const raw = settings[field.key];
      const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : field.value;
      const bounded = Math.max(field.min, Math.min(field.max, value));
      return [field.key, field.step === 1 ? Math.round(bounded) : bounded];
    }));
  }

  function vadRequestOptions(): StringMap {
    if (!selectedVadIsSilero) return {};
    const settings = normalizeVadSettings(sileroVadSettings);
    return {
      ...Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value)])),
      max_speech_duration_s: String(settings.max_speech_duration_s || 1e9),
      use_max_poss_sil_at_max_speech: String(vadUseLongestSilence)
    };
  }

  function saveVadSettings() {
    sileroVadSettings = normalizeVadSettings(sileroVadSettings);
    save();
  }

  function resetVadSettings() {
    sileroVadSettings = Object.fromEntries(sileroVadFields.map((field) => [field.key, field.value]));
    vadUseLongestSilence = true;
    save();
  }
  let llmModels: OpenAIModel[] = [];
  let sttModel = 'qwen3-asr';
  let llmModel = '';
  let ttsModel = 'zipvoice';
  let voice = '';
  let voices: string[] = [];
  let language = '';
  function asrContextFromCsv(csv: string): string | null {
    const match = csv.replace(/^\uFEFF/, '').match(/^context\r?\n"([\s\S]*)"\r?\n?$/);
    return match ? match[1].replace(/""/g, '"') : null;
  }
  const defaultAsrContext = asrContextFromCsv(bundledHotwords) || 'Technical terms: X光機 T5';
  let asrContext = defaultAsrContext;
  let useHotwords = true;
  let playbackStatus = '';
  function autoplaySpeech(node: HTMLAudioElement) {
    const play = () => {
      playbackStatus = '';
      document.querySelectorAll<HTMLAudioElement>('.conversation-turn .assistant audio').forEach((audio) => {
        if (audio !== node) audio.pause();
      });
      void node.play().catch(() => { playbackStatus = 'Press Play on the response audio to enable playback.'; });
    };
    node.addEventListener('loadeddata', play, { once: true });
    if (node.readyState >= 2) play();
    return { destroy() { node.removeEventListener('loadeddata', play); node.pause(); } };
  }
  let chatHistory: ChatMessage[] = [];
  interface ConversationTurn {
    id: string; name: string; inputAudio: string; transcript: string; reply: string;
    audio: string; vad: string; rag: string; sources: string[]; llmInput: string;
    status: string; state: 'running' | 'complete' | 'failed';
    runtimes: Partial<Record<TimedStage, number>>;
  }
  let turns: ConversationTurn[] = [];
  let activeTurnId = '';
  let conversationLog: HTMLDivElement;
  $: if (turns.length && conversationLog) {
    tick().then(() => { if (conversationLog) conversationLog.scrollTo({ top: conversationLog.scrollHeight }); });
  }
  $: if (activeTurnId) updateTurn({ transcript: sttText, reply: llmResponse, audio: outputUrl,
    vad: vadText, rag: ragText, sources: ragSources, llmInput: llmInputPreview, status, runtimes: stageRuntimes });
  function updateTurn(values: Partial<ConversationTurn>) {
    turns = turns.map((turn) => turn.id === activeTurnId ? { ...turn, ...values } : turn);
  }
  function clearConversation() {
    for (const turn of turns) {
      if (turn.inputAudio) URL.revokeObjectURL(turn.inputAudio);
      if (turn.audio) URL.revokeObjectURL(turn.audio);
    }
    replyPlaying = false;
    resetMicrophoneBuffers();
    turns = [];
    chatHistory = [];
    outputUrl = '';
    stage = 'idle';
    stageRuntimes = {};
    status = 'Type a message, choose an example, or record audio to start a new conversation.';
  }
  let systemPrompt = systemPromt.trim();
  let promptMode: PromptMode = 'system';
  let useLlm = true;
  let useTts = true;
  let temperature = 0.2;
  let maxTokens = 512;
  let sourceFile: File | null = null;
  let textInput = '';
  let turnInput: 'audio' | 'text' = 'audio';
  let inputUrl = '';
  let sourceInput: HTMLInputElement | null = null;
  let cloneVoiceInput: HTMLInputElement | null = null;
  let cloneVoiceFile: File | null = null;
  let cloneReferenceText = '';
  let cloneVoiceName = '';
  let savedCloneVoices: SavedVoice[] = [];
  let savedCloneVoiceId = '';
  let savingCloneVoice = false;
  let cloneRecorder: MediaRecorder | null = null;
  let cloneRecordingStream: MediaStream | null = null;
  let cloneRecording = false;
  let cloneRecordingStarting = false;
  let cloneRecordingSaving = false;
  let cloneRecordingGeneration = 0;
  let cloneRecordingStatus = '';
  $: cloneRecordingBusy = cloneRecording || cloneRecordingStarting || cloneRecordingSaving;
  let recordingStream: MediaStream | null = null;
  let microphoneListening = false;
  let microphoneStarting = false;
  let microphoneDetecting = false;
  let microphoneContext: AudioContext | null = null;
  let microphoneProcessor: ScriptProcessorNode | null = null;
  let microphoneSource: MediaStreamAudioSourceNode | null = null;
  let microphoneMute: GainNode | null = null;
  let microphoneSamples: Float32Array[] = [];
  let microphoneFrames = 0;
  let microphoneSpeech: Float32Array[] = [];
  let microphoneSpeechFrames = 0;
  let microphonePreRoll: Float32Array | null = null;
  let microphoneAborter: AbortController | null = null;
  let microphoneGeneration = 0;
  let microphoneStatus = 'Microphone off';
  let microphoneWaveform = Array<number>(48).fill(2);
  let sourceFromMicrophone = false;
  let turnFromMicrophone = false;
  let replyPlaying = false;
  let running = false;
  let stage: Stage = 'idle';
  let status = 'Type a message or choose audio.';
  let vadText = '';
  let sttText = '';
  let ragText = '';
  let ragSources: string[] = [];
  let ragResultCount = 5;
  let ragSearchMode: 'local' | 'global' = 'local';
  let transcript = '';
  let llmResponse = '';
  let llmInputPreview = '';
  let outputUrl = '';
  let aborter: AbortController | null = null;
  const defaultCloneVoiceName = 'lingCL';
  const exampleAudioFiles = [
    { name: '中央監控站2.mp3', url: centralStationExample },
    { name: '中控室.mp3', url: controlRoomExample },
    { name: '員工檢查哨.mp3', url: employeeCheckpointExample },
    { name: '大廳.mp3', url: lobbyExample },
    { name: '車輛檢查哨.mp3', url: vehicleCheckpointExample }
  ];
  type TimedStage = Exclude<Stage, 'idle' | 'done'>;
  let stageRuntimes: Partial<Record<TimedStage, number>> = {};
  let stageStartedAt = 0;
  let runtimeTick = 0;
  let runtimeTimer: ReturnType<typeof setInterval> | null = null;

  $: selectedVadModel = models.find((entry) => entry.selectionId === vadModel);
  $: selectedVadIsSilero = selectedVadModel?.family === 'silero_vad' ||
    /^silero[-_]vad(?:[-_]|$)/i.test(selectedVadModel?.modelId || vadModel);
  $: vadDetectorName = (catalog.find((entry) => entry.id === selectedVadModel?.modelId)?.display_name ||
    selectedVadModel?.label || 'Selected VAD').replace(/\s*\([^)]*\)$/, '');
  $: sttModels = models.filter((entry) => ['asr', 'stt'].includes(entry.task || ''));
  $: ttsModels = models.filter((entry) => ['tts', 'clon'].includes(entry.task || ''));
  // Keep this lookup inline: Svelte's legacy reactive dependency analysis
  // cannot see `models` when it is accessed only inside selectedAudioModel().
  // Without the direct reference, a saved TTS selection remains unresolved
  // after the initial asynchronous model refresh until the user changes it.
  $: selectedTtsModel = models.find((entry) => entry.selectionId === ttsModel);
  // A model loaded from server configuration may only expose its ID in an
  // older cached model response. Recognize Qwen3-TTS by either source so the
  // clone controls are never hidden merely because that metadata is absent.
  $: selectedTtsIsQwen = selectedTtsModel?.family === 'qwen3_tts' ||
    /^qwen3[-_]tts(?:[-_]|$)/i.test(selectedTtsModel?.modelId || '');
  $: selectedTtsSupportsReference = ['voxcpm1', 'audio8_tts'].includes(
    selectedTtsModel?.family || '');
  $: supportsVoiceClone = selectedTtsModel?.task === 'clon' ||
    selectedTtsSupportsReference ||
    (selectedTtsIsQwen && !/custom/i.test(selectedTtsModel?.modelId || ''));
  $: pipelineSteps = [
    ...(turnInput === 'audio' && turnFromMicrophone ? [['vad', 'Voice activity detection']] : []),
    ...(turnInput === 'audio' ? [['stt', 'Speech to text']] : []),
    ...(promptMode !== 'system' ? [['rag', 'RAG']] : []),
    ...(useLlm ? [['llm', 'Language model']] : []),
    ...(useTts ? [['tts', 'Text to speech']] : [])
  ];
  $: canGenerateReply = Boolean((!useLlm || llmModel) &&
    (!useTts || (ttsModel && (selectedTtsModel?.family !== 'zipvoice' ||
      (cloneVoiceFile && cloneReferenceText.trim()) || voice))));
  $: canSendAudio = Boolean(!cloneRecordingBusy && sourceFile && sttModel && (!sourceFromMicrophone || vadModel) && canGenerateReply);
  $: canSendText = Boolean(!cloneRecordingBusy && textInput.trim() && canGenerateReply);

  function save() {
    localStorage.setItem('audiocpp.conversation.settings', JSON.stringify({
      promptDefaultsVersion: 2, vadModel, sileroVadSettings, vadUseLongestSilence, sttModel, llmModel, ttsModel,
      audioBaseUrl, llmBaseUrl, asrContext, useHotwords, voice, language, promptMode,
      useLlm, useTts, temperature, maxTokens,
      ragResultCount, ragSearchMode
    }));
  }

  async function saveSystemPromptCsv() {
    try {
      const saved = await endpointJson<{ content?: string }>(audioBaseUrl, 'ui/prompt', {
        method: 'POST',
        body: JSON.stringify({ content: systemPrompt })
      });
      systemPrompt = saved.content ?? systemPrompt;
      save();
      status = 'System prompt saved to prompt.csv.';
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
  }

  async function saveAsrContextCsv() {
    try {
      const content = `context\n"${asrContext.replace(/"/g, '""')}"\n`;
      await endpointJson(audioBaseUrl, 'ui/hotword', {
        method: 'POST', body: JSON.stringify({ content })
      });
      save();
      status = 'Hotwords saved to hotword.csv.';
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
  }

  async function refreshPrompts() {
    const results = await Promise.allSettled([
      endpointJson<{ content: string }>(audioBaseUrl, 'ui/prompt'),
      endpointJson<{ content: string }>(audioBaseUrl, 'ui/hotword')
    ]);
    if (results[0].status === 'fulfilled') systemPrompt = results[0].value.content;
    if (results[1].status === 'fulfilled') {
      const context = asrContextFromCsv(results[1].value.content);
      if (context !== null) asrContext = context;
    }
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
      if (!['vad', 'asr', 'stt', 'tts', 'clon'].includes(entry.task)) return [];
      const choices = (entry.install_packages || []).filter((choice) => installed.has(choice.id));
      if (entry.task === 'vad' && !entry.install_packages?.length) {
        return [{
          selectionId: `bundled:${entry.id}`,
          modelId: entry.id,
          id: entry.id,
          label: entry.display_name,
          family: entry.family,
          task: entry.task,
          mode: entry.mode || 'offline',
          path: resolvedModelPath(entry.path, modelsRoot),
          loadOptions: entry.load_options,
          sessionOptions: entry.session_options,
          builtinVoices: entry.builtin_voices
        }];
      }
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
    // `/v1/models` from an already-running server can be an older, minimal
    // response with just an ID.  Fill in the known catalog metadata so
    // controls such as Qwen3-TTS voice cloning render on the first load.
    const catalogEntry = catalog.find((candidate) => candidate.id === entry.id);
    return {
      ...entry,
      selectionId: `configured:${entry.id}`,
      modelId: entry.id,
      label: entry.id,
      path: entry.path,
      mode: entry.mode || 'offline',
      family: entry.family || catalogEntry?.family,
      task: entry.task || catalogEntry?.task,
      loadOptions: catalogEntry?.load_options,
      sessionOptions: catalogEntry?.session_options,
      builtinVoices: catalogEntry?.builtin_voices
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
    if (!selected.selectionId.startsWith('configured:') && selected.path && selected.family && selected.task) {
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
    const available = [
      ...installed,
      ...configured.map(configuredAudioModel).filter((entry) =>
        !installedPaths.has(`${entry.modelId}\n${entry.path || ''}`))
    ];
    // Prefer the bundled Silero entry over the same model already loaded by
    // the server, whose path may be absent or absolute in /v1/models.
    const silero = available.find((entry) => entry.task === 'vad' && entry.family === 'silero_vad');
    models = available.filter((entry) => entry.task !== 'vad' || entry === silero);
    const nextVad = models.filter((entry) => entry.task === 'vad');
    const nextStt = models.filter((entry) => ['asr', 'stt'].includes(entry.task || ''));
    const nextTts = models.filter((entry) => ['tts', 'clon'].includes(entry.task || ''));
    vadModel = nextVad[0]?.selectionId || '';
    sttModel = keepSelection(nextStt, sttModel);
    ttsModel = keepSelection(nextTts, ttsModel);
    await refreshVoices();
    save();
  }

  async function refreshLlmModels() {
    llmModels = await endpointRouterModels(llmBaseUrl);
    if (!llmModels.some((entry) => entry.id === llmModel)) llmModel =
      llmModels.find((entry) => /qwen2\.[45].*instruct.*q4_k_m/i.test(entry.id))?.id || llmModels[0]?.id || llmModel;
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

  async function refreshSavedCloneVoices() {
    try {
      savedCloneVoices = await listVoices();
      // Prefer the operator's standard reference voice on a fresh Pipeline
      // session, while preserving any voice file or saved voice already chosen.
      if (!cloneVoiceFile && !savedCloneVoiceId) {
        const defaultVoice = savedCloneVoices.find((entry) =>
          entry.name.trim().toLowerCase() === defaultCloneVoiceName.toLowerCase());
        if (defaultVoice) chooseSavedCloneVoice(defaultVoice.id);
      }
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

  function cancelCloneRecording() {
    cloneRecordingGeneration += 1;
    if (cloneRecorder) {
      cloneRecorder.ondataavailable = null;
      cloneRecorder.onstop = null;
      cloneRecorder.onerror = null;
      if (cloneRecorder.state !== 'inactive') cloneRecorder.stop();
    }
    cloneRecordingStream?.getTracks().forEach((track) => track.stop());
    cloneRecorder = null;
    cloneRecordingStream = null;
    cloneRecording = false;
    cloneRecordingStarting = false;
    cloneRecordingSaving = false;
    cloneRecordingStatus = '';
  }

  async function startCloneRecording() {
    if (cloneRecordingBusy || running) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      cloneRecordingStatus = 'Microphone recording is unavailable. Open this page over HTTPS.';
      return;
    }
    stopMicrophone();
    document.querySelectorAll<HTMLAudioElement>('audio').forEach((audio) => audio.pause());
    const generation = ++cloneRecordingGeneration;
    cloneRecordingStarting = true;
    cloneRecordingStatus = 'Opening microphone…';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true
      } });
      if (generation !== cloneRecordingGeneration) { stream.getTracks().forEach((track) => track.stop()); return; }
      cloneRecordingStream = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      cloneRecorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        if (generation !== cloneRecordingGeneration) return;
        cancelCloneRecording();
        cloneRecordingStatus = 'Microphone recording failed. Please try again.';
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (generation !== cloneRecordingGeneration) return;
        cloneRecordingStream = null;
        cloneRecorder = null;
        cloneRecording = false;
        cloneRecordingSaving = true;
        cloneRecordingStatus = 'Preparing reference audio…';
        try {
          if (!chunks.length) throw new Error('No audio recorded. Please try again.');
          const captured = new File(chunks, 'recorded-reference', { type: recorder.mimeType || chunks[0].type });
          const wav = await browserDecodeToWav(captured, 24000, 1);
          if (generation !== cloneRecordingGeneration) return;
          chooseCloneVoice(new File([wav], `reference-${Date.now()}.wav`, { type: 'audio/wav' }));
          cloneReferenceText = '';
          if (cloneVoiceInput) cloneVoiceInput.value = '';
          cloneRecordingStatus = 'Reference recorded. Enter the exact words you spoke below.';
        } catch (error) {
          if (generation === cloneRecordingGeneration) cloneRecordingStatus = error instanceof Error ? error.message : String(error);
        } finally {
          if (generation === cloneRecordingGeneration) cloneRecordingSaving = false;
        }
      };
      recorder.start();
      cloneRecordingStarting = false;
      cloneRecording = true;
      cloneRecordingStatus = 'Recording reference voice…';
    } catch (error) {
      if (generation === cloneRecordingGeneration) {
        cancelCloneRecording();
        cloneRecordingStatus = error instanceof Error ? error.message : String(error);
      }
    }
  }

  function finishCloneRecording() {
    if (cloneRecorder?.state === 'recording') {
      cloneRecording = false;
      cloneRecordingSaving = true;
      cloneRecordingStatus = 'Preparing reference audio…';
      cloneRecorder.stop();
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

  function chooseFile(file: File | null, fromMicrophone = false) {
    sourceFromMicrophone = fromMicrophone;
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    sourceFile = file;
    inputUrl = file ? URL.createObjectURL(file) : '';
    status = file ? `${file.name} is ready.` : 'Type a message or choose audio.';
  }

  async function chooseExampleAudio(example: { name: string; url: string }) {
    try {
      if (example.url.startsWith('data:')) {
        const comma = example.url.indexOf(',');
        if (comma < 0) throw new Error(`Could not load ${example.name}.`);
        const bytes = Uint8Array.from(atob(example.url.slice(comma + 1)), (char) => char.charCodeAt(0));
        chooseFile(new File([bytes], example.name, { type: 'audio/mpeg' }));
        return;
      }
      const response = await fetch(example.url);
      if (!response.ok) throw new Error(`Could not load ${example.name}.`);
      chooseFile(new File([await response.blob()], example.name, { type: 'audio/mpeg' }));
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
  }

  function resetMicrophoneBuffers() {
    microphoneSamples = [];
    microphoneFrames = 0;
    microphoneSpeech = [];
    microphoneSpeechFrames = 0;
    microphonePreRoll = null;
  }

  function stopMicrophone() {
    microphoneGeneration += 1;
    microphoneListening = false;
    microphoneStarting = false;
    microphoneDetecting = false;
    microphoneAborter?.abort();
    microphoneAborter = null;
    if (microphoneProcessor) microphoneProcessor.onaudioprocess = null;
    microphoneProcessor?.disconnect();
    microphoneSource?.disconnect();
    microphoneMute?.disconnect();
    recordingStream?.getTracks().forEach((track) => track.stop());
    recordingStream = null;
    if (microphoneContext) void microphoneContext.close();
    microphoneContext = null;
    microphoneProcessor = null;
    microphoneSource = null;
    microphoneMute = null;
    resetMicrophoneBuffers();
    microphoneWaveform = Array<number>(48).fill(2);
    microphoneStatus = 'Microphone off';
  }

  function microphoneWav(parts: Float32Array[], context: AudioContext): File {
    const frames = parts.reduce((total, part) => total + part.length, 0);
    const audio = context.createBuffer(1, frames, context.sampleRate);
    let offset = 0;
    for (const part of parts) { audio.getChannelData(0).set(part, offset); offset += part.length; }
    return new File([encodePcm16Wav(audio)], 'microphone-turn.wav', { type: 'audio/wav' });
  }

  async function detectMicrophoneSpeech(samples: Float32Array, generation: number) {
    const context = microphoneContext;
    if (!context || !microphoneListening || microphoneDetecting) return;
    microphoneDetecting = true;
    const controller = new AbortController();
    microphoneAborter = controller;
    try {
      const vad = await ensureAudioModel(vadModel, controller.signal);
      const audio = await uploadAudio(microphoneWav([samples], context), controller.signal);
      const result = await endpointJson<any>(audioBaseUrl, 'tasks/run', {
        method: 'POST', body: JSON.stringify({ model: vad.modelId, audio, options: vadRequestOptions() })
      }, controller.signal);
      if (generation !== microphoneGeneration || !microphoneListening) return;
      if (running || replyPlaying) { resetMicrophoneBuffers(); return; }
      const segments = Array.isArray(result?.segments) ? result.segments :
        Array.isArray(result?.speech_segments) ? result.speech_segments : [];
      const hasSpeech = segments.some((segment: any) => Number(segment.end_sample) > Number(segment.start_sample));
      if (hasSpeech) {
        if (!microphoneSpeech.length && microphonePreRoll) {
          microphoneSpeech.push(microphonePreRoll);
          microphoneSpeechFrames += microphonePreRoll.length;
        }
        microphoneSpeech.push(samples);
        microphoneSpeechFrames += samples.length;
        microphonePreRoll = null;
        microphoneStatus = `${vadDetectorName} · speech detected · capturing your turn…`;
      } else if (!microphoneSpeech.length) {
        microphonePreRoll = samples;
        microphoneStatus = `Listening · ${vadDetectorName} is detecting speech…`;
      }
      // A silent VAD window ends the turn; cap uninterrupted speech at 15 seconds.
      if (microphoneSpeech.length && (!hasSpeech || microphoneSpeechFrames >= context.sampleRate * 15)) {
        const utterance = microphoneWav(microphoneSpeech, context);
        resetMicrophoneBuffers();
        chooseFile(utterance, true);
        await tick();
        if (generation !== microphoneGeneration || !microphoneListening) return;
        if (!canGenerateReply) {
          microphoneStatus = 'Speech captured. Complete the LLM/TTS settings, then Send audio.';
          return;
        }
        microphoneStatus = 'Processing your turn…';
        await runPipeline('audio');
        if (generation === microphoneGeneration && microphoneListening) {
          microphoneStatus = replyPlaying ? 'Speaking · listening resumes after the reply' : `Listening · ${vadDetectorName} is detecting speech…`;
        }
      }
    } catch (error) {
      if (generation === microphoneGeneration && microphoneListening) {
        const message = error instanceof Error ? error.message : String(error);
        stopMicrophone();
        microphoneStatus = `Microphone stopped: ${message}`;
      }
    } finally {
      if (generation === microphoneGeneration) {
        microphoneDetecting = false;
        microphoneAborter = null;
      }
    }
  }

  async function toggleMicrophone() {
    if (microphoneListening || microphoneStarting) { stopMicrophone(); return; }
    if (cloneRecordingBusy) return;
    if (!sttModel || !vadModel) {
      microphoneStatus = 'Choose ASR and VAD models before starting the microphone.';
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      microphoneStatus = 'Microphone access is unavailable. Open this page over HTTPS and allow microphone access.';
      return;
    }
    const generation = ++microphoneGeneration;
    microphoneStarting = true;
    microphoneStatus = 'Opening microphone…';
    let stream: MediaStream | null = null;
    try {
      // Activate audio during the button gesture, before the permission prompt.
      const context = new AudioContext();
      microphoneContext = context;
      const resumeAudio = context.resume();
      stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true
      } });
      if (generation !== microphoneGeneration) { stream.getTracks().forEach((track) => track.stop()); return; }
      recordingStream = stream;
      await resumeAudio;
      if (generation !== microphoneGeneration) return;
      microphoneSource = microphoneContext.createMediaStreamSource(stream);
      microphoneProcessor = microphoneContext.createScriptProcessor(4096, 1, 1);
      microphoneMute = microphoneContext.createGain();
      microphoneMute.gain.value = 0;
      microphoneSource.connect(microphoneProcessor);
      microphoneProcessor.connect(microphoneMute);
      microphoneMute.connect(microphoneContext.destination);
      microphoneListening = true;
      microphoneStarting = false;
      microphoneStatus = `Listening · ${vadDetectorName} is detecting speech…`;
      microphoneProcessor.onaudioprocess = (event) => {
        if (!microphoneListening || !microphoneContext) return;
        const chunk = new Float32Array(event.inputBuffer.getChannelData(0));
        // Draw measured microphone energy, rather than a decorative animation.
        microphoneWaveform = Array.from({ length: 48 }, (_, index) => {
          const start = Math.floor(index * chunk.length / 48);
          const end = Math.floor((index + 1) * chunk.length / 48);
          let energy = 0;
          for (let sample = start; sample < end; sample++) energy += chunk[sample] * chunk[sample];
          return Math.max(2, Math.min(36, Math.sqrt(energy / Math.max(1, end - start)) * 120));
        });
        // Check actual playback so a missed media event cannot leave VAD paused.
        replyPlaying = Array.from(document.querySelectorAll<HTMLAudioElement>('.conversation-turn .assistant audio'))
          .some((audio) => !audio.paused && !audio.ended && !audio.error);
        if (running || replyPlaying) {
          resetMicrophoneBuffers();
          microphoneStatus = replyPlaying ? 'Speaking · listening resumes after the reply' : 'Processing your turn…';
          return;
        }
        microphoneSamples.push(chunk);
        microphoneFrames += chunk.length;
        if (!microphoneDetecting && microphoneFrames >= microphoneContext.sampleRate) {
          const samples = new Float32Array(microphoneFrames);
          let offset = 0;
          for (const part of microphoneSamples) { samples.set(part, offset); offset += part.length; }
          microphoneSamples = [];
          microphoneFrames = 0;
          void detectMicrophoneSpeech(samples, generation);
        }
      };
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (generation === microphoneGeneration) {
        stopMicrophone();
        microphoneStatus = error instanceof Error ? error.message : String(error);
      }
    }
  }

  async function uploadAudio(
    file: File,
    signal: AbortSignal,
    sampleRate = 16000,
    channels = 1
  ): Promise<string> {
    const wav = await browserDecodeToWav(file, sampleRate, channels);
    const response = await fetch(apiEndpoint(audioBaseUrl, 'ui/upload'), {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav', 'X-AudioCPP-Filename': 'pipeline-input.wav' },
      body: wav,
      signal
    });
    if (!response.ok) throw new Error(`Audio upload failed: ${response.status} ${await response.text()}`);
    return (await response.json()).path;
  }

  function finishActiveStage(now = performance.now()) {
    if (stage !== 'idle' && stage !== 'done' && stageStartedAt) {
      stageRuntimes = { ...stageRuntimes, [stage]: now - stageStartedAt };
    }
    stageStartedAt = 0;
    runtimeTick = now;
  }

  function step(next: Stage, message: string) {
    const now = performance.now();
    finishActiveStage(now);
    stage = next;
    if (next !== 'done') stageStartedAt = now;
    status = message;
  }

  function stageRuntime(stageName: string, tick: number): number | undefined {
    const completed = stageRuntimes[stageName as TimedStage];
    if (completed !== undefined) return completed;
    return stage === stageName && stageStartedAt ? tick - stageStartedAt : undefined;
  }

  function formatStageRuntime(milliseconds: number): string {
    const seconds = Math.max(0, milliseconds) / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`;
  }

  function formatVad(result: any): string {
    const segments = Array.isArray(result?.segments) ? result.segments :
      Array.isArray(result?.speech_segments) ? result.speech_segments : [];
    if (!segments.length) return 'No speech segments detected.';
    const sampleRate = Number(result.sample_rate) || 16000;
    return segments.map((segment: any) => {
      const start = Number(segment.start_sample || 0) / sampleRate;
      const end = Number(segment.end_sample || 0) / sampleRate;
      return `${start.toFixed(1)}–${end.toFixed(1)}s`;
    }).join('\n');
  }

  async function audioForSpeechSegments(file: File, vadResult: any): Promise<File> {
    const segments = Array.isArray(vadResult?.segments) ? vadResult.segments :
      Array.isArray(vadResult?.speech_segments) ? vadResult.speech_segments : [];
    if (!segments.length) throw new Error('VAD returned no speech segments to transcribe.');
    const context = new AudioContext();
    try {
      const input = await context.decodeAudioData(await file.arrayBuffer());
      // VAD runs on the 16 kHz upload. AudioContext may decode that WAV at
      // the device rate (often 48 kHz), while /tasks/run can omit sample_rate.
      const vadRate = Number(vadResult?.sample_rate) || 16000;
      const spans = (segments.map((segment: any) => ({
        start: Math.max(0, Math.floor(Number(segment.start_sample || 0) * input.sampleRate / vadRate)),
        end: Math.min(input.length, Math.ceil(Number(segment.end_sample || 0) * input.sampleRate / vadRate))
      })) as Array<{ start: number; end: number }>).filter((span) => span.end > span.start);
      if (!spans.length) throw new Error('VAD returned no usable speech segments to transcribe.');
      // Join speech spans rather than leaving long silent holes between them.
      // Some ASR models stop early after a sufficiently long silent region.
      const output = context.createBuffer(
        input.numberOfChannels,
        spans.reduce((frames, span) => frames + span.end - span.start, 0),
        input.sampleRate);
      let destinationOffset = 0;
      for (const span of spans) {
        for (let channel = 0; channel < input.numberOfChannels; channel += 1) {
          output.copyToChannel(input.getChannelData(channel).slice(span.start, span.end), channel, destinationOffset);
        }
        destinationOffset += span.end - span.start;
      }
      return new File([encodePcm16Wav(output)], 'pipeline-speech-segments.wav', { type: 'audio/wav' });
    } finally {
      await context.close();
    }
  }

  async function runPipeline(input: 'audio' | 'text') {
    if (running || (input === 'audio' ? !canSendAudio : !canSendText)) return;
    turnInput = input;
    turnFromMicrophone = input === 'audio' && sourceFromMicrophone;
    const submittedText = input === 'text' ? textInput.trim() : '';
    if (input === 'text') textInput = '';
    aborter?.abort();
    aborter = new AbortController();
    running = true;
    vadText = '';
    sttText = submittedText;
    ragText = '';
    ragSources = [];
    transcript = '';
    llmResponse = '';
    llmInputPreview = '';
    outputUrl = '';
    activeTurnId = createLocalId();
    turns = [...turns, { id: activeTurnId, name: input === 'audio' ? sourceFile?.name || 'Audio message' : 'Text message',
      inputAudio: input === 'audio' && sourceFile ? URL.createObjectURL(sourceFile) : '', transcript: submittedText, reply: '',
      audio: '', vad: '', rag: '', sources: [], llmInput: '', status: 'Preparing turn…',
      state: 'running', runtimes: {} }];
    stageRuntimes = {};
    stageStartedAt = 0;
    runtimeTick = performance.now();
    try {
      let audioPath = '';
      let workingAudioFile: File | null = null;
      if (input === 'audio') {
        if (!sourceFile) throw new Error('Choose or record an audio file.');
        step('upload', 'Preparing 16 kHz WAV input…');
        workingAudioFile = new File(
          [await browserDecodeToWav(sourceFile, 16000, 1)], 'pipeline-input.wav', { type: 'audio/wav' });
        audioPath = await uploadAudio(workingAudioFile, aborter.signal);
      }

      if (turnFromMicrophone && workingAudioFile) {
        step('vad', 'Detecting speech activity…');
        const vad = await ensureAudioModel(vadModel, aborter.signal);
        const vadResult = await endpointJson<any>(audioBaseUrl, 'tasks/run', {
          method: 'POST',
          body: JSON.stringify({ model: vad.modelId, audio: audioPath, options: vadRequestOptions() })
        }, aborter.signal);
        vadText = formatVad(vadResult);
        workingAudioFile = await audioForSpeechSegments(workingAudioFile, vadResult);
        audioPath = await uploadAudio(workingAudioFile, aborter.signal);
      }

      let plainTranscript = submittedText;
      if (input === 'audio') {
        step('stt', 'Transcribing speech…');
        const speechModel = await ensureAudioModel(sttModel, aborter.signal);
        const stt = await endpointJson<any>(audioBaseUrl, 'audio/transcriptions/details', {
          method: 'POST',
          body: JSON.stringify({ model: speechModel.modelId, audio: audioPath, language, ...(useHotwords && asrContext.trim() ? { text: asrContext.trim() } : {}) })
        }, aborter.signal);
        plainTranscript = typeof stt.text === 'string' ? traditionalAsrText(stt.text) : '';
      }
      sttText = plainTranscript;
      // Typed text is unchanged; ASR uses Traditional Chinese for display, retrieval and history.
      transcript = plainTranscript;
      if (!transcript.trim()) throw new Error(input === 'audio'
        ? 'Speech recognition returned no text. Try recording again or choose another ASR model.'
        : 'The message is empty.');

      let llmSystemPrompt = systemPrompt.trim();
      if (promptMode !== 'system') {
        step('rag', 'Retrieving receptionist knowledge…');
        const ragResult = promptMode === 'rag'
          ? await ragSearch(audioBaseUrl, transcript, ragResultCount, aborter.signal)
          : await graphSearch(audioBaseUrl, transcript, ragSearchMode, ragResultCount, aborter.signal);
        ragText = graphContext(ragResult);
        ragSources = graphCitations(ragResult);
        if (!ragText) throw new Error('RAG returned no relevant knowledge.');
        llmSystemPrompt = `${systemPrompt.trim()}\n\n# 本次檢索參考資料\n\n以下資料用於查核部門、聯絡窗口與轉接規則。先理解來電需求，再依上方接線對照與回覆格式使用相關檢索事實；檢索資料不得覆蓋系統提示中的聯絡對照。已能選定唯一窗口時不要再詢問廠區、承辦人或分機。不要朗讀來源、分數或檢索格式；未提供的分機不可推測。\n\n${ragText}`;
      }

      const messages: ChatMessage[] = [];
      if (llmSystemPrompt) messages.push({ role: 'system', content: llmSystemPrompt });
      messages.push(...chatHistory, { role: 'user', content: transcript });
      llmInputPreview = formatChatMessages(messages);
      if (useLlm) {
        step('llm', 'Generating an instruct-model response…');
        const llm = await endpointJson<any>(llmBaseUrl, 'chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: llmModel, messages, temperature, max_tokens: maxTokens, stream: false }),
          signal: aborter.signal
        }, aborter.signal);
        llmResponse = traditionalChineseText(chatText(llm));

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
        // Preserve the user message when the LLM is bypassed.
        llmResponse = transcript;
      }

      chatHistory = [...chatHistory, { role: 'user', content: transcript }, { role: 'assistant', content: llmResponse }];

      if (useTts) {
        step('tts', 'Synthesizing the response…');
        const voiceModel = await ensureAudioModel(ttsModel, aborter.signal);
        const speechBody: Record<string, unknown> = { model: voiceModel.modelId, input: llmResponse, response_format: 'wav' };
        if (cloneVoiceFile && supportsVoiceClone) {
          if (['qwen3_tts', 'zipvoice'].includes(voiceModel.family || '') && !cloneReferenceText.trim()) {
            throw new Error('Voice cloning requires the matching reference transcript.');
          }
          speechBody.voice_ref = await uploadAudio(cloneVoiceFile, aborter.signal, 24000);
          if (cloneReferenceText.trim()) speechBody.reference_text = cloneReferenceText.trim();
        } else if (voice) {
          speechBody.voice = voice;
        }
        const output = await endpointBlob(audioBaseUrl, 'audio/speech', speechBody, aborter.signal);
        outputUrl = URL.createObjectURL(output);
      }
      step('done', 'Pipeline complete.');
      updateTurn({ state: 'complete' });
      save();
    } catch (error) {
      updateTurn({ state: 'failed' });
      finishActiveStage();
      stage = 'idle';
      status = error instanceof Error && error.name === 'AbortError' ? 'Pipeline stopped.' : error instanceof Error ? error.message : String(error);
    } finally {
      await tick();
      activeTurnId = '';
      running = false;
    }
  }

  onMount(() => {
    audioBaseUrl = new URL('v1/', document.baseURI).toString().replace(/\/$/, '');
    llmBaseUrl = location.protocol === 'https:'
      ? new URL('llm/v1/', document.baseURI).toString().replace(/\/$/, '')
      : siblingWorkerEndpoint(8082);
    try {
      const saved = JSON.parse(localStorage.getItem('audiocpp.conversation.settings') || '{}');
      audioBaseUrl = saved.audioBaseUrl || audioBaseUrl;
      llmBaseUrl = saved.llmBaseUrl || llmBaseUrl;
      asrContext = saved.asrContext ?? defaultAsrContext;
      useHotwords = typeof saved.useHotwords === 'boolean' ? saved.useHotwords : true;
      vadModel = saved.vadModel || vadModel;
      sileroVadSettings = normalizeVadSettings(saved.sileroVadSettings || sileroVadSettings);
      vadUseLongestSilence = typeof saved.vadUseLongestSilence === 'boolean' ? saved.vadUseLongestSilence : true;
      sttModel = saved.sttModel || sttModel;
      llmModel = saved.llmModel || '';
      ttsModel = saved.ttsModel || ttsModel;
      voice = saved.voice || '';
      language = saved.language || '';
      promptMode = saved.promptDefaultsVersion === 2 && (saved.promptMode === 'rag' || saved.promptMode === 'graphrag')
        ? saved.promptMode
        : 'system';
      ragResultCount = Math.max(1, Math.min(20, Number(saved.ragResultCount ?? ragResultCount) || ragResultCount));
      ragSearchMode = saved.ragSearchMode === 'global' ? 'global' : 'local';
      temperature = Number(saved.temperature ?? temperature);
      maxTokens = Number(saved.maxTokens ?? maxTokens);
    } catch { /* use defaults */ }
    refreshPrompts();
    refreshAll();
    refreshSavedCloneVoices();
    runtimeTimer = setInterval(() => {
      if (running && stageStartedAt) runtimeTick = performance.now();
    }, 100);
  });

  onDestroy(() => {
    if (runtimeTimer) clearInterval(runtimeTimer);
    aborter?.abort();
    cancelCloneRecording();
    stopMicrophone();
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    clearConversation();
  });
</script>

<section class="page-head pipeline-head">
  <p class="eyebrow">VOICE CONVERSATION PIPELINE</p>
  <h1>Interactive Voice Response</h1>
  <p>DetectSpeech.VAD → SpeechToText.ASR → KnowledgeBase.RAG → LanguageModel.LLM → TextToSpeech.TTS</p>
</section>

<section class="pipeline-steps" aria-label="Pipeline progress">
  {#each pipelineSteps as item, index}
    {@const elapsed = stageRuntime(item[0], runtimeTick)}
    <div class:active={stage === item[0]} class:complete={stage === 'done' || pipelineSteps.findIndex((entry) => entry[0] === stage) > index}>
      <span>{index + 1}</span>
      <div>
        <strong>{item[1]}</strong>
        {#if elapsed !== undefined}<small>{formatStageRuntime(elapsed)}</small>{/if}
      </div>
    </div>
  {/each}
</section>

<div class="pipeline-grid conversation-grid">
  <section class="panel page-panel pipeline-config">
    <div class="section-title"><div><span>SETTINGS</span><h2>Pipeline</h2></div></div>
    <fieldset class="pipeline-settings-fields" disabled={running}>
    <p class="field-help">VAD</p>
    {#if selectedVadIsSilero}
      <details>
        <summary>VAD settings</summary>
        <p class="field-help">Used for continuous microphone detection and speech cropping before ASR. Microphone detection checks roughly one second of audio at a time; these durations control segments within each check.</p>
        <div class="field-grid compact-fields">
          {#each sileroVadFields as field}
            <label>{field.label}
              <input type="number" min={field.min} max={field.max} step={field.step} bind:value={sileroVadSettings[field.key]} on:change={saveVadSettings} />
              <small class="field-help">{field.help}</small>
            </label>
          {/each}
        </div>
        <label><input type="checkbox" bind:checked={vadUseLongestSilence} on:change={save} />Split at the longest pause when maximum segment duration is reached</label>
        <button type="button" on:click={resetVadSettings}>Reset VAD defaults</button>
      </details>
    {/if}
    <label class="toggle pipeline-toggle"><input type="checkbox" role="switch" bind:checked={useHotwords} on:change={save} /><span aria-hidden="true"></span>Use hotwords</label>
    <label>Context prompt (optional)<textarea rows="2" bind:value={asrContext} on:change={save} placeholder="Terminology or names to recognize"></textarea></label>
    <div class="prompt-actions"><button on:click={saveAsrContextCsv}>Save CSV</button></div>
    <label>ASR language<input bind:value={language} placeholder="auto" on:change={save} /></label>
    {#if useTts}
      <div class="field-grid">
        <label>TTS voice<select bind:value={voice} disabled={cloneRecordingBusy} on:change={() => { if (voice) clearCloneVoice(); save(); }}><option value="">Default voice</option>{#each voices as item}<option value={item}>{item}</option>{/each}</select></label>
      </div>
    {/if}
    {#if useTts && supportsVoiceClone}
      <div class="pipeline-clone-voice">
        <div class="section-title"><div><span>VOICE CLONE</span><h2>Reference voice</h2></div></div>
        <input hidden class="hidden-file" bind:this={cloneVoiceInput} type="file" accept="audio/*" on:change={(event) => chooseCloneVoice(event.currentTarget.files?.[0] || null)} />
        <div class="media-actions">
          <button type="button" disabled={cloneRecordingBusy} on:click={() => cloneVoiceInput?.click()}>Choose reference audio</button>
          {#if cloneRecording}
            <button type="button" class="danger" on:click={finishCloneRecording}>Stop recording</button>
          {:else}
            <button type="button" disabled={cloneRecordingBusy} on:click={startCloneRecording}>Record reference voice</button>
          {/if}
          {#if cloneRecordingBusy}<button type="button" on:click={cancelCloneRecording}>Cancel recording</button>{/if}
          <button type="button" disabled={!cloneVoiceFile || cloneRecordingBusy} on:click={clearCloneVoice}>Clear</button>
          {#if cloneVoiceFile}<span>{cloneVoiceFile.name}</span>{/if}
        </div>
        {#if cloneRecordingStatus}<p class="field-help" role="status">{cloneRecordingStatus}</p>{/if}
        <p class="field-help">Record a short, clear sample, then stop and enter the matching transcript. Conversation listening stops while you record.</p>
        <MediaPreview file={cloneVoiceFile} kind="audio" label="Reference preview" />
        <label>Reference transcript<textarea rows="2" bind:value={cloneReferenceText} placeholder="Exact words spoken in the reference audio"></textarea></label>
        <div class="voice-library pipeline-voice-library">
          <label>Saved voices<select value={savedCloneVoiceId} disabled={cloneRecordingBusy} on:change={(event) => chooseSavedCloneVoice(event.currentTarget.value)}><option value="">Choose saved voice…</option>{#each savedCloneVoices as item}<option value={item.id}>{item.name}</option>{/each}</select></label>
          <label>Voice name<input bind:value={cloneVoiceName} placeholder="Reference voice name" /></label>
          <div class="library-actions">
            <button type="button" disabled={!cloneVoiceFile || savingCloneVoice || cloneRecordingBusy} on:click={storeCloneVoice}>{savingCloneVoice ? 'Saving…' : 'Save voice'}</button>
            <button class="danger" type="button" disabled={!savedCloneVoiceId || cloneRecordingBusy} on:click={removeCloneVoice}>Delete</button>
          </div>
        </div>
      </div>
    {/if}
    <div class="pipeline-input">
    <div class="section-title"><div><span>INPUT</span><h2>Instructions</h2></div></div>
    <label>LLM grounding<select bind:value={promptMode} on:change={save}><option value="system">System prompt (prompt.csv)</option><option value="rag">Regular RAG (hybrid retrieval)</option><option value="graphrag">GraphRAG (knowledge graph)</option></select></label>
    {#if promptMode === 'system'}
      <label>System prompt (prompt.csv)<textarea bind:value={systemPrompt} rows="6"></textarea></label>
      <div class="prompt-actions"><button on:click={saveSystemPromptCsv}>Save CSV</button></div>
    {:else}
      <p class="field-help">Each message retrieves related terms and rules from the local knowledge base before the LLM runs.</p>
      <div class="field-grid compact-fields">
        {#if promptMode === 'graphrag'}
          <label>Graph search<select bind:value={ragSearchMode} on:change={save}><option value="local">Local — related passages</option><option value="global">Global — community overview</option></select></label>
        {/if}
        <label>Results<input type="number" min="1" max="20" step="1" bind:value={ragResultCount} on:change={save} /></label>
      </div>
    {/if}

    </div>
    </fieldset>
  </section>

  <section class="panel page-panel pipeline-results conversation-panel">
    <div class="section-title"><div><span>CHATBOT</span><h2>Conversation</h2></div><button disabled={running || !turns.length} on:click={clearConversation}>New conversation</button></div>
    <div class="conversation-turns" bind:this={conversationLog} role="log" aria-label="Voice conversation">
      {#each turns as turn, index (turn.id)}
        <div class="conversation-turn">
          <article class="pipeline-message user"><span>YOU · TURN {index + 1}</span><p>{turn.name}</p>
            {#if turn.inputAudio}<audio controls src={turn.inputAudio}></audio>{/if}
            {#if turn.transcript}<p>{turn.transcript}</p>{/if}
          </article>
          {#if turn.reply || turn.audio}
            <article class="pipeline-message assistant"><span>ASSISTANT</span><p>{turn.reply}</p>
              {#if turn.audio}<div class="pipeline-audio"><audio controls autoplay use:autoplaySpeech src={turn.audio} on:play={() => replyPlaying = true} on:pause={() => replyPlaying = false} on:ended={() => replyPlaying = false}></audio><a href={turn.audio} download={`voice-response-${index + 1}.wav`}>Save WAV</a></div>{/if}
            </article>
          {/if}
          <p class="field-help" class:turn-error={turn.state === 'failed'}>{turn.status}</p>
          <details class="turn-details"><summary>Pipeline details</summary>
            {#if turn.vad}<article class="pipeline-message diarization"><span>VAD</span><p>{turn.vad}</p></article>{/if}
            {#if turn.rag}<article class="pipeline-message diarization"><span>RAG</span><p>{turn.rag}</p></article>{/if}
            {#if turn.sources.length}<div class="rag-citations"><strong>Sources</strong>{#each turn.sources as citation}<code>{citation}</code>{/each}</div>{/if}
            {#if turn.llmInput}<label class="llm-input-preview">LLM input<textarea readonly rows="8" value={turn.llmInput}></textarea></label>{/if}
            {#each Object.entries(turn.runtimes) as [name, elapsed]}<p class="field-help">{name.toUpperCase()}: {formatStageRuntime(elapsed)}</p>{/each}
          </details>
        </div>
      {:else}
        <div class="empty-output"><div class="wave">∿</div><p>Type a message, choose an example, upload audio, or record a message to start a conversation.</p></div>
      {/each}
    </div>
    {#if playbackStatus}<p class="field-help">{playbackStatus}</p>{/if}
    <div class="conversation-composer">
    <label for="pipeline-message">Message</label>
    <div class="message-box" class:listening={microphoneListening}>
      <div class="message-box-input">
        <textarea id="pipeline-message" class="chat-text-input" rows="3" bind:value={textInput} disabled={running || cloneRecordingBusy} placeholder="Type a message… (Ctrl+Enter to send)" on:keydown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
            event.preventDefault();
            runPipeline('text');
          }
        }}></textarea>
        <div class="composer-actions">
          <button class="microphone-toggle" class:danger={microphoneListening || microphoneStarting} aria-label={microphoneListening || microphoneStarting ? 'Stop listening' : 'Start listening'} title={microphoneListening || microphoneStarting ? 'Stop continuous microphone' : 'Start continuous microphone'} aria-pressed={microphoneListening || microphoneStarting} disabled={!(microphoneListening || microphoneStarting) && (cloneRecordingBusy || running || !sttModel || !vadModel)} on:click={toggleMicrophone}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></svg>
          </button>
          <button class="primary send-text" disabled={running || !canSendText} on:click={() => runPipeline('text')}>Send text</button>
        </div>
      </div>
      <div class="composer-feedback">
        <span role="status">{microphoneStatus}</span>
        {#if microphoneListening || microphoneStarting}
          <svg class="microphone-waveform" class:paused={running || replyPlaying} viewBox="0 0 192 40" role="img" aria-label={running || replyPlaying ? 'Microphone listening paused' : 'Live microphone waveform'}>
            {#each microphoneWaveform as height, index}<rect x={index * 4} y={(40 - height) / 2} width="2" {height} rx="1" />{/each}
          </svg>
        {:else}
          <small>Ctrl+Enter to send · Enter for a new line</small>
        {/if}
      </div>
    </div>
    <input hidden bind:this={sourceInput} type="file" accept="audio/*" on:change={(event) => chooseFile(event.currentTarget.files?.[0] || null)} />
    <div class="audio-drop">
      <div class="pipeline-audio-choice">
        <div><strong>{sourceFile?.name || 'No audio selected'}</strong><small>WAV, MP3, or FLAC</small></div>
        <button disabled={running} on:click={() => sourceInput?.click()}>Choose audio</button>
      </div>
      <div class="pipeline-example-audio">
        <span>Example audio</span>
        {#each exampleAudioFiles as example}
          <button disabled={running} type="button" on:click={() => chooseExampleAudio(example)}>{example.name}</button>
        {/each}
      </div>
      {#if inputUrl}<audio class="pipeline-input-audio" controls src={inputUrl}></audio>{/if}
    </div>
    <div class="page-runbar pipeline-audio-runbar">
      <span class:busy={running}>{status}</span>
      {#if running}<button on:click={() => aborter?.abort()}>Stop</button>{/if}
      <button class="primary" disabled={running || !canSendAudio} on:click={() => runPipeline('audio')}>{running ? 'Running…' : 'Send audio'}</button>
    </div>
    </div>
    {#if useTts && selectedTtsModel?.family === 'zipvoice' && !voice && (!cloneVoiceFile || !cloneReferenceText.trim())}<p class="field-help">Choose reference audio and enter its matching transcript to enable ZipVoice cloning.</p>{/if}
  </section>
</div>
