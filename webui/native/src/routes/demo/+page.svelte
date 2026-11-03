<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { Mic, MicOff, Phone, PhoneOff, Send, Trash2 } from "@lucide/svelte";
  import logo from "../../../static/logo_cloud.svg?raw";
  import "../../app.css";
  import { browserDecodeToWav, encodePcm16Wav } from "$lib/audio";
  import { readGreetingCsv, writeGreetingCsv } from "$lib/greetings";
  import { recognitionContext } from "$lib/asr-context";
  import { uploadWav } from "$lib/api";
  import {
    maintenanceScenarioSteps,
    maintenanceScenarioPrompt,
    maintenanceSpeechText,
  } from "$lib/maintenance-scenario";
  import centralAudio from "../../../../../assets/resources/中央監控站2.mp3?url";
  import controlAudio from "../../../../../assets/resources/中控室.mp3?url";
  import employeeAudio from "../../../../../assets/resources/員工檢查哨.mp3?url";
  import lobbyAudio from "../../../../../assets/resources/大廳.mp3?url";
  import vehicleAudio from "../../../../../assets/resources/車輛檢查哨.mp3?url";

  import {
    endpointJson,
    endpointBlob,
    routerEndpoint,
    chatText,
    type ChatMessage,
  } from "$lib/openai";
  import {
    discoverDemoAudioModels,
    discoverDemoLlmModels,
    preferredDemoModel,
    type DemoAudioModel,
    type DemoLlmModel,
    LFM_DEMO_REF,
    isDemoLfmModel,
  } from "$lib/demo-models";
  type Event = {
    time: string;
    run: string;
    type: string;
    summary: string;
    runtimeMs?: number | null;
  };
  let scenarioMode: "audio" | "maintenance" = "audio";
  let scenarioFile: File | null = null,
    scenarioAudioName = "",
    scenarioStatus = "";
  let transcriptElement: HTMLDivElement | null = null;
  $: if (messages.length) void scrollTranscript(messages.length);
  async function scrollTranscript(_count: number) {
    await tick();
    if (transcriptElement)
      transcriptElement.scrollTop = transcriptElement.scrollHeight;
  }
  let scenarioRunning = false,
    scenarioStep = 0,
    scenarioToken = 0;
  let playbackRole: "assistant" | "technician" = "assistant";
  const scenarioAudioExamples = [
    { name: "中央監控站2.mp3", url: centralAudio },
    { name: "中控室.mp3", url: controlAudio },
    { name: "員工檢查哨.mp3", url: employeeAudio },
    { name: "大廳.mp3", url: lobbyAudio },
    { name: "車輛檢查哨.mp3", url: vehicleAudio },
  ];
  $: technicianVoice = voiceChoices.find((id) => id !== voice) || "";
  let events: Event[] = [],
    messages: ChatMessage[] = [];
  let connected = false,
    starting = false,
    muted = false,
    busy = false,
    speaking = false;
  let status = "Ready to connect",
    input = "",
    run = "",
    error = "";
  let audioModels: DemoAudioModel[] = [],
    llmModels: DemoLlmModel[] = [];
  let vadKey = "",
    asrKey = "",
    ttsKey = "",
    llm = "";
  let useVad = true,
    useAsr = true,
    useLlm = true,
    useTts = true;
  let manualRecording = false,
    manualParts: Float32Array[] = [];
  let llmDownloading = false,
    llmPolling = false,
    llmDownloadStatus = "";
  let llmDownloadTimer: ReturnType<typeof setTimeout> | undefined;
  let llmDownloadEvents: EventSource | null = null;
  $: selectedLlm = llmModels.find((m) => m.id === llm);
  $: llmNeedsDownload = !!selectedLlm?.requiresDownload;
  let discovering = false,
    modelError = "";
  $: vadModels = audioModels.filter((m) => m.task === "vad");
  $: asrModels = audioModels.filter((m) => ["asr", "stt"].includes(m.task));
  $: ttsModels = audioModels.filter((m) => ["tts", "clon"].includes(m.task));
  $: selectedVad = audioModels.find((m) => m.key === vadKey);
  $: selectedAsr = audioModels.find((m) => m.key === asrKey);
  $: selectedTts = audioModels.find((m) => m.key === ttsKey);
  $: canCall = !!(
    (!useAsr || (selectedAsr && (!useVad || selectedVad))) &&
    (!useLlm || (selectedLlm && !llmNeedsDownload)) &&
    (!useTts || (selectedTts && greeting.trim())) &&
    ((!useLlm && !useTts) || filesReady)
  );
  function idleStatus() {
    return !useAsr
      ? "Ready for text"
      : muted
        ? "Microphone muted"
        : !useVad
          ? "Ready · record a voice turn"
          : "Listening";
  }
  function toggleManualTurn() {
    if (!connected || !useAsr || useVad || busy || muted || !context) return;
    if (!manualRecording) {
      manualParts = [];
      manualRecording = true;
      status = "Recording voice turn…";
      return;
    }
    const parts = manualParts;
    manualParts = [];
    manualRecording = false;
    if (parts.length) void respond("", wav(parts, context));
    else status = idleStatus();
  }
  async function refreshModels() {
    discovering = true;
    modelError = "";
    const result = await Promise.allSettled([
      discoverDemoAudioModels(),
      discoverDemoLlmModels(llmBase()),
    ]);
    if (result[0].status === "fulfilled") {
      audioModels = result[0].value;
      vadKey = preferredDemoModel(
        audioModels.filter((m) => m.task === "vad"),
        vadKey,
        "silero-vad",
      );
      asrKey = preferredDemoModel(
        audioModels.filter((m) => ["asr", "stt"].includes(m.task)),
        asrKey,
        "audio8-asr",
      );
      ttsKey = preferredDemoModel(
        audioModels.filter((m) => ["tts", "clon"].includes(m.task)),
        ttsKey,
        "zipvoice",
      );
    } else {
      audioModels = [];
      modelError = `Audio models: ${result[0].reason}`;
    }
    if (result[1].status === "fulfilled") {
      llmModels = result[1].value;
      if (!llmModels.some((m) => m.id === llm))
        llm =
          llmModels.find((m) => !m.requiresDownload && isDemoLfmModel(m.id))
            ?.id ||
          llmModels.find((m) => !m.requiresDownload)?.id ||
          llmModels[0]?.id ||
          "";
    } else {
      llmModels = [];
      llm = "";
      modelError += ` LLM models: ${result[1].reason}`;
    }
    discovering = false;
  }
  function stopLlmDownloadWatch() {
    clearTimeout(llmDownloadTimer);
    llmDownloadEvents?.close();
    llmDownloadEvents = null;
  }
  async function pollLlmDownload() {
    if (!llmDownloading || llmPolling) return;
    clearTimeout(llmDownloadTimer);
    llmPolling = true;
    try {
      const discovered = await discoverDemoLlmModels(llmBase());
      if (!llmDownloading) return;
      llmModels = discovered;
      const ready = discovered.find(
        (m) => !m.requiresDownload && isDemoLfmModel(m.id),
      );
      if (ready) {
        if (
          !connected &&
          !starting &&
          (llm === LFM_DEMO_REF || !discovered.some((m) => m.id === llm))
        )
          llm = ready.id;
        llmDownloading = false;
        llmDownloadStatus = "LFM2.5 Q4_K_M downloaded and ready";
        stopLlmDownloadWatch();
      }
    } catch (cause) {
      llmDownloadStatus = `Download requested; waiting for llama.cpp: ${cause instanceof Error ? cause.message : cause}`;
    } finally {
      llmPolling = false;
      if (llmDownloading && mounted)
        llmDownloadTimer = setTimeout(() => void pollLlmDownload(), 3000);
    }
  }
  async function downloadLfmModel() {
    if (llmDownloading || connected || starting) return;
    llmDownloading = true;
    llmDownloadStatus = "Downloading LFM2.5 Q4_K_M…";
    stopLlmDownloadWatch();
    const handleEvent = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data),
          type = payload.event || event.type;
        if (type === "download_failed") {
          llmDownloading = false;
          llmDownloadStatus = `Download failed: ${payload.data?.message || payload.message || event.data}`;
          stopLlmDownloadWatch();
        } else if (type === "download_finished") void pollLlmDownload();
      } catch {
        /* Ignore unrelated router status messages. */
      }
    };
    llmDownloadEvents = new EventSource(
      routerEndpoint(llmBase(), "models/sse"),
    );
    llmDownloadEvents.onmessage = handleEvent;
    llmDownloadEvents.addEventListener("download_finished", (e) =>
      handleEvent(e as MessageEvent),
    );
    llmDownloadEvents.addEventListener("download_failed", (e) =>
      handleEvent(e as MessageEvent),
    );
    llmDownloadEvents.onerror = () => {
      llmDownloadEvents?.close();
      llmDownloadEvents = null;
    };
    try {
      const response = await fetch(routerEndpoint(llmBase(), "models"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: LFM_DEMO_REF }),
      });
      if (!response.ok)
        throw new Error(`${response.status} ${await response.text()}`);
      await pollLlmDownload();
    } catch (cause) {
      llmDownloading = false;
      llmDownloadStatus = `Download failed: ${cause instanceof Error ? cause.message : cause}`;
      stopLlmDownloadWatch();
    }
  }
  let prompt =
    "你是現場維修保養的語音助理。請用繁體中文簡短回答，準確保留工單、設備代碼及數字。";
  const defaultReferenceText =
    "你好我是語音助手 請問您需要什麼服務 如果需要轉接請按分機號碼";
  let threshold = 0.5,
    windowMs = 650,
    voiceFile: File | null = null,
    referenceText = defaultReferenceText,
    referencePath = "";
  let hotwords = "";
  let greeting = "您好，這裡是 GeoVision IVR，請問需要什麼協助？";
  let filesReady = false,
    savingGreeting = false,
    savingPrompt = false,
    fileStatus = "";
  let previousTheme: string | undefined;
  let mounted = false,
    greetingStatus = "",
    greetingPreparing = false;
  let greetingTimer: ReturnType<typeof setTimeout> | undefined;
  let greetingAborter: AbortController | null = null;
  let greetingPromise: Promise<Blob | null> | null = null;
  let preparedGreeting: Blob | null = null,
    preparedKey = "",
    preparingKey = "";
  let cloneRecorder: MediaRecorder | null = null,
    cloneStream: MediaStream | null = null;
  let cloneRecording = false,
    cloneBusy = false,
    cloneStatus = "";
  let cloneAborter: AbortController | null = null;
  let voice = "lingCLvocals";
  $: voiceChoices = selectedTts?.builtin_voices?.length
    ? selectedTts.builtin_voices
    : ["lingCLvocals", "wangSG9s"];
  $: if (!voiceChoices.includes(voice))
    voice = selectedTts?.default_voice || voiceChoices[0];
  $: supportsReference =
    selectedTts?.task === "clon" ||
    ["audio8_tts", "voxcpm1", "qwen3_tts"].includes(selectedTts?.family || "");
  $: scheduleGreeting(
    mounted && filesReady && useTts,
    connected || starting,
    ttsKey,
    voice,
    voiceFile,
    referenceText,
    greeting,
    cloneRecording || cloneBusy,
  );
  let inputBars = Array(36).fill(2),
    outputBars = Array(36).fill(2);
  let stream: MediaStream | null = null,
    context: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null,
    source: MediaStreamAudioSourceNode | null = null;
  let gain: GainNode | null = null,
    analyser: AnalyserNode | null = null,
    player: AudioBufferSourceNode | null = null;
  let controller: AbortController | null = null,
    animation = 0,
    epoch = 0,
    detecting = false;
  let windows: Float32Array[] = [],
    frames = 0,
    utterance: Float32Array[] = [],
    preRoll: Float32Array | null = null;
  const historyKey = "geovision.demo.events.v1";
  const llmBase = () => new URL("/llm/v1/", location.href).toString();
  function record(
    type: string,
    summary: string,
    runtimeMs: number | null = null,
  ) {
    events = [
      { time: new Date().toISOString(), run, type, summary, runtimeMs },
      ...events,
    ].slice(0, 300);
    try {
      localStorage.setItem(historyKey, JSON.stringify(events));
    } catch {}
  }
  function runtimeLabel(value: number | null | undefined) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? `${value.toFixed(2)} ms`
      : "—";
  }
  function fail(cause: unknown, runtimeMs: number | null = null) {
    error = cause instanceof Error ? cause.message : String(cause);
    status = "Error";
    record("ERROR", error, runtimeMs);
  }
  function reset() {
    windows = [];
    frames = 0;
    utterance = [];
    preRoll = null;
  }
  function bars(samples: Float32Array) {
    return Array.from({ length: 36 }, (_, i) => {
      let energy = 0;
      const a = Math.floor((i * samples.length) / 36),
        b = Math.floor(((i + 1) * samples.length) / 36);
      for (let j = a; j < b; j++) energy += samples[j] ** 2;
      return Math.max(
        2,
        Math.min(64, Math.sqrt(energy / Math.max(1, b - a)) * 260),
      );
    });
  }
  function wav(parts: Float32Array[], ctx: AudioContext) {
    const buffer = ctx.createBuffer(
      1,
      parts.reduce((n, p) => n + p.length, 0),
      ctx.sampleRate,
    );
    let offset = 0;
    for (const part of parts) {
      buffer.getChannelData(0).set(part, offset);
      offset += part.length;
    }
    return encodePcm16Wav(buffer);
  }
  async function load(key: string, signal: AbortSignal, announce = true) {
    const model = audioModels.find((m) => m.key === key);
    if (!model)
      throw new Error(
        "The selected model is no longer available. Refresh models.",
      );
    const id = `demo-${model.id}`;
    if (announce) status = `Loading ${model.label}…`;
    await endpointJson(
      "",
      "models/load",
      {
        method: "POST",
        body: JSON.stringify({
          id,
          family: model.family,
          path: model.path,
          task: model.task,
          mode: "offline",
          load_options: model.load_options || {},
          session_options: model.session_options || {},
        }),
      },
      signal,
    );
    return id;
  }
  async function detect(samples: Float32Array, generation: number) {
    const ctx = context,
      signal = controller?.signal;
    if (!ctx || !signal || detecting || busy || speaking || muted) return;
    detecting = true;
    const started = performance.now();
    try {
      // VAD runs for every capture window; keep the listening status stable.
      const vadId = await load(vadKey, signal, false);
      const audio = await uploadWav(
        await browserDecodeToWav(
          new File([wav([samples], ctx)], "vad.wav"),
          16000,
          1,
        ),
        signal,
      );
      const result = await endpointJson<any>(
        "",
        "tasks/run",
        {
          method: "POST",
          body: JSON.stringify({
            model: vadId,
            audio,
            options:
              selectedVad?.family === "silero_vad"
                ? {
                    threshold: String(threshold),
                    min_speech_duration_ms: "100",
                  }
                : {},
          }),
        },
        signal,
      );
      if (epoch !== generation || muted || !connected) return;
      const speech = (result.segments || result.speech_segments || []).some(
        (s: any) => s.end_sample > s.start_sample,
      );
      if (speech || utterance.length)
        record(
          "VAD_COMPLETED",
          speech ? "Speech detected" : "End of speech",
          performance.now() - started,
        );
      if (speech) {
        if (!utterance.length) {
          record("USER_STATE_CHANGED", "listening → speaking");
          if (preRoll) utterance.push(preRoll);
        }
        utterance.push(samples);
      } else if (utterance.length) utterance.push(samples);
      else preRoll = samples;
      if (
        utterance.length &&
        (!speech ||
          utterance.reduce((n, p) => n + p.length, 0) >= ctx.sampleRate * 15)
      ) {
        const clip = wav(utterance, ctx);
        reset();
        await respond("", clip, generation);
      } else status = speech ? "Listening · speech detected" : "Listening";
    } catch (cause) {
      if (epoch === generation && !signal.aborted) {
        fail(cause, performance.now() - started);
        hangup(false);
      }
    } finally {
      if (epoch === generation) detecting = false;
    }
  }
  async function respond(
    text: string,
    audio?: Blob,
    generation = epoch,
    options: { speakTechnician?: boolean; playInputAudio?: boolean } = {},
  ) {
    const signal = controller?.signal;
    if (!connected || busy || !signal) return;
    busy = true;
    error = "";
    reset();
    const turnStarted = performance.now();
    let operationStarted = turnStarted;
    try {
      if (audio && options.playInputAudio) {
        await playAudio(audio, generation, "technician");
        if (signal.aborted || generation !== epoch) return;
        operationStarted = performance.now();
      }
      if (audio && useAsr) {
        const asrId = await load(asrKey, signal);
        const path = await uploadWav(
          await browserDecodeToWav(new File([audio], "turn.wav"), 16000, 1),
          signal,
        );
        status = "Transcribing";
        const result = await endpointJson<{ text: string }>(
          "",
          "audio/transcriptions/details",
          {
            method: "POST",
            body: JSON.stringify({
              model: asrId,
              audio: path,
              ...(hotwords.trim()
                ? {
                    text: recognitionContext(
                      hotwords.trim(),
                      selectedAsr?.family || "",
                    ),
                  }
                : {}),
            }),
          },
          signal,
        );
        text = result.text?.trim();
        if (!text) {
          record(
            "ASR_EMPTY",
            "No speech recognized",
            performance.now() - operationStarted,
          );
          return;
        }
        record(
          "USER_INPUT_TRANSCRIBED",
          text,
          performance.now() - operationStarted,
        );
      }
      if (generation !== epoch) return;
      messages = [...messages, { role: "user", content: text }];
      record("CONVERSATION_ITEM_ADDED", `USER · ${text}`);
      if (options.speakTechnician && useTts) {
        if (!technicianVoice)
          throw new Error(
            "Choose a TTS model with two built-in voices for the scenario.",
          );
        operationStarted = performance.now();
        const id = await load(ttsKey, signal);
        status = "Synthesizing technician voice";
        const audio = await endpointBlob(
          "",
          "audio/speech",
          {
            model: id,
            input: maintenanceSpeechText(text),
            voice: technicianVoice,
            response_format: "wav",
          },
          signal,
        );
        record(
          "TECHNICIAN_TTS_COMPLETED",
          technicianVoice,
          performance.now() - operationStarted,
        );
        const wallMs = await playAudio(audio, generation, "technician");
        if (signal.aborted || generation !== epoch) return;
        record("TECHNICIAN_PLAYED", text, wallMs);
      }

      let reply = text;
      if (useLlm) {
        status = "Thinking";
        record("AGENT_STATE_CHANGED", "listening → thinking");
        operationStarted = performance.now();
        const response = await endpointJson<any>(
          llmBase(),
          "chat/completions",
          {
            method: "POST",
            body: JSON.stringify({
              model: llm,
              messages: [
                {
                  role: "system",
                  content: options.speakTechnician
                    ? maintenanceScenarioPrompt
                    : prompt,
                },
                ...messages,
              ],
              max_tokens: 256,
              temperature: 0.4,
              stream: false,
            }),
          },
          signal,
        );
        reply = chatText(response).trim();
        if (!reply)
          throw new Error("The language model returned an empty reply.");
        if (generation !== epoch) return;
        record("LLM_COMPLETED", llm, performance.now() - operationStarted);
      } else record("LLM_SKIPPED", "Input text passed through");
      if (!useLlm && !useTts) {
        record("TTS_SKIPPED", "Text output only");
        record(
          "TURN_COMPLETED",
          "Transcription/text turn complete",
          performance.now() - turnStarted,
        );
        return;
      }
      messages = [...messages, { role: "assistant", content: reply }];
      record("CONVERSATION_ITEM_ADDED", `ASSISTANT · ${reply}`);
      if (useTts) {
        operationStarted = performance.now();
        const ttsId = await load(ttsKey, signal);
        status = "Synthesizing";
        const body: Record<string, unknown> = {
          model: ttsId,
          input: options.speakTechnician ? maintenanceSpeechText(reply) : reply,
          response_format: "wav",
        };
        if (referencePath && supportsReference) {
          body.voice_ref = referencePath;
          body.reference_text = referenceText;
        } else {
          body.voice = voice;
        }
        const output = await endpointBlob("", "audio/speech", body, signal);
        if (generation !== epoch) return;
        record(
          "TTS_COMPLETED",
          selectedTts?.label || "Speech synthesized",
          performance.now() - operationStarted,
        );
        operationStarted = performance.now();
        const playbackMs = await playAudio(output, generation);
        if (generation !== epoch || signal.aborted) return;
        record("PLAYBACK_COMPLETED", "Assistant reply played", playbackMs);
      } else record("TTS_SKIPPED", "Text response only");
      record(
        "TURN_COMPLETED",
        audio ? "Voice turn complete" : "Text turn complete",
        performance.now() - turnStarted,
      );
    } catch (cause) {
      if (generation === epoch && !signal.aborted)
        fail(cause, performance.now() - operationStarted);
    } finally {
      if (generation === epoch) {
        busy = false;
        reset();
        if (!error) status = idleStatus();
      }
    }
  }
  async function loadCsvFiles() {
    try {
      const [savedGreeting, savedPrompt] = await Promise.all([
        endpointJson<{ content: string }>("", "ui/greetings"),
        endpointJson<{ content: string }>("", "ui/prompt"),
      ]);
      greeting = readGreetingCsv(savedGreeting.content);
      prompt = savedPrompt.content;
      filesReady = true;
      fileStatus = "Loaded greetings.csv and prompt.csv";
    } catch (cause) {
      fileStatus = `CSV load failed: ${cause instanceof Error ? cause.message : cause}`;
    }
  }
  async function saveGreetingCsv() {
    savingGreeting = true;
    try {
      const content = writeGreetingCsv(greeting);
      const saved = await endpointJson<{ content: string }>(
        "",
        "ui/greetings",
        { method: "POST", body: JSON.stringify({ content }) },
      );
      greeting = readGreetingCsv(saved.content);
      fileStatus = "Saved greetings.csv";
      if (useTts) await prepareGreeting();
    } catch (cause) {
      fileStatus = `Greeting save failed: ${cause instanceof Error ? cause.message : cause}`;
    } finally {
      savingGreeting = false;
    }
  }
  async function savePromptCsv() {
    savingPrompt = true;
    try {
      await endpointJson("", "ui/prompt", {
        method: "POST",
        body: JSON.stringify({ content: prompt }),
      });
      fileStatus = "Saved prompt.csv";
    } catch (cause) {
      fileStatus = `Prompt save failed: ${cause instanceof Error ? cause.message : cause}`;
    } finally {
      savingPrompt = false;
    }
  }
  async function playAudio(
    output: Blob,
    generation: number,
    role: "assistant" | "technician" = "assistant",
  ): Promise<number | null> {
    const started = performance.now();
    if (generation !== epoch || !context) return null;
    const buffer = await context.decodeAudioData(await output.arrayBuffer());
    if (generation !== epoch || !context) return null;
    const node = context.createBufferSource();
    node.buffer = buffer;
    analyser = context.createAnalyser();
    analyser.fftSize = 512;
    node.connect(analyser);
    analyser.connect(context.destination);
    player = node;
    speaking = true;
    playbackRole = role;
    status = role === "technician" ? "Technician speaking" : "Speaking";
    record(
      role === "technician"
        ? "TECHNICIAN_STATE_CHANGED"
        : "AGENT_STATE_CHANGED",
      "thinking → speaking",
    );
    await new Promise<void>((resolve) => {
      node.onended = () => resolve();
      node.start();
    });
    if (generation === epoch) {
      node.disconnect();
      analyser?.disconnect();
      speaking = false;
      player = null;
      analyser = null;
      record(
        role === "technician"
          ? "TECHNICIAN_STATE_CHANGED"
          : "AGENT_STATE_CHANGED",
        "speaking → listening",
      );
      if (role === "technician") inputBars = Array(36).fill(2);
      playbackRole = "assistant";
      return performance.now() - started;
    }
    return null;
  }
  function greetingFingerprint() {
    return JSON.stringify([
      ttsKey,
      voice,
      voiceFile?.name,
      voiceFile?.size,
      voiceFile?.lastModified,
      voiceFile ? referenceText : undefined,
      greeting,
    ]);
  }
  function scheduleGreeting(
    ready: boolean,
    inCall: boolean,
    _tts: string,
    _voice: string,
    _file: File | null,
    _text: string,
    _greeting: string,
    cloning: boolean,
  ) {
    clearTimeout(greetingTimer);
    if (!ready) {
      greetingAborter?.abort();
      if (mounted && !useTts) greetingStatus = "TTS is off · greeting skipped";
      return;
    }
    if (inCall) return;
    if (cloning) {
      greetingAborter?.abort();
      return;
    }
    if (
      !ttsKey ||
      !greeting.trim() ||
      (voiceFile && supportsReference && !referenceText.trim())
    )
      return;
    const key = greetingFingerprint();
    if (key === preparedKey) {
      greetingStatus = "Greeting ready · instant playback";
      return;
    }
    if (
      key === preparingKey &&
      greetingPreparing &&
      !greetingAborter?.signal.aborted
    )
      return;
    greetingAborter?.abort();
    greetingTimer = setTimeout(() => {
      void prepareGreeting();
    }, 500);
  }
  async function prepareGreeting(): Promise<Blob | null> {
    const key = greetingFingerprint();
    if (!useTts || !greeting.trim()) return null;
    if (preparedKey === key && preparedGreeting) return preparedGreeting;
    if (
      preparingKey === key &&
      greetingPreparing &&
      !greetingAborter?.signal.aborted &&
      greetingPromise
    )
      return greetingPromise;
    greetingAborter?.abort();
    const aborter = new AbortController();
    greetingAborter = aborter;
    preparingKey = key;
    greetingPreparing = true;
    greetingStatus = "Preparing greeting…";
    greetingPromise = (async () => {
      try {
        const id = await load(ttsKey, aborter.signal);
        const body: Record<string, unknown> = {
          model: id,
          input: greeting,
          response_format: "wav",
        };
        if (useTts && voiceFile && supportsReference) {
          if (!referenceText.trim())
            throw new Error("Enter the reference transcript first.");
          body.voice_ref = await uploadWav(
            await browserDecodeToWav(voiceFile, 24000, 1),
            aborter.signal,
          );
          body.reference_text = referenceText;
        } else {
          body.voice = voice;
        }
        const audio = await endpointBlob(
          "",
          "audio/speech",
          body,
          aborter.signal,
        );
        if (!aborter.signal.aborted && greetingFingerprint() === key) {
          preparedGreeting = audio;
          preparedKey = key;
          greetingStatus = "Greeting ready · instant playback";
        }
        return aborter.signal.aborted ? null : audio;
      } catch (cause) {
        if (!aborter.signal.aborted)
          greetingStatus = `Greeting unavailable: ${cause instanceof Error ? cause.message : cause}`;
        return null;
      } finally {
        if (greetingAborter === aborter) {
          greetingPreparing = false;
          if (!connected && !starting && !cloneBusy)
            status = "Ready to connect";
        }
      }
    })();
    return greetingPromise;
  }
  async function transcribeReference(file: File) {
    cloneAborter?.abort();
    greetingAborter?.abort();
    clearTimeout(greetingTimer);
    const aborter = new AbortController();
    cloneAborter = aborter;
    cloneBusy = true;
    cloneStatus = "Transcribing reference voice…";
    try {
      const id = await load(asrKey, aborter.signal);
      const audio = await uploadWav(
        await browserDecodeToWav(file, 16000, 1),
        aborter.signal,
      );
      const result = await endpointJson<{ text: string }>(
        "",
        "audio/transcriptions/details",
        {
          method: "POST",
          body: JSON.stringify({
            model: id,
            audio,
            ...(hotwords.trim()
              ? {
                  text: recognitionContext(
                    hotwords.trim(),
                    selectedAsr?.family || "",
                  ),
                }
              : {}),
          }),
        },
        aborter.signal,
      );
      if (!aborter.signal.aborted && voiceFile === file) {
        referenceText = result.text?.trim() || "";
        cloneStatus = referenceText
          ? "Transcript ready · review before calling"
          : "No speech recognized. Enter the transcript manually.";
      }
    } catch (cause) {
      if (!aborter.signal.aborted)
        cloneStatus = `Reference transcription failed: ${cause instanceof Error ? cause.message : cause}`;
    } finally {
      if (cloneAborter === aborter) {
        cloneBusy = false;
        if (!connected) status = "Ready to connect";
      }
    }
  }
  function chooseReference(file: File | null) {
    cloneAborter?.abort();
    voiceFile = file;
    referencePath = "";
    referenceText = file ? "" : defaultReferenceText;
    cloneStatus = "";
    if (file && useAsr && asrKey) void transcribeReference(file);
    else if (file)
      cloneStatus = "ASR is off · enter the reference transcript manually";
  }
  async function startCloneRecording() {
    if (connected || starting || cloneRecording || cloneBusy) return;
    greetingAborter?.abort();
    clearTimeout(greetingTimer);
    cloneBusy = true;
    try {
      if (!navigator.mediaDevices || typeof MediaRecorder === "undefined")
        throw new Error("Use trusted HTTPS to record a reference voice.");
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (!mounted) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      cloneStream = acquired;
      const recorder = new MediaRecorder(acquired);
      cloneRecorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        acquired.getTracks().forEach((t) => t.stop());
        cloneStream = null;
        cloneRecorder = null;
        cloneRecording = false;
        if (mounted)
          chooseReference(
            new File(chunks, "reference.webm", { type: recorder.mimeType }),
          );
      };
      recorder.onerror = () => {
        cloneStatus = "Reference recording failed.";
        recorder.stop();
      };
      recorder.start();
      cloneRecording = true;
      cloneStatus = "Recording · press Stop when finished";
    } catch (cause) {
      cloneStatus = cause instanceof Error ? cause.message : String(cause);
    } finally {
      cloneBusy = false;
    }
  }
  async function selectScenarioExample(example: { name: string; url: string }) {
    try {
      const response = await fetch(example.url);
      if (!response.ok)
        throw new Error(`Example audio failed: ${response.status}`);
      scenarioFile = new File([await response.blob()], example.name, {
        type: "audio/mpeg",
      });
      scenarioAudioName = example.name;
      scenarioStatus = "Example audio ready";
    } catch (cause) {
      scenarioStatus = cause instanceof Error ? cause.message : String(cause);
    }
  }
  async function runScenario(stepOnly?: number) {
    if (scenarioRunning || busy || detecting || starting) return;
    if (scenarioMode === "audio" && (!scenarioFile || !useAsr)) return;
    if (scenarioMode === "maintenance" && useTts && !technicianVoice) {
      scenarioStatus = "Two built-in voices are required.";
      return;
    }
    const token = ++scenarioToken;
    scenarioRunning = true;
    error = "";
    scenarioStatus = "Starting scenario…";
    try {
      if (!connected) await call();
      if (!connected || token !== scenarioToken) return;
      if (scenarioMode === "audio") {
        await respond("", scenarioFile!, epoch, { playInputAudio: true });
        if (!error) scenarioStatus = "Scenario 1 complete";
      } else {
        if (stepOnly === undefined) {
          messages = [];
          scenarioStep = 0;
        }
        const first = stepOnly ?? 0,
          last =
            stepOnly === undefined
              ? maintenanceScenarioSteps.length
              : first + 1;
        for (let index = first; index < last; index++) {
          if (!connected || token !== scenarioToken) break;
          scenarioStep = index;
          scenarioStatus = `Scenario 2 · ${index + 1}/3 · ${maintenanceScenarioSteps[index].title}`;
          input = maintenanceScenarioSteps[index].message;
          await tick();
          if (token !== scenarioToken || !connected) break;
          const text = input;
          input = "";
          await respond(text, undefined, epoch, { speakTechnician: true });
          if (error || token !== scenarioToken) break;
          scenarioStep = index + 1;
        }
        if (!error && token === scenarioToken)
          scenarioStatus =
            stepOnly === undefined ? "Scenario 2 complete" : "Turn complete";
      }
      if (error) scenarioStatus = error;
    } finally {
      if (token === scenarioToken) {
        scenarioRunning = false;
        if (!busy && connected) status = idleStatus();
      }
    }
  }
  function stopScenario() {
    if (starting) {
      hangup();
      scenarioStatus = "Scenario stopped";
      return;
    }
    scenarioToken++;
    scenarioRunning = false;
    controller?.abort();
    if (connected) controller = new AbortController();
    if (player) player.stop();
    scenarioStatus = "Scenario stopped";
    reset();
  }
  function send() {
    const text = input.trim();
    if (!text || busy || detecting || scenarioRunning || !connected) return;
    input = "";
    void respond(text, undefined, epoch, {
      speakTechnician: scenarioMode === "maintenance",
    });
  }
  async function call() {
    if (connected || starting || !canCall || cloneRecording || cloneBusy)
      return;
    const generation = ++epoch;
    starting = true;
    error = "";
    status = "Connecting";
    run = new Date().toLocaleTimeString();
    messages = [];
    controller = new AbortController();
    try {
      if (useAsr && (!window.isSecureContext || !navigator.mediaDevices))
        throw new Error(
          "Open this page over trusted HTTPS to use the microphone.",
        );
      context = new AudioContext();
      await context.resume();
      if (useAsr) {
        const acquired = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        if (epoch !== generation) {
          acquired.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = acquired;
      }
      if (!canCall)
        throw new Error(
          "Choose an installed model for each stage before calling.",
        );
      if (useTts && voiceFile && supportsReference) {
        if (!referenceText.trim())
          throw new Error("Enter the matching reference voice transcript.");
        referencePath = await uploadWav(
          await browserDecodeToWav(voiceFile, 24000, 1),
          controller.signal,
        );
      } else referencePath = "";
      if (epoch !== generation || !context) return;
      if (useAsr && stream) {
        source = context.createMediaStreamSource(stream!);
        processor = context.createScriptProcessor(4096, 1, 1);
        gain = context.createGain();
        gain.gain.value = 0;
        source.connect(processor);
        processor.connect(gain);
        gain.connect(context.destination);
      }
      connected = true;
      muted = false;
      status = idleStatus();
      record(
        "SESSION_STARTED",
        useAsr
          ? "Microphone connected · echo cancellation enabled"
          : "Text input · ASR skipped",
      );
      busy = useTts && !!greeting.trim();
      if (processor)
        processor.onaudioprocess = (e) => {
          const samples = new Float32Array(e.inputBuffer.getChannelData(0));
          if (!(speaking && playbackRole === "technician"))
            inputBars = muted ? Array(36).fill(2) : bars(samples);
          if (muted || busy || speaking || scenarioRunning) {
            windows = [];
            frames = 0;
            return;
          }
          if (!useVad) {
            if (manualRecording) {
              manualParts.push(samples);
              if (
                context &&
                manualParts.reduce((n, p) => n + p.length, 0) >=
                  context.sampleRate * 15
              )
                toggleManualTurn();
            }
            return;
          }
          windows.push(samples);
          frames += samples.length;
          if (
            !detecting &&
            context &&
            frames >= (context.sampleRate * windowMs) / 1000
          ) {
            const combined = new Float32Array(frames);
            let offset = 0;
            for (const p of windows) {
              combined.set(p, offset);
              offset += p.length;
            }
            windows = [];
            frames = 0;
            void detect(combined, generation);
          }
        };
      const draw = () => {
        if (!connected) return;
        if (analyser && speaking) {
          const data = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(data);
          if (playbackRole === "technician") {
            inputBars = bars(data);
            outputBars = Array(36).fill(2);
          } else outputBars = bars(data);
        } else outputBars = Array(36).fill(2);
        animation = requestAnimationFrame(draw);
      };
      draw();
      if (useTts && greeting.trim()) {
        record("GREETING_REQUESTED", greeting);
        const audio = await prepareGreeting();
        if (generation !== epoch) return;
        if (!audio)
          throw new Error(greetingStatus || "Greeting synthesis failed.");
        messages = [{ role: "assistant", content: greeting }];
        const playbackMs = await playAudio(audio, generation);
        if (generation !== epoch) return;
        record("GREETING_PLAYED", greeting, playbackMs);
        busy = false;
        status = idleStatus();
      }
    } catch (cause) {
      if (generation === epoch) {
        fail(cause);
        hangup(false);
      }
    } finally {
      if (generation === epoch) starting = false;
    }
  }
  function hangup(log = true) {
    scenarioToken++;
    scenarioRunning = false;
    epoch++;
    greetingAborter?.abort();
    controller?.abort();
    controller = null;
    if (player) {
      player.stop();
      player.disconnect();
      player = null;
    }
    processor?.disconnect();
    if (processor) processor.onaudioprocess = null;
    source?.disconnect();
    gain?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (context) void context.close();
    context = null;
    cancelAnimationFrame(animation);
    analyser = null;
    processor = null;
    source = null;
    gain = null;
    connected = false;
    if (!llmModels.some((m) => m.id === llm))
      llm =
        llmModels.find((m) => !m.requiresDownload)?.id ||
        llmModels[0]?.id ||
        "";
    starting = false;
    busy = false;
    detecting = false;
    speaking = false;
    reset();
    manualRecording = false;
    manualParts = [];
    inputBars = Array(36).fill(2);
    outputBars = Array(36).fill(2);
    if (log) {
      status = "Call ended";
      record("SESSION_ENDED", "Call ended");
    }
  }
  function toggleMute() {
    muted = !muted;
    manualRecording = false;
    manualParts = [];
    reset();
    if (!busy) status = idleStatus();
    stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    record("MICROPHONE", muted ? "Muted" : "Unmuted");
  }
  onMount(() => {
    previousTheme = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = "dark";
    mounted = true;
    void refreshModels();
    void loadCsvFiles();
    try {
      const saved = JSON.parse(localStorage.getItem(historyKey) || "[]");
      if (Array.isArray(saved))
        events = saved
          .filter(
            (e) =>
              typeof e?.summary === "string" && typeof e?.time === "string",
          )
          .slice(0, 300);
    } catch {}
  });
  onDestroy(() => {
    if (document.documentElement.dataset.theme === "dark") {
      if (previousTheme) document.documentElement.dataset.theme = previousTheme;
      else delete document.documentElement.dataset.theme;
    }
    mounted = false;
    llmDownloading = false;
    stopLlmDownloadWatch();
    clearTimeout(greetingTimer);
    greetingAborter?.abort();
    cloneAborter?.abort();
    if (cloneRecorder?.state === "recording") cloneRecorder.stop();
    cloneStream?.getTracks().forEach((t) => t.stop());
    hangup(false);
  });
</script>

<svelte:head><title>GeoVision · Voice Demo</title></svelte:head>
<div class="demo">
  <aside>
    <div class="brand">
      <span class="gv">{@html logo}</span><span>GeoVision IVR</span>
    </div>
    <section
      class="stage-settings greeting-settings"
      aria-label="Call greeting settings"
    >
      <div class="stage-heading"><h2>Call greeting</h2></div>
      <fieldset disabled={connected || starting || cloneRecording || cloneBusy}>
        <label
          >Call greeting<textarea rows="3" bind:value={greeting}
          ></textarea></label
        >
        <button
          disabled={savingGreeting || !greeting.trim() || !ttsKey}
          on:click={saveGreetingCsv}
          >{savingGreeting ? "Saving…" : "Update greetings.csv"}</button
        >
        <small>{greetingStatus}</small>
      </fieldset>
    </section>
    <div class="section-label">MODEL SETTINGS</div>
    <button
      disabled={connected ||
        starting ||
        discovering ||
        cloneRecording ||
        cloneBusy}
      on:click={refreshModels}
      >{discovering ? "Refreshing…" : "Refresh models"}</button
    >
    {#if modelError}<p class="error" role="alert">{modelError}</p>{/if}
    {#if useLlm && !discovering && !llmModels.some((m) => !m.requiresDownload) && !modelError}<p
        class="error"
      >
        No downloaded LLM models found. Download a model in the LLM page, then
        refresh models.
      </p>{/if}
    <section class="stage-settings" aria-label="VAD settings">
      <div class="stage-heading">
        <h2>VAD</h2>
        <label class="stage-switch"
          ><input
            type="checkbox"
            role="switch"
            aria-label="Enable VAD"
            bind:checked={useVad}
            disabled={connected ||
              starting ||
              discovering ||
              cloneRecording ||
              cloneBusy}
          /><span>{useVad ? "On" : "Off"}</span></label
        >
      </div>
      <fieldset
        disabled={connected ||
          starting ||
          discovering ||
          cloneRecording ||
          cloneBusy ||
          !useVad}
      >
        <label
          >VAD<select aria-label="VAD" bind:value={vadKey}
            ><option value="" disabled>No installed VAD models</option
            >{#each vadModels as model}<option value={model.key}
                >{model.label}</option
              >{/each}</select
          ></label
        >
        <label
          >Speech threshold<input
            type="number"
            min="0.01"
            max="0.99"
            step="0.05"
            bind:value={threshold}
          /></label
        >
        <label
          >Turn window (ms)<input
            type="number"
            min="300"
            max="2000"
            step="50"
            bind:value={windowMs}
          /></label
        >
      </fieldset>
      {#if !useVad}<small
          >VAD skipped. Record and send voice turns manually.</small
        >{/if}
    </section>
    <section class="stage-settings" aria-label="ASR settings">
      <div class="stage-heading">
        <h2>ASR</h2>
        <label class="stage-switch"
          ><input
            type="checkbox"
            role="switch"
            aria-label="Enable ASR"
            bind:checked={useAsr}
            disabled={connected ||
              starting ||
              discovering ||
              cloneRecording ||
              cloneBusy}
          /><span>{useAsr ? "On" : "Off"}</span></label
        >
      </div>
      <fieldset
        disabled={connected ||
          starting ||
          discovering ||
          cloneRecording ||
          cloneBusy ||
          !useAsr}
      >
        <label
          >ASR<select aria-label="ASR" bind:value={asrKey}
            ><option value="" disabled>No installed ASR models</option
            >{#each asrModels as model}<option value={model.key}
                >{model.label}</option
              >{/each}</select
          ></label
        >
        <label
          >ASR hotwords / context<textarea
            rows="3"
            bind:value={hotwords}
            placeholder="X光機、設備代碼、人名…"></textarea></label
        >
        {#if selectedAsr?.family === "audio8_asr"}<small
            >Audio8 ASR currently uses a fixed transcription prompt; context
            biasing requires a model that supports it.</small
          >{/if}
      </fieldset>
      {#if !useAsr}<small
          >ASR skipped. Type messages instead of using the microphone.</small
        >{/if}
    </section>
    <section class="stage-settings" aria-label="LLM settings">
      <div class="stage-heading">
        <h2>LLM</h2>
        <label class="stage-switch"
          ><input
            type="checkbox"
            role="switch"
            aria-label="Enable LLM"
            bind:checked={useLlm}
            disabled={connected ||
              starting ||
              discovering ||
              cloneRecording ||
              cloneBusy}
          /><span>{useLlm ? "On" : "Off"}</span></label
        >
      </div>
      <fieldset
        disabled={connected ||
          starting ||
          discovering ||
          cloneRecording ||
          cloneBusy ||
          !useLlm}
      >
        <label
          >LLM<select aria-label="LLM" bind:value={llm}
            ><option value="" disabled>No downloaded LLM models</option
            >{#each llmModels as model}<option value={model.id}
                >{model.label || model.id}{model.requiresDownload
                  ? " · download required"
                  : ""}</option
              >{/each}</select
          ></label
        >
        <label
          >System prompt<textarea rows="4" bind:value={prompt}
          ></textarea></label
        >
        <button disabled={savingPrompt} on:click={savePromptCsv}
          >{savingPrompt ? "Saving…" : "Save prompt.csv"}</button
        >
        {#if llmNeedsDownload}<button
            disabled={llmDownloading}
            on:click={downloadLfmModel}
            >{llmDownloading
              ? "Downloading…"
              : "Download LFM2.5 Q4_K_M"}</button
          >{/if}
        {#if llmDownloadStatus}<p role="status">{llmDownloadStatus}</p>{/if}
      </fieldset>
      {#if !useLlm}<small
          >LLM skipped. Input text passes directly to the output.</small
        >{/if}
    </section>
    <section class="stage-settings" aria-label="TTS settings">
      <div class="stage-heading">
        <h2>TTS</h2>
        <label class="stage-switch"
          ><input
            type="checkbox"
            role="switch"
            aria-label="Enable TTS"
            bind:checked={useTts}
            disabled={connected ||
              starting ||
              discovering ||
              cloneRecording ||
              cloneBusy}
          /><span>{useTts ? "On" : "Off"}</span></label
        >
      </div>
      <fieldset
        disabled={connected ||
          starting ||
          discovering ||
          cloneRecording ||
          cloneBusy ||
          !useTts}
      >
        <label
          >TTS<select aria-label="TTS" bind:value={ttsKey}
            ><option value="" disabled>No installed TTS models</option
            >{#each ttsModels as model}<option value={model.key}
                >{model.label}</option
              >{/each}</select
          ></label
        >
        <label
          >Built-in voice<select aria-label="Built-in voice" bind:value={voice}
            >{#each voiceChoices as id}<option value={id}
                >{id === "lingCLvocals"
                  ? "Ling · Chinese"
                  : id === "wangSG9s"
                    ? "Wang · Chinese"
                    : id}</option
              >{/each}</select
          ></label
        >
        {#if supportsReference}
          <label
            >Custom reference voice (optional)<input
              type="file"
              accept="audio/*"
              on:change={(e) =>
                chooseReference(e.currentTarget.files?.[0] || null)}
            /></label
          >
          <label
            >Reference transcript<textarea
              rows="2"
              bind:value={referenceText}
              placeholder="Exact words in reference audio"></textarea></label
          ><small
            >Reference transcript applies to custom audio. Built-in voices use
            their own matching transcript.</small
          >
        {/if}
      </fieldset>
      {#if supportsReference}<div class="clone-recording">
          {#if cloneRecording}<button on:click={() => cloneRecorder?.stop()}
              ><MicOff size={16} /> Stop recording</button
            >
          {:else}<button
              disabled={connected ||
                starting ||
                cloneBusy ||
                !useTts ||
                (useAsr && !asrKey)}
              on:click={startCloneRecording}
              ><Mic size={16} /> Record clone voice</button
            >{/if}
          {#if cloneStatus}<p role="status">{cloneStatus}</p>{/if}
        </div>{/if}
      {#if !useTts}<small
          >TTS skipped. Replies are text only; the greeting is not spoken.</small
        >{/if}
    </section>
    <p role="status">{fileStatus}</p>
    <div class="sidebar-foot">
      HTTPS microphone<br />Echo cancellation enabled<br />Listening pauses
      during replies
    </div>
  </aside>
  <main>
    <header>
      <div><strong>Console</strong><span class="badge">LOCAL DEMO</span></div>
      <div class="connection">
        <i class:online={connected}></i>{connected
          ? "CONNECTED"
          : starting
            ? "CONNECTING"
            : "DISCONNECTED"}
      </div>
    </header>
    <section class="session">
      <div class="conversation">
        <div class="wave-area">
          <div class="wave-label">
            {speaking && playbackRole === "technician"
              ? "TECHNICIAN"
              : "MICROPHONE"}
          </div>
          <div class="wave wave-in" aria-label="Live microphone waveform">
            {#each inputBars as height}<span style:height={`${height}px`}
              ></span>{/each}
          </div>
          <div class="wave-label">ASSISTANT</div>
          <div class="wave wave-out" aria-label="Live assistant waveform">
            {#each outputBars as height}<span style:height={`${height}px`}
              ></span>{/each}
          </div>
        </div>
        <div
          class="transcript"
          bind:this={transcriptElement}
          aria-live="polite"
        >
          {#if !messages.length}<div class="empty">
              <h1>Your local voice assistant</h1>
              <p>Start a call, then speak or type a message.</p>
              <small>Audio8 ASR → LFM2.5 → ZipVoice</small>
            </div>{/if}{#each messages as message}<article
              class:user={message.role === "user"}
            >
              <small>{message.role === "user" ? "YOU" : "GEOVISION"}</small>
              <p>{message.content}</p>
            </article>{/each}
        </div>
        <div class="composer">
          <form on:submit|preventDefault={send}>
            <textarea
              rows="2"
              aria-label="Message"
              placeholder="Type something…"
              bind:value={input}
              disabled={!connected || scenarioRunning}
              on:keydown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}></textarea><button
              aria-label="Send message"
              disabled={!connected ||
                busy ||
                detecting ||
                scenarioRunning ||
                !input.trim()}><Send size={18} /></button
            >
          </form>
          <div class="controls">
            <button
              class:muted
              on:click={toggleMute}
              disabled={!connected || !useAsr}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              >{#if muted}<MicOff size={18} />{:else}<Mic
                  size={18}
                />{/if}</button
            >{#if !useVad && useAsr}<button
                disabled={!connected || busy || muted || scenarioRunning}
                on:click={toggleManualTurn}
                ><Mic size={16} />{manualRecording
                  ? "Send voice turn"
                  : "Record voice turn"}</button
              >{/if}<span class="call-status" role="status">{status}</span
            >{#if connected || starting}<button
                class="hangup"
                on:click={() => hangup()}><PhoneOff size={16} /> Hang up</button
              >{:else}<button
                class="call"
                disabled={!canCall ||
                  discovering ||
                  cloneRecording ||
                  cloneBusy}
                on:click={call}><Phone size={16} /> Start call</button
              >{/if}
          </div>
          {#if error}<p class="error" role="alert">{error}</p>{/if}
        </div>
      </div>
      <div class="details">
        <div class="section-label">SESSION</div>
        <dl>
          <dt>Transport</dt>
          <dd>HTTPS</dd>
          <dt>Audio</dt>
          <dd>Microphone + speaker</dd>
          <dt>Turn detection</dt>
          <dd>{useVad && useAsr ? selectedVad?.label || "—" : "Skipped"}</dd>
          <dt>ASR</dt>
          <dd>{useAsr ? selectedAsr?.label || "—" : "Skipped · text input"}</dd>
          <dt>LLM</dt>
          <dd>{useLlm ? llm || "—" : "Skipped · passthrough"}</dd>
          <dt>TTS</dt>
          <dd>
            {useTts ? selectedTts?.label || "—" : "Skipped · text output"}
          </dd>
          <dt>Session</dt>
          <dd>{run || "—"}</dd>
        </dl>
        <p>
          Sequential voice pipeline. Listening pauses while the assistant
          processes and speaks.
        </p>
      </div>
    </section>
    <div class="bottom-panels">
      <section class="events">
        <div class="events-title">
          <strong>Events <span>{events.length}</span></strong><button
            on:click={() => {
              events = [];
              localStorage.removeItem(historyKey);
            }}><Trash2 size={14} /> Clear events</button
          >
        </div>
        <div class="event-scroll">
          <table>
            <thead
              ><tr
                ><th>TIMESTAMP</th><th
                  title="Elapsed wall time for this operation">RUNTIME</th
                ><th>EVENT TYPE</th><th>SUMMARY</th></tr
              ></thead
            ><tbody
              >{#each events as event}<tr
                  ><td>{new Date(event.time).toLocaleTimeString()}</td><td
                    class="runtime">{runtimeLabel(event.runtimeMs)}</td
                  ><td
                    ><span
                      class:error-tag={event.type === "ERROR"}
                      class="event-tag">{event.type}</span
                    ></td
                  ><td>{event.summary}</td></tr
                >{/each}</tbody
            >
          </table>
          {#if !events.length}<p class="no-events">
              Events from this and previous calls appear here.
            </p>{/if}
        </div>
      </section>
      <section class="scenario-dock" aria-label="Demo scenarios">
        <div class="scenario-title"><strong>Demo scenarios</strong></div>
        <div class="scenario-panel">
          <label
            >Scenario<select
              aria-label="Scenario"
              bind:value={scenarioMode}
              disabled={scenarioRunning}
              ><option value="audio">Scenario 1 · audio examples</option><option
                value="maintenance"
                >Scenario 2 · 現場維修保養後的語音回報</option
              ></select
            ></label
          >
          {#if scenarioMode === "audio"}
            <div class="scenario-upload">
              <strong>{scenarioAudioName || "No audio selected"}</strong><small
                >WAV, MP3, or FLAC</small
              ><label class="audio-choice"
                >Choose audio<input
                  aria-label="Choose scenario audio"
                  type="file"
                  accept=".wav,.mp3,.flac,audio/*"
                  disabled={scenarioRunning}
                  on:change={(e) => {
                    scenarioFile = e.currentTarget.files?.[0] || null;
                    scenarioAudioName = scenarioFile?.name || "";
                  }}
                /></label
              >
            </div>
            <div class="example-chips">
              <small>Example audio</small
              >{#each scenarioAudioExamples as example}<button
                  disabled={scenarioRunning}
                  on:click={() => selectScenarioExample(example)}
                  >{example.name}</button
                >{/each}
            </div>
            <button
              disabled={scenarioRunning ||
                busy ||
                detecting ||
                starting ||
                !scenarioFile ||
                !useAsr ||
                (!connected && !canCall)}
              on:click={() => runScenario()}>Send audio</button
            >
          {:else}
            <p>
              Technician voice: <strong
                >{technicianVoice || "No alternative built-in voice"}</strong
              >. Assistant voice:
              <strong>{voiceFile ? "Custom reference" : voice}</strong>.
            </p>
            <button
              disabled={scenarioRunning ||
                busy ||
                detecting ||
                starting ||
                (!connected && !canCall) ||
                (useTts && !technicianVoice)}
              on:click={() => runScenario()}>Run Scenario 2</button
            >
            <details class="scenario-script">
              <summary
                >Script and expected replies · {Math.min(
                  scenarioStep,
                  3,
                )}/3</summary
              >{#each maintenanceScenarioSteps as step, index}<div>
                  <strong>{index + 1}. {step.title}</strong>
                  <p><b>維修人員：</b>{step.message}</p>
                  <button
                    disabled={scenarioRunning ||
                      busy ||
                      detecting ||
                      starting ||
                      (!connected && !canCall)}
                    on:click={() => runScenario(index)}
                    >Send technician turn {index + 1}</button
                  >
                  <p><b>AI（預期）：</b>{step.expected}</p>
                </div>{/each}
            </details>
            <small
              >Replies are generated live using the maintenance scenario
              instructions.</small
            >
          {/if}
          {#if scenarioRunning}<button class="hangup" on:click={stopScenario}
              >Stop scenario</button
            >{/if}
          <small role="status">{scenarioStatus}</small>
        </div>
      </section>
    </div>
  </main>
</div>

<style>
  :global(body:has(.demo)) {
    margin: 0;
    background: var(--bg);
    color: var(--text);
  }
  .demo {
    display: grid;
    grid-template-columns: 290px 1fr;
    min-height: 100vh;
    font-family: Inter, system-ui, sans-serif;
    font-size: 13px;
    background: var(--bg);
    color: var(--text);
  }
  .demo * {
    box-sizing: border-box;
  }
  .demo aside {
    border-right: 1px solid var(--line);
    padding: 25px 20px;
    max-height: 100vh;
    overflow: auto;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #fff;
    white-space: nowrap;
    font-size: 20px;
    font-weight: 650;
    margin-bottom: 35px;
  }
  .brand > span:last-child {
    font: inherit;
    text-transform: none;
    letter-spacing: normal;
    color: inherit;
  }
  .gv {
    width: 34px;
    height: 34px;
  }
  .section-label {
    color: var(--muted);
    font-size: 10px;
    letter-spacing: 1.6px;
    margin: 16px 0;
  }
  .stage-settings {
    border: 1px solid var(--line);
    border-radius: 8px;
    margin-top: 16px;
    padding: 14px;
  }
  .stage-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .stage-heading h2 {
    margin: 0;
    font-size: 12px;
    letter-spacing: 1px;
    color: var(--text-strong);
  }
  .demo label.stage-switch {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0;
  }
  .demo .stage-switch input {
    appearance: none;
    width: 30px;
    height: 17px;
    border: 1px solid var(--control-border);
    border-radius: 12px;
    margin: 0;
    padding: 0;
    background: var(--control-bg);
    cursor: pointer;
    position: relative;
  }
  .demo .stage-switch input::before {
    content: "";
    position: absolute;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    background: var(--muted);
    transition: transform 0.15s;
  }
  .demo .stage-switch input:checked {
    background: var(--active-bg);
    border-color: var(--cyan);
  }
  .demo .stage-switch input:checked::before {
    transform: translateX(13px);
    background: var(--cyan);
  }
  .stage-switch span {
    font-size: 11px;
    min-width: 17px;
  }
  .stage-settings fieldset:disabled {
    opacity: 0.5;
  }
  .clone-recording {
    margin-top: 14px;
  }
  .demo fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  .demo label {
    display: block;
    color: var(--text-label);
    font-size: 11px;
    margin: 17px 0 5px;
  }
  .demo input,
  .demo select,
  .demo textarea {
    display: block;
    width: 100%;
    background: var(--control-bg);
    border: 1px solid var(--control-border);
    border-radius: 6px;
    color: var(--text);
    padding: 9px;
    margin-top: 7px;
    font: inherit;
    min-width: 0;
  }
  .demo textarea {
    resize: vertical;
  }
  .demo small,
  .sidebar-foot {
    color: var(--muted);
    font-size: 11px;
    line-height: 1.7;
  }
  .sidebar-foot {
    margin-top: 25px;
    border-top: 1px solid var(--line);
    padding-top: 18px;
  }
  .demo main {
    min-width: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 0;
    max-width: none;
    margin: 0;
  }
  .demo header {
    height: 65px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--line);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 25px;
  }
  .demo header strong {
    font-size: 17px;
  }
  .badge {
    margin-left: 20px;
    color: var(--muted);
    font-size: 9px;
    letter-spacing: 1.5px;
  }
  .connection {
    font-size: 10px;
    letter-spacing: 1px;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .connection i {
    width: 7px;
    height: 7px;
    background: #626c78;
    border-radius: 50%;
  }
  .connection i.online {
    background: #40d5a6;
    box-shadow: 0 0 12px #40d5a655;
  }
  .session {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 225px;
    min-height: 360px;
    flex: 1;
    padding: 20px;
    gap: 20px;
  }
  .conversation {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
  }
  .wave-area {
    flex-shrink: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 15px 25px;
    border-bottom: 1px solid var(--line);
  }
  .wave-label {
    text-align: center;
    color: var(--muted);
    font-size: 9px;
    letter-spacing: 1px;
  }
  .wave-label:nth-child(3) {
    grid-column: 2;
    grid-row: 1;
  }
  .wave {
    height: 78px;
    display: flex;
    gap: 3px;
    align-items: center;
    justify-content: center;
  }
  .wave span {
    width: 5px;
    border-radius: 4px;
    transition: height 65ms linear;
    background: #d8e7f2;
  }
  .wave.wave-out span {
    background: #40d5a6;
  }
  .transcript {
    flex: 1;
    overflow: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-height: 60px;
  }
  .empty {
    margin: auto;
    text-align: center;
    color: var(--muted);
  }
  .empty h1 {
    font-size: 21px;
    font-weight: 500;
    color: var(--text-strong);
  }
  .empty p {
    font-size: 13px;
  }
  .transcript article {
    max-width: 88%;
    padding: 12px 16px;
    background: var(--panel);
    border-radius: 10px;
    align-self: flex-start;
  }
  .transcript article.user {
    align-self: flex-end;
    background: var(--panel-2);
  }
  .transcript article small {
    font-size: 9px;
    letter-spacing: 1px;
    color: #8aaba9;
  }
  .transcript article p {
    margin: 6px 0;
    white-space: pre-wrap;
    line-height: 1.7;
  }
  .bottom-panels {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    height: clamp(260px, 33vh, 380px);
    flex-shrink: 0;
    border-top: 1px solid var(--line);
    min-width: 0;
  }
  .events-title,
  .scenario-title {
    height: 54px;
    flex-shrink: 0;
    box-sizing: border-box;
  }
  .scenario-title {
    min-height: 52px;
    padding: 13px 16px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--line);
    font-size: 13px;
  }
  .scenario-dock {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-left: 1px solid var(--line);
    background: var(--control-bg);
  }
  .scenario-panel {
    min-height: 0;
    flex: 1;
    overflow: auto;
    padding: 12px 16px;
    font-size: 11px;
  }
  .scenario-panel .scenario-script > summary {
    cursor: pointer;
    color: var(--text-label);
    font-weight: 600;
  }
  .scenario-panel > button {
    margin: 8px 5px 8px 0;
  }
  .scenario-panel > small {
    display: block;
    margin-top: 6px;
  }
  .scenario-upload {
    border: 1px dashed var(--control-border);
    border-radius: 8px;
    padding: 10px;
    margin-top: 10px;
  }
  .scenario-upload > small {
    display: block;
  }
  .example-chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    margin: 8px 0;
  }
  .demo .example-chips button {
    font-size: 10px;
    padding: 4px 6px;
  }
  .scenario-script {
    margin-top: 10px;
  }
  .scenario-script p {
    white-space: pre-wrap;
    line-height: 1.6;
  }
  .scenario-script > div {
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }
  .scenario-script b {
    display: block;
  }
  .composer {
    flex-shrink: 0;
    padding: 14px;
    border-top: 1px solid var(--line);
  }
  .composer form {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .composer textarea {
    margin: 0;
    border: 0;
    background: transparent;
    padding: 10px 0;
  }
  .demo button {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--control-border);
    border-radius: 6px;
    background: var(--button-bg);
    color: var(--text);
    padding: 9px 12px;
    font: inherit;
    cursor: pointer;
  }
  .demo button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .demo button:focus-visible,
  .demo input:focus-visible,
  .demo textarea:focus-visible,
  .demo select:focus-visible {
    outline: 2px solid #40d5a6;
    outline-offset: 2px;
  }
  .controls {
    flex-wrap: wrap;
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 10px;
  }
  .controls span {
    color: var(--muted);
    font-size: 11px;
    flex: 1;
  }
  .demo .call {
    background: #164638;
    border-color: #29795f;
    color: #9cf1d4;
  }
  .demo .hangup {
    background: #44211f;
    border-color: #733631;
    color: #ffb3ab;
  }
  .demo .muted {
    color: #ffb3ab;
  }
  .details {
    border-left: 1px solid var(--line);
    padding-left: 20px;
    overflow: auto;
  }
  .details dl {
    font-size: 11px;
  }
  .details dt {
    color: var(--muted);
    margin-top: 22px;
  }
  .details dd {
    margin: 6px 0 0;
    overflow-wrap: anywhere;
  }
  .details p {
    color: var(--muted);
    font-size: 11px;
    line-height: 1.7;
    margin-top: 30px;
  }
  .events {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .events-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 13px 23px;
    border-bottom: 1px solid var(--line);
  }
  .events-title strong span {
    margin-left: 9px;
    color: var(--muted);
  }
  .events-title button {
    font-size: 11px;
    padding: 5px 9px;
  }
  .event-scroll {
    overflow: auto;
    flex: 1;
  }
  .events table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 11px;
    table-layout: fixed;
    min-width: 640px;
  }
  .events th {
    position: sticky;
    top: 0;
    background: var(--panel);
    color: var(--muted);
    font-size: 9px;
    letter-spacing: 1px;
    padding: 11px 20px;
  }
  .events td {
    padding: 10px 20px;
    border-top: 1px solid var(--line);
    color: var(--text-subtle);
    overflow-wrap: anywhere;
  }
  .events th:first-child {
    width: 110px;
  }
  .events td.runtime {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .events th:nth-child(2) {
    width: 110px;
  }
  .events th:nth-child(3) {
    width: 235px;
  }
  .event-tag {
    font-size: 9px;
    color: #62d0c9;
    background: #123331;
    padding: 4px 6px;
    border-radius: 3px;
  }
  .event-tag.error-tag {
    color: #ffb3ab;
    background: #44211f;
  }
  .error {
    color: #ffb3ab;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .no-events {
    padding: 15px 23px;
    color: var(--muted);
    font-size: 12px;
  }
  @media (max-width: 1050px) {
    .bottom-panels {
      grid-template-columns: 1fr;
      grid-template-rows: 220px 260px;
      height: 480px;
    }
    .scenario-dock {
      border-left: 0;
      border-top: 1px solid var(--line);
    }
    .demo main {
      min-height: 940px;
    }

    .details {
      display: none;
    }
    .session {
      grid-template-columns: 1fr;
    }
    .demo {
      grid-template-columns: 250px 1fr;
    }
  }
  @media (max-width: 700px) {
    .demo {
      display: block;
    }
    .demo aside {
      max-height: none;
      border-right: 0;
      border-bottom: 1px solid var(--line);
      padding: 15px;
    }
    .demo aside fieldset {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 15px;
    }
    .brand {
      margin-bottom: 15px;
    }
    .sidebar-foot {
      display: none;
    }
    .demo main {
      height: 900px;
    }
    .demo header {
      padding: 0 15px;
    }
    .badge {
      display: none;
    }
    .session {
      padding: 12px;
    }
    .events th:nth-child(3) {
      width: 170px;
    }
    .events td,
    .events th {
      padding: 9px;
    }
    .wave {
      gap: 2px;
    }
    .wave span {
      width: 3px;
    }
  }
</style>
