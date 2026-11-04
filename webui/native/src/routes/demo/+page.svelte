<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import PanelDivider from "$lib/PanelDivider.svelte";
  import { catalog, modelModes } from "$lib/catalog";
  import {
    playSpeechStream,
    type SpeechStreamSummary,
  } from "$lib/speech-stream";
  import { readHotwordsCsv, writeHotwordsCsv } from "$lib/hotwords";
  import {
    audioModelSettings,
    savedAudioModel,
    type DemoSettings,
    type AudioStage,
  } from "$lib/demo-settings";
  import { Mic, MicOff, Phone, PhoneOff, Send, Trash2 } from "@lucide/svelte";
  import logo from "../../../static/logo_cloud.svg?raw";
  import "../../app.css";
  import { browserDecodeToWav, encodePcm16Wav } from "$lib/audio";
  import { readGreetingCsv, writeGreetingCsv } from "$lib/greetings";
  import { recognitionContext } from "$lib/asr-context";
  import { reportedRtf, rtfLabel } from "$lib/response-timing";
  import { uploadWav, pathStatus } from "$lib/api";
  import {
    listVoices,
    saveVoice,
    deleteVoice,
    createLocalId,
    type SavedVoice,
  } from "$lib/voices";
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
    routerEndpoint,
    chatText,
    type ChatMessage,
  } from "$lib/openai";
  import {
    discoverDemoAudioModels,
    discoverDemoLlmModels,
    ensureDemoLlmReady,
    preferredDemoModel,
    type DemoAudioModel,
    type DemoLlmModel,
    LFM_DEMO_REF,
    isDemoLfmModel,
  } from "$lib/demo-models";
  let settingsLoading = true,
    savingSettings = false,
    settingsStatus = "";
  async function initializeSidebar() {
    try {
      const [result] = await Promise.all([
        endpointJson<{ settings: DemoSettings | null }>(
          "",
          "ui/demo-settings",
          {
            cache: "no-store",
          },
        )
          .then((value) => ({ settings: value.settings, error: "" }))
          .catch((cause) => ({
            settings: null,
            error: `Could not load model settings: ${cause instanceof Error ? cause.message : cause}`,
          })),
        refreshModels(),
        loadCsvFiles(),
        refreshVoices(),
      ]);
      if (!mounted) return;
      if (result.settings) {
        await restoreSavedModelFiles(result.settings);
        if (!mounted) return;
        applyModelSettings(result.settings);
      } else settingsStatus = result.error || "Using default model settings";
    } catch (cause) {
      settingsStatus = `Saved settings could not be applied: ${cause instanceof Error ? cause.message : cause}`;
    } finally {
      settingsLoading = false;
    }
  }
  async function restoreSavedModelFiles(saved: DemoSettings) {
    // Dynamically registered model IDs disappear on a server restart. Their
    // saved paths can still be used when the actual files remain installed.
    const stages: AudioStage[] = ["vad", "asr", "tts"];
    const restored = await Promise.all(
      stages.map(async (stage) => {
        const family = saved[`${stage}_model_family`],
          path = saved[`${stage}_model_path`];
        if (!family || !path || savedAudioModel(saved, stage, audioModels))
          return undefined;
        try {
          if (!(await pathStatus(path)).exists) return undefined;
          const entry = catalog.find(
            (model) =>
              model.family === family &&
              (stage === "tts"
                ? ["tts", "clon"].includes(model.task)
                : stage === "asr"
                  ? ["asr", "stt"].includes(model.task)
                  : model.task === "vad"),
          );
          const task = saved[`${stage}_model_task`] || entry?.task || stage;
          if (
            !(stage === "tts"
              ? ["tts", "clon"].includes(task)
              : stage === "asr"
                ? ["asr", "stt"].includes(task)
                : task === "vad")
          )
            return undefined;
          return {
            key: saved[`${stage}_model_key`] || `saved:${stage}:${family}`,
            id: saved[`${stage}_model_id`] || `${family}-${stage}`,
            label: `${entry?.display_name_en || entry?.display_name || family} · ${path.split(/[\\/]/).pop()}`,
            family,
            task,
            mode: "offline",
            path,
            builtin_voices: entry?.builtin_voices,
            default_voice: entry?.default_voice,
            load_options: saved[`${stage}_load_options`],
            session_options: saved[`${stage}_session_options`],
          } as DemoAudioModel;
        } catch {
          return undefined;
        }
      }),
    );
    audioModels = [
      ...audioModels,
      ...restored.filter((model): model is DemoAudioModel => !!model),
    ];
  }
  function applyModelSettings(saved: DemoSettings) {
    if (saved.schema_version !== 1)
      throw new Error("Unsupported settings version");
    const warnings: string[] = [];
    const resolve = (stage: AudioStage) => {
      if (
        saved[`${stage}_model_key`] === undefined &&
        !saved[`${stage}_model_path`]
      )
        return stage === "vad" ? vadKey : stage === "asr" ? asrKey : ttsKey;
      const model = savedAudioModel(saved, stage, audioModels);
      if (!model) {
        if (saved[`${stage}_model_key`] || saved[`${stage}_model_path`])
          warnings.push(`${stage.toUpperCase()} model unavailable`);
        return "";
      }
      audioModels = audioModels.map((entry) =>
        entry.key === model.key
          ? {
              ...entry,
              load_options:
                saved[`${stage}_load_options`] ?? entry.load_options,
              session_options:
                saved[`${stage}_session_options`] ?? entry.session_options,
            }
          : entry,
      );
      return model.key;
    };
    vadKey = resolve("vad");
    asrKey = resolve("asr");
    ttsKey = resolve("tts");
    if (typeof saved.vad_enabled === "boolean") useVad = saved.vad_enabled;
    if (typeof saved.asr_enabled === "boolean") useAsr = saved.asr_enabled;
    if (typeof saved.llm_enabled === "boolean") useLlm = saved.llm_enabled;
    if (typeof saved.tts_enabled === "boolean") useTts = saved.tts_enabled;
    if (typeof saved.vad_threshold === "number")
      threshold = saved.vad_threshold;
    if (typeof saved.vad_window_ms === "number") windowMs = saved.vad_window_ms;
    if (saved.llm_model !== undefined) {
      const selected =
        llmModels.find((model) => model.id === saved.llm_model) ||
        (isDemoLfmModel(saved.llm_model)
          ? llmModels.find((model) => isDemoLfmModel(model.id))
          : undefined);
      llm = selected?.id || "";
      if (!selected && saved.llm_model) warnings.push("LLM model unavailable");
    }
    if (typeof saved.tts_streaming === "boolean")
      ttsStreaming = saved.tts_streaming;
    if (saved.tts_voice_id !== undefined) {
      selectSavedVoice(saved.tts_voice_id);
      if (
        saved.tts_voice_id &&
        !protectedVoices.some((id) => `preset-${id}` === saved.tts_voice_id) &&
        !savedVoices.some((voice) => voice.id === saved.tts_voice_id)
      )
        warnings.push("Saved voice unavailable");
    }
    if (voiceFile && typeof saved.tts_reference_text === "string")
      referenceText = saved.tts_reference_text;
    if (typeof saved.tts_test_text === "string")
      cloneTestText = saved.tts_test_text;
    settingsStatus = warnings.length
      ? `Loaded model settings: ${warnings.join("; ")}. Choose replacements.`
      : "Loaded server model settings";
  }
  async function saveModelSettings() {
    if (
      settingsLoading ||
      savingSettings ||
      connected ||
      starting ||
      cloneBusy ||
      cloneRecording
    )
      return;
    savingSettings = true;
    greetingAborter?.abort();
    clearTimeout(greetingTimer);
    try {
      if (
        !Number.isFinite(threshold) ||
        threshold < 0.01 ||
        threshold > 0.99 ||
        !Number.isInteger(windowMs) ||
        windowMs < 300 ||
        windowMs > 2000
      )
        throw new Error(
          "Enter a valid VAD threshold and turn window before saving.",
        );
      if (voiceFile && !savedVoiceId) {
        const id = createLocalId(),
          name = voiceName.trim() || voiceFile.name;
        await saveVoice({
          id,
          name,
          transcript: referenceText,
          audio: await browserDecodeToWav(voiceFile, 24000, 1),
          createdAt: Date.now(),
        });
        await refreshVoices();
        savedVoiceId = id;
      }
      // Keep the existing CSV editors as the single source of truth for text.
      await Promise.all([
        endpointJson("", "ui/greetings", {
          method: "POST",
          body: JSON.stringify({ content: writeGreetingCsv(greeting) }),
        }),
        endpointJson("", "ui/prompt", {
          method: "POST",
          body: JSON.stringify({ content: prompt }),
        }),
        endpointJson("", "ui/hotwords", {
          method: "POST",
          body: JSON.stringify({ content: writeHotwordsCsv(hotwords) }),
        }),
      ]);
      const settings: DemoSettings = {
        schema_version: 1,
        vad_enabled: useVad,
        asr_enabled: useAsr,
        llm_enabled: useLlm,
        tts_enabled: useTts,
        ...audioModelSettings("vad", selectedVad),
        ...audioModelSettings("asr", selectedAsr),
        ...audioModelSettings("tts", selectedTts),
        vad_threshold: threshold,
        vad_window_ms: windowMs,
        llm_model: llm,
        tts_streaming: ttsStreaming,
        tts_voice_id: savedVoiceId,
        tts_reference_text: voiceFile ? referenceText : "",
        tts_test_text: cloneTestText,
      };
      await endpointJson("", "ui/demo-settings", {
        method: "POST",
        body: JSON.stringify({ settings }),
      });
      settingsStatus = "Model settings saved on server";
      fileStatus = "Saved greetings.csv, prompt.csv and hotwords.csv";
    } catch (cause) {
      settingsStatus = `Settings save failed: ${cause instanceof Error ? cause.message : cause}`;
    } finally {
      savingSettings = false;
    }
  }
  let systemModel = "",
    systemDescription = "";
  async function loadSystemInfo() {
    try {
      const info = await endpointJson<{
        short_model?: string;
        display_name?: string;
        os?: string;
        description?: string;
      }>("", "ui/system-info", { cache: "no-store" });
      systemModel = info.display_name || info.short_model || info.os || "";
      systemDescription = info.description || "";
    } catch {
      /* Keep a generic header when host information is unavailable. */
    }
  }
  let detailsWidth = 225,
    bottomHeight = 320,
    eventsShare = 50,
    waveHeight = 124,
    composerHeight = 136;
  let viewportHeight = 900;
  function savePanelLayout() {
    try {
      localStorage.setItem(
        "geovision.demo.panel-layout",
        JSON.stringify({
          detailsWidth,
          bottomHeight,
          eventsShare,
          waveHeight,
          composerHeight,
        }),
      );
    } catch {}
  }
  function restorePanelLayout() {
    bottomHeight = Math.max(260, Math.min(380, window.innerHeight * 0.33));
    try {
      const saved = JSON.parse(
        localStorage.getItem("geovision.demo.panel-layout") || "{}",
      );
      const bounded = (
        name: string,
        fallback: number,
        min: number,
        max: number,
      ) =>
        typeof saved[name] === "number" && Number.isFinite(saved[name])
          ? Math.max(min, Math.min(max, saved[name]))
          : fallback;
      detailsWidth = bounded("detailsWidth", detailsWidth, 150, 500);
      bottomHeight = bounded(
        "bottomHeight",
        bottomHeight,
        160,
        Math.max(260, window.innerHeight - 400),
      );
      eventsShare = bounded("eventsShare", eventsShare, 20, 80);
      waveHeight = bounded("waveHeight", waveHeight, 70, 260);
      composerHeight = bounded("composerHeight", composerHeight, 120, 300);
    } catch {}
  }
  let sidebarWidth = 290;
  let resizingSidebar = false;
  function setSidebarWidth(width: number) {
    if (window.innerWidth <= 700) return;
    sidebarWidth = Math.round(
      Math.max(240, Math.min(width, 640, window.innerWidth - 420)),
    );
  }
  function saveSidebarWidth() {
    try {
      localStorage.setItem(
        "geovision.demo.sidebar-width",
        String(sidebarWidth),
      );
    } catch {}
  }
  function resizeSidebar(event: PointerEvent) {
    if (!resizingSidebar) return;
    const divider = event.currentTarget as HTMLElement;
    const left = divider.parentElement?.getBoundingClientRect().left || 0;
    setSidebarWidth(event.clientX - left);
  }
  function finishSidebarResize() {
    if (!resizingSidebar) return;
    resizingSidebar = false;
    saveSidebarWidth();
  }
  function sidebarResizeKey(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    setSidebarWidth(
      event.key === "Home"
        ? 240
        : event.key === "End"
          ? 640
          : sidebarWidth + (event.key === "ArrowRight" ? 20 : -20),
    );
    saveSidebarWidth();
  }
  type Event = {
    time: string;
    run: string;
    type: string;
    summary: string;
    runtimeMs?: number | null;
    rtf?: number | null;
  };
  type DemoMessage = ChatMessage & {
    audioId?: string;
    audioUrl?: string;
    audioName?: string;
  };
  type AudioExample = { name: string; url: string };
  let incomingPlayer: HTMLAudioElement | null = null,
    incomingBuffer: AudioBuffer | null = null;
  let stopIncomingPlayback: (() => void) | null = null;
  let chatAudioElements: Record<string, HTMLAudioElement> = {};
  const audioUrls = new Set<string>();
  function releaseChatAudio() {
    Object.values(chatAudioElements).forEach((element) => element?.pause());
    for (const url of audioUrls) URL.revokeObjectURL(url);
    audioUrls.clear();
    chatAudioElements = {};
  }
  let scenarioMode: "audio" | "maintenance" = "audio";
  let scenarioPreviewUrl = "",
    selectedExampleName = "",
    activeExampleName = "",
    exampleLoading = false;
  let scenarioPreviewPlayer: HTMLAudioElement | null = null;
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
  let playbackRole: "assistant" | "technician" | "caller" = "assistant";
  const scenarioAudioExamples = [
    { name: "中央監控站2.mp3", url: centralAudio },
    { name: "中控室.mp3", url: controlAudio },
    { name: "員工檢查哨.mp3", url: employeeAudio },
    { name: "大廳.mp3", url: lobbyAudio },
    { name: "車輛檢查哨.mp3", url: vehicleAudio },
  ];
  $: technicianVoice = voiceChoices.find((id) => id !== voice) || "";
  let events: Event[] = [],
    messages: DemoMessage[] = [];
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
    !settingsLoading &&
    !savingSettings &&
    (!useAsr || (selectedAsr && (!useVad || selectedVad))) &&
    (!useLlm || (selectedLlm && !llmNeedsDownload)) &&
    (!useTts ||
      (selectedTts &&
        greeting.trim() &&
        (!savedVoiceId ||
          protectedVoice ||
          savedVoices.some((v) => v.id === savedVoiceId)))) &&
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
  let hotwords = "",
    savingHotwords = false,
    hotwordsStatus = "";
  let ttsStreaming = false;
  $: ttsSupportsStreaming = (
    modelModes[selectedTts?.family || ""] || []
  ).includes("streaming");
  $: streamingTts = useTts && ttsStreaming && ttsSupportsStreaming;
  function streamingSpeechBody(body: Record<string, unknown>) {
    const chunkedText = catalog.some(
      (entry) =>
        entry.family === selectedTts?.family &&
        entry.request_options?.includes("text_chunk_size"),
    );
    return chunkedText
      ? {
          ...body,
          options: {
            text_chunk_size: "80",
            ...((body.options as Record<string, unknown>) || {}),
          },
        }
      : body;
  }
  function setTtsStreaming(enabled: boolean) {
    ttsStreaming = enabled;
    try {
      localStorage.setItem("geovision.demo.tts-streaming", String(enabled));
    } catch {}
  }
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
  let savedVoices: SavedVoice[] = [];
  let savedVoiceId = "preset-lingCLvocals",
    voiceName = "",
    voiceLibraryStatus = "";
  const protectedVoices = ["lingCLvocals", "wangSG9s"];
  $: protectedVoice = protectedVoices.some(
    (id) => savedVoiceId === `preset-${id}`,
  );
  $: customSavedVoices = savedVoices.filter(
    (v) => !protectedVoices.some((id) => v.id === `preset-${id}`),
  );
  let referencePreviewUrl = "";
  let referencePreviewPlayer: HTMLAudioElement | undefined;
  $: builtinReference = savedVoices.find((v) => v.id === `preset-${voice}`);
  $: updateReferencePreview(voiceFile, voice);
  function updateReferencePreview(file: File | null, builtin: string) {
    referencePreviewPlayer?.pause();
    if (referencePreviewUrl.startsWith("blob:"))
      URL.revokeObjectURL(referencePreviewUrl);
    referencePreviewUrl = file
      ? URL.createObjectURL(file)
      : `/v1/ui/voice-preview?voice=${encodeURIComponent(builtin)}`;
  }
  let cloneTestText = "這裡是複製聲音TTS的測試";
  let cloneTestUrl = "";
  let cloneTestPlayer: HTMLAudioElement | undefined;
  let cloneTestAborter: AbortController | null = null;
  function clearCloneTest() {
    cloneTestAborter?.abort();
    cloneTestPlayer?.pause();
    if (cloneTestUrl) URL.revokeObjectURL(cloneTestUrl);
    cloneTestUrl = "";
  }
  async function refreshVoices() {
    try {
      savedVoices = await listVoices();
    } catch (cause) {
      voiceLibraryStatus = `Voice library: ${cause instanceof Error ? cause.message : cause}`;
    }
  }
  function selectSavedVoice(id: string) {
    clearCloneTest();
    cloneAborter?.abort();
    savedVoiceId = id;
    const builtin = protectedVoices.find((name) => id === `preset-${name}`);
    if (builtin) voice = builtin;
    const saved = savedVoices.find((v) => v.id === id);
    voiceFile =
      saved && !builtin
        ? new File([saved.audio], `${saved.name}.wav`, { type: "audio/wav" })
        : null;
    referenceText = saved?.transcript || defaultReferenceText;
    voiceName = builtin || saved?.name || "";
    referencePath = "";
    cloneStatus = "";
  }
  async function addCloneVoice() {
    if (!voiceFile || cloneBusy || !voiceName.trim()) return;
    cloneBusy = true;
    try {
      const id = createLocalId();
      await saveVoice({
        id,
        name: voiceName.trim(),
        transcript: referenceText.trim(),
        audio: await browserDecodeToWav(voiceFile, 24000, 1),
        createdAt: Date.now(),
      });
      await refreshVoices();
      savedVoiceId = id;
      voiceLibraryStatus = "Voice saved on the server for all clients.";
    } catch (cause) {
      voiceLibraryStatus = `Save failed: ${cause instanceof Error ? cause.message : cause}`;
    } finally {
      cloneBusy = false;
    }
  }
  async function removeCloneVoice() {
    if (!savedVoiceId || protectedVoice || cloneBusy) return;
    cloneBusy = true;
    try {
      await deleteVoice(savedVoiceId);
      selectSavedVoice("");
      await refreshVoices();
      voiceLibraryStatus = "Voice deleted from the server.";
    } catch (cause) {
      voiceLibraryStatus = `Delete failed: ${cause instanceof Error ? cause.message : cause}`;
    } finally {
      cloneBusy = false;
    }
  }
  async function testCloneVoice() {
    if (
      (!voiceFile && !protectedVoice) ||
      (voiceFile && !referenceText.trim()) ||
      !cloneTestText.trim() ||
      cloneBusy
    )
      return;
    clearCloneTest();
    referencePreviewPlayer?.pause();
    greetingAborter?.abort();
    clearTimeout(greetingTimer);
    const aborter = new AbortController();
    cloneTestAborter = aborter;
    cloneBusy = true;
    cloneStatus = "Generating cloned voice…";
    const started = performance.now();
    let previewContext: AudioContext | null = null;
    try {
      if (streamingTts) {
        previewContext = new AudioContext();
        await previewContext.resume();
      }
      const model = await load(
        ttsKey,
        aborter.signal,
        true,
        previewContext ? "streaming" : "offline",
      );
      const body: Record<string, unknown> = { model, input: cloneTestText };
      if (voiceFile) {
        body.voice_ref = await uploadWav(
          await browserDecodeToWav(voiceFile, 24000, 1),
          aborter.signal,
        );
        body.reference_text = referenceText;
      } else body.voice = voice;
      const result = previewContext
        ? await playSpeechStream(
            previewContext,
            streamingSpeechBody(body),
            aborter.signal,
            {
              collectAudio: true,
              onFirstAudio: (wallMs) => {
                cloneStatus = "Playing cloned voice · streaming";
                record("TTS_FIRST_AUDIO", "Cloned voice first chunk", wallMs);
              },
            },
          )
        : await synthesizeSpeech(body, aborter.signal);
      if (aborter.signal.aborted) return;
      if (!result.audio)
        throw new Error("The model produced no reference test audio.");
      cloneTestUrl = URL.createObjectURL(result.audio);
      record(
        "CLONE_TEST_TTS_COMPLETED",
        "Cloned voice test",
        performance.now() - started,
        result.rtf,
      );
      await tick();
      try {
        if (!previewContext) await cloneTestPlayer?.play();
        cloneStatus = "Cloned voice test ready.";
      } catch {
        cloneStatus = "Press play below to hear the cloned voice.";
      }
    } catch (cause) {
      if (!aborter.signal.aborted)
        cloneStatus = `Voice test failed: ${cause instanceof Error ? cause.message : cause}`;
    } finally {
      if (previewContext) await previewContext.close().catch(() => undefined);
      cloneBusy = false;
    }
  }
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
    mounted && filesReady && !settingsLoading && !savingSettings && useTts,
    connected || starting,
    ttsKey,
    voice,
    voiceFile,
    referenceText,
    greeting,
    cloneRecording || cloneBusy,
    streamingTts,
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
    rtf: number | null = null,
  ) {
    events = [
      { time: new Date().toISOString(), run, type, summary, runtimeMs, rtf },
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
  async function load(
    key: string,
    signal: AbortSignal,
    announce = true,
    mode = "offline",
  ) {
    const model = audioModels.find((m) => m.key === key);
    if (!model)
      throw new Error(
        "The selected model is no longer available. Refresh models.",
      );
    const id = `demo-${model.id}${mode === "streaming" ? "-streaming" : ""}`;
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
          mode,
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
          reportedRtf(result),
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
    options: {
      speakTechnician?: boolean;
      playInputAudio?: boolean;
      audioName?: string;
    } = {},
  ) {
    const signal = controller?.signal;
    if (!connected || busy || !signal) return;
    busy = true;
    error = "";
    reset();
    const turnStarted = performance.now();
    let operationStarted = turnStarted;
    let audioMessageId = "";
    try {
      if (audio && options.playInputAudio) {
        audioMessageId = `audio-${epoch}-${performance.now()}`;
        const url = URL.createObjectURL(audio);
        audioUrls.add(url);
        messages = [
          ...messages,
          {
            role: "user",
            content: "",
            audioId: audioMessageId,
            audioUrl: url,
            audioName: options.audioName || "Audio message",
          },
        ];
        await tick();
        const wallMs = await playIncomingAudio(
          audio,
          audioMessageId,
          generation,
          signal,
        );
        if (signal.aborted || generation !== epoch) return;
        record(
          "INPUT_AUDIO_PLAYED",
          options.audioName || "Audio message",
          wallMs,
        );
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
            reportedRtf(result),
          );
          if (options.playInputAudio)
            throw new Error(
              `No speech recognized in ${options.audioName || "the audio message"}. The sequence stopped.`,
            );
          return;
        }
        record(
          "ASR_COMPLETED",
          text,
          performance.now() - operationStarted,
          reportedRtf(result),
        );
      }
      if (generation !== epoch) return;
      if (audioMessageId)
        messages = messages.map((message) =>
          message.audioId === audioMessageId
            ? { ...message, content: text }
            : message,
        );
      else messages = [...messages, { role: "user", content: text }];
      record("CONVERSATION_ITEM_ADDED", `USER · ${text}`);
      if (options.speakTechnician && useTts) {
        if (!technicianVoice)
          throw new Error(
            "Choose a TTS model with two built-in voices for the scenario.",
          );
        operationStarted = performance.now();
        const id = await load(
          ttsKey,
          signal,
          true,
          streamingTts ? "streaming" : "offline",
        );
        status = "Synthesizing technician voice";
        const body = {
          model: id,
          input: maintenanceSpeechText(text),
          voice: technicianVoice,
        };
        let wallMs: number | null;
        if (streamingTts)
          wallMs = (await streamTts(body, generation, signal, "technician"))
            .playbackMs;
        else {
          const synthesis = await synthesizeSpeech(body, signal);
          record(
            "TECHNICIAN_TTS_COMPLETED",
            technicianVoice,
            performance.now() - operationStarted,
            synthesis.rtf,
          );
          wallMs = await playAudio(
            synthesis.audio,
            generation,
            "technician",
            signal,
          );
        }
        if (signal.aborted || generation !== epoch) return;
        record("TECHNICIAN_PLAYED", text, wallMs);
      }

      let reply = text;
      if (useLlm) {
        status = "Thinking";
        record("AGENT_STATE_CHANGED", "listening → thinking");
        operationStarted = performance.now();
        const readyLlm = await ensureDemoLlmReady(
          llmBase(),
          llm,
          signal,
          (message) => {
            status = message;
          },
        );
        if (generation !== epoch || signal.aborted) return;
        llm = readyLlm;
        status = "Thinking";
        const response = await endpointJson<any>(
          llmBase(),
          "chat/completions?autoload=true",
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
                ...messages
                  .filter((message) => message.content.trim())
                  .map(({ role, content }) => ({ role, content })),
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
        record(
          "LLM_COMPLETED",
          llm,
          performance.now() - operationStarted,
          reportedRtf(response),
        );
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
        const ttsId = await load(
          ttsKey,
          signal,
          true,
          streamingTts ? "streaming" : "offline",
        );
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
        let playbackMs: number | null;
        if (streamingTts)
          playbackMs = (await streamTts(body, generation, signal)).playbackMs;
        else {
          const synthesis = await synthesizeSpeech(body, signal);
          if (generation !== epoch) return;
          record(
            "TTS_COMPLETED",
            selectedTts?.label || "Speech synthesized",
            performance.now() - operationStarted,
            synthesis.rtf,
          );
          playbackMs = await playAudio(
            synthesis.audio,
            generation,
            "assistant",
            signal,
          );
        }
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
      const [savedGreeting, savedPrompt, savedHotwords] = await Promise.all([
        endpointJson<{ content: string }>("", "ui/greetings"),
        endpointJson<{ content: string }>("", "ui/prompt"),
        endpointJson<{ content: string }>("", "ui/hotwords"),
      ]);
      greeting = readGreetingCsv(savedGreeting.content);
      prompt = savedPrompt.content;
      hotwords = readHotwordsCsv(savedHotwords.content);
      hotwordsStatus = "Loaded hotwords.csv";
      filesReady = true;
      fileStatus = "Loaded greetings.csv and prompt.csv";
    } catch (cause) {
      fileStatus = `CSV load failed: ${cause instanceof Error ? cause.message : cause}`;
    }
  }
  async function saveHotwordsCsv() {
    savingHotwords = true;
    try {
      const result = await endpointJson<{ content: string }>(
        "",
        "ui/hotwords",
        {
          method: "POST",
          body: JSON.stringify({ content: writeHotwordsCsv(hotwords) }),
        },
      );
      hotwords = readHotwordsCsv(result.content);
      hotwordsStatus = "Saved hotwords.csv";
    } catch (cause) {
      hotwordsStatus = `Hotwords save failed: ${cause instanceof Error ? cause.message : cause}`;
    } finally {
      savingHotwords = false;
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
      if (useTts && !streamingTts) await prepareGreeting();
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
  async function streamTts(
    body: Record<string, unknown>,
    generation: number,
    signal: AbortSignal,
    role: "assistant" | "technician" = "assistant",
    leadInSeconds = 0.06,
  ): Promise<SpeechStreamSummary> {
    const ctx = context;
    if (!ctx || signal.aborted || generation !== epoch)
      throw new DOMException("Call ended", "AbortError");
    const streamAnalyser = ctx.createAnalyser();
    streamAnalyser.fftSize = 512;
    streamAnalyser.connect(ctx.destination);
    analyser = streamAnalyser;
    let began = false;
    try {
      return await playSpeechStream(ctx, streamingSpeechBody(body), signal, {
        destination: streamAnalyser,
        leadInSeconds,
        onFirstAudio: (wallMs) => {
          began = true;
          speaking = true;
          playbackRole = role;
          status =
            role === "technician"
              ? "Technician speaking · streaming"
              : "Speaking · streaming";
          record(
            role === "technician"
              ? "TECHNICIAN_STATE_CHANGED"
              : "AGENT_STATE_CHANGED",
            "thinking → speaking",
          );
          record("TTS_FIRST_AUDIO", "First streamed audio chunk", wallMs);
        },
        onSynthesized: (summary) =>
          record(
            role === "technician"
              ? "TECHNICIAN_TTS_COMPLETED"
              : "TTS_COMPLETED",
            `${selectedTts?.label || "Speech"} · streaming · ${summary.chunks} chunks`,
            summary.wallMs,
            summary.rtf,
          ),
      });
    } finally {
      streamAnalyser.disconnect();
      if (analyser === streamAnalyser) analyser = null;
      if (generation === epoch) {
        speaking = false;
        playbackRole = "assistant";
        if (role === "technician") inputBars = Array(36).fill(2);
        if (began)
          record(
            role === "technician"
              ? "TECHNICIAN_STATE_CHANGED"
              : "AGENT_STATE_CHANGED",
            "speaking → listening",
          );
      }
    }
  }
  async function synthesizeSpeech(
    body: Record<string, unknown>,
    signal: AbortSignal,
  ) {
    const result = await endpointJson<{
      audio: string;
      timing?: { rtf?: number };
    }>(
      "",
      "audio/speech",
      {
        method: "POST",
        body: JSON.stringify({ ...body, response_format: "json" }),
      },
      signal,
    );
    if (typeof result.audio !== "string" || !result.audio)
      throw new Error("TTS returned no audio.");
    const bytes = Uint8Array.from(atob(result.audio), (character) =>
      character.charCodeAt(0),
    );
    return {
      audio: new Blob([bytes], { type: "audio/wav" }),
      rtf: reportedRtf(result),
    };
  }
  async function playIncomingAudio(
    audio: Blob,
    id: string,
    generation: number,
    signal: AbortSignal,
  ): Promise<number | null> {
    const element = chatAudioElements[id],
      ctx = context;
    if (!element || !ctx || generation !== epoch || signal.aborted) return null;
    const buffer = await ctx.decodeAudioData(await audio.arrayBuffer());
    if (generation !== epoch || signal.aborted) return null;
    const started = performance.now();
    incomingPlayer = element;
    incomingBuffer = buffer;
    speaking = true;
    playbackRole = "caller";
    status = "Playing caller audio";
    record("USER_STATE_CHANGED", "audio playback started");
    try {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          element.onended = null;
          element.onerror = null;
          element.onplay = null;
          stopIncomingPlayback = null;
        };
        const finish = () => {
          cleanup();
          resolve();
        };
        element.onended = finish;
        element.onplay = () => {
          status = "Playing caller audio";
        };
        element.onerror = () => {
          cleanup();
          reject(new Error("Could not play the audio message."));
        };
        stopIncomingPlayback = () => {
          element.pause();
          finish();
        };
        void element.play().catch((cause) => {
          if (cause?.name === "NotAllowedError")
            status = "Press Play on the audio message to continue";
          else {
            cleanup();
            reject(cause);
          }
        });
      });
      return performance.now() - started;
    } finally {
      if (incomingPlayer === element) {
        incomingPlayer = null;
        incomingBuffer = null;
        speaking = false;
        playbackRole = "assistant";
        inputBars = Array(36).fill(2);
      }
    }
  }
  async function playAudio(
    output: Blob,
    generation: number,
    role: "assistant" | "technician" = "assistant",
    signal?: AbortSignal,
    leadInSeconds = 0,
  ): Promise<number | null> {
    const started = performance.now();
    const ctx = context;
    if (generation !== epoch || !ctx || signal?.aborted) return null;
    await ctx.resume();
    if (generation !== epoch || context !== ctx || signal?.aborted) return null;
    const buffer = await ctx.decodeAudioData(await output.arrayBuffer());
    if (generation !== epoch || context !== ctx || signal?.aborted) return null;
    const node = ctx.createBufferSource();
    if (leadInSeconds > 0) {
      // Render silence first so a newly opened output device does not clip
      // the greeting's first syllable. Keep every sample of the TTS audio.
      const leadFrames = Math.ceil(leadInSeconds * buffer.sampleRate);
      const padded = ctx.createBuffer(
        buffer.numberOfChannels,
        leadFrames + buffer.length,
        buffer.sampleRate,
      );
      for (let channel = 0; channel < buffer.numberOfChannels; channel++)
        padded.copyToChannel(
          buffer.getChannelData(channel),
          channel,
          leadFrames,
        );
      node.buffer = padded;
    } else node.buffer = buffer;
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
    streaming: boolean,
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
    if (streaming) {
      greetingAborter?.abort();
      greetingStatus = "Greeting will stream after connection";
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
      const started = performance.now();
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
        const synthesis = await synthesizeSpeech(body, aborter.signal);
        const audio = synthesis.audio;
        if (!aborter.signal.aborted && greetingFingerprint() === key) {
          record(
            "GREETING_TTS_COMPLETED",
            "Prepared call greeting",
            performance.now() - started,
            synthesis.rtf,
          );
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
    const started = performance.now();
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
        record(
          referenceText ? "ASR_COMPLETED" : "ASR_EMPTY",
          `Reference voice: ${referenceText || "No speech recognized"}`,
          performance.now() - started,
          reportedRtf(result),
        );
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
  function chooseReference(file: File | null, source = "file") {
    clearCloneTest();
    savedVoiceId = "";
    const stamp = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    voiceName = file
      ? `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}-${pad(stamp.getHours())}-${pad(stamp.getMinutes())}-${pad(stamp.getSeconds())}-${source === "mic" ? "mic" : file.name}`
      : "";
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
    referencePreviewPlayer?.pause();
    clearCloneTest();
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
            "mic",
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
  function setScenarioFile(file: File | null, exampleName = "") {
    scenarioPreviewPlayer?.pause();
    if (scenarioPreviewUrl) URL.revokeObjectURL(scenarioPreviewUrl);
    scenarioFile = file;
    scenarioAudioName = file?.name || "";
    selectedExampleName = exampleName;
    scenarioPreviewUrl = file ? URL.createObjectURL(file) : "";
  }
  async function selectScenarioExample(example: AudioExample) {
    if (scenarioRunning || exampleLoading) return;
    exampleLoading = true;
    try {
      setScenarioFile(await loadScenarioExample(example), example.name);
      scenarioStatus = "Audio selected · press Send audio";
    } catch (cause) {
      scenarioStatus = cause instanceof Error ? cause.message : String(cause);
    } finally {
      exampleLoading = false;
    }
  }
  async function loadScenarioExample(example: AudioExample): Promise<File> {
    if (example.url.startsWith("data:")) {
      const comma = example.url.indexOf(",");
      if (comma < 0) throw new Error(`Invalid bundled audio: ${example.name}`);
      const header = example.url.slice(0, comma),
        payload = example.url.slice(comma + 1);
      const binary = /;base64$/i.test(header)
        ? atob(payload)
        : payload.replace(/%([0-9a-f]{2})/gi, (_m, hex: string) =>
            String.fromCharCode(parseInt(hex, 16)),
          );
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new File([bytes], example.name, {
        type: header.slice(5).split(";")[0] || "audio/mpeg",
      });
    }
    const response = await fetch(example.url, { signal: controller?.signal });
    if (!response.ok)
      throw new Error(`Example audio failed: ${response.status}`);
    return new File([await response.blob()], example.name, {
      type: "audio/mpeg",
    });
  }
  async function runScenario(stepOnly?: number, examples?: AudioExample[]) {
    if (scenarioRunning || busy || detecting || starting) return;
    if (
      scenarioMode === "audio" &&
      ((!scenarioFile && !examples?.length) || !useAsr)
    )
      return;
    if (scenarioMode === "maintenance" && useTts && !technicianVoice) {
      scenarioStatus = "Two built-in voices are required.";
      return;
    }
    const token = ++scenarioToken;
    scenarioRunning = true;
    scenarioPreviewPlayer?.pause();
    manualRecording = false;
    manualParts = [];
    error = "";
    scenarioStatus = "Starting scenario…";
    try {
      if (!connected) await call();
      if (!connected || token !== scenarioToken) return;
      if (scenarioMode === "audio") {
        const queue = examples || [null];
        for (let index = 0; index < queue.length; index++) {
          if (!connected || token !== scenarioToken) break;
          const example = queue[index];
          const file = example
            ? await loadScenarioExample(example)
            : scenarioFile!;
          if (!connected || token !== scenarioToken) break;
          setScenarioFile(file, example?.name || selectedExampleName);
          activeExampleName = example?.name || selectedExampleName;
          scenarioStatus = `Scenario 1 · ${index + 1}/${queue.length} · ${file.name}`;
          await respond("", file, epoch, {
            playInputAudio: true,
            audioName: file.name,
          });
          if (error || token !== scenarioToken) break;
          activeExampleName = "";
        }
        if (!error && token === scenarioToken)
          scenarioStatus =
            queue.length > 1
              ? "All 5 examples complete"
              : "Scenario 1 complete";
      } else {
        if (stepOnly === undefined) {
          releaseChatAudio();
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
    } catch (cause) {
      if (token === scenarioToken) {
        fail(cause);
        scenarioStatus = error;
      }
    } finally {
      if (token === scenarioToken) {
        scenarioRunning = false;
        activeExampleName = "";
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
    activeExampleName = "";
    scenarioPreviewPlayer?.pause();
    controller?.abort();
    if (connected) controller = new AbortController();
    if (player) player.stop();
    stopIncomingPlayback?.();
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
    referencePreviewPlayer?.pause();
    clearCloneTest();
    if (connected || starting || !canCall || cloneRecording || cloneBusy)
      return;
    const generation = ++epoch;
    starting = true;
    scenarioPreviewPlayer?.pause();
    error = "";
    status = "Connecting";
    run = new Date().toLocaleTimeString();
    releaseChatAudio();
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
          if (!(speaking && playbackRole !== "assistant"))
            inputBars = muted ? Array(36).fill(2) : bars(samples);
          const replaying =
            (scenarioPreviewPlayer &&
              !scenarioPreviewPlayer.paused &&
              !scenarioPreviewPlayer.ended) ||
            Object.values(chatAudioElements).some(
              (element) => element && !element.paused && !element.ended,
            );
          if (muted || busy || speaking || scenarioRunning || replaying) {
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
        if (incomingPlayer && incomingBuffer && !incomingPlayer.paused) {
          const start = Math.floor(
            incomingPlayer.currentTime * incomingBuffer.sampleRate,
          );
          inputBars = bars(
            incomingBuffer.getChannelData(0).subarray(start, start + 512),
          );
          outputBars = Array(36).fill(2);
        } else if (incomingPlayer) {
          inputBars = Array(36).fill(2);
          outputBars = Array(36).fill(2);
        } else if (analyser && speaking) {
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
        let playbackMs: number | null;
        if (
          streamingTts &&
          !(preparedKey === greetingFingerprint() && preparedGreeting)
        ) {
          greetingAborter?.abort();
          const id = await load(ttsKey, controller.signal, true, "streaming");
          const body: Record<string, unknown> = { model: id, input: greeting };
          if (referencePath && supportsReference) {
            body.voice_ref = referencePath;
            body.reference_text = referenceText;
          } else body.voice = voice;
          messages = [{ role: "assistant", content: greeting }];
          await tick();
          if (generation !== epoch || !connected) return;
          playbackMs = (
            await streamTts(
              body,
              generation,
              controller.signal,
              "assistant",
              0.3,
            )
          ).playbackMs;
        } else {
          const audio = await prepareGreeting();
          if (generation !== epoch) return;
          if (!audio)
            throw new Error(greetingStatus || "Greeting synthesis failed.");
          messages = [{ role: "assistant", content: greeting }];
          await tick();
          if (generation !== epoch || !connected) return;
          playbackMs = await playAudio(
            audio,
            generation,
            "assistant",
            controller.signal,
            0.3,
          );
        }
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
    activeExampleName = "";
    scenarioPreviewPlayer?.pause();
    epoch++;
    stopIncomingPlayback?.();
    Object.values(chatAudioElements).forEach((element) => element?.pause());
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
    try {
      const savedWidth = Number(
        localStorage.getItem("geovision.demo.sidebar-width"),
      );
      if (savedWidth > 0 && Number.isFinite(savedWidth))
        setSidebarWidth(savedWidth);
    } catch {}
    try {
      ttsStreaming =
        localStorage.getItem("geovision.demo.tts-streaming") === "true";
    } catch {}
    restorePanelLayout();
    void loadSystemInfo();
    void initializeSidebar();
    try {
      const saved = JSON.parse(localStorage.getItem(historyKey) || "[]");
      if (Array.isArray(saved))
        events = saved
          .filter(
            (e) =>
              typeof e?.summary === "string" && typeof e?.time === "string",
          )
          .slice(0, 300)
          .map((event) =>
            event.type === "USER_INPUT_TRANSCRIBED"
              ? { ...event, type: "ASR_COMPLETED" }
              : event,
          );
    } catch {}
  });
  onDestroy(() => {
    if (document.documentElement.dataset.theme === "dark") {
      if (previousTheme) document.documentElement.dataset.theme = previousTheme;
      else delete document.documentElement.dataset.theme;
    }
    clearCloneTest();
    referencePreviewPlayer?.pause();
    if (referencePreviewUrl.startsWith("blob:"))
      URL.revokeObjectURL(referencePreviewUrl);
    mounted = false;
    llmDownloading = false;
    stopLlmDownloadWatch();
    clearTimeout(greetingTimer);
    greetingAborter?.abort();
    cloneAborter?.abort();
    if (cloneRecorder?.state === "recording") cloneRecorder.stop();
    cloneStream?.getTracks().forEach((t) => t.stop());
    hangup(false);
    releaseChatAudio();
    if (scenarioPreviewUrl) URL.revokeObjectURL(scenarioPreviewUrl);
  });
</script>

<svelte:head><title>GeoVision · IVR</title></svelte:head>
<svelte:window
  bind:innerHeight={viewportHeight}
  on:resize={() => setSidebarWidth(sidebarWidth)}
/>
<div
  class="demo"
  class:resizing-sidebar={resizingSidebar}
  style:--sidebar-width={`${sidebarWidth}px`}
>
  <aside id="demo-settings">
    <div class="brand">
      <span class="gv">{@html logo}</span><span>GeoVision IVR</span>
    </div>
    <section
      class="stage-settings greeting-settings"
      aria-label="Call greeting settings"
    >
      <div class="stage-heading"><h2>Call greeting</h2></div>
      <fieldset
        disabled={settingsLoading ||
          savingSettings ||
          connected ||
          starting ||
          cloneRecording ||
          cloneBusy}
      >
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
    <div class="model-settings-actions">
      <button
        disabled={settingsLoading ||
          savingSettings ||
          connected ||
          starting ||
          discovering ||
          cloneRecording ||
          cloneBusy}
        on:click={saveModelSettings}
        >{savingSettings ? "Saving…" : "Save model settings"}</button
      >
      <button
        disabled={settingsLoading ||
          savingSettings ||
          connected ||
          starting ||
          discovering ||
          cloneRecording ||
          cloneBusy}
        on:click={refreshModels}
        >{discovering ? "Refreshing…" : "Refresh models"}</button
      >
    </div>
    {#if settingsStatus}<p class="settings-status" role="status">
        {settingsStatus}
      </p>{/if}
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
            disabled={settingsLoading ||
              savingSettings ||
              connected ||
              starting ||
              discovering ||
              cloneRecording ||
              cloneBusy}
          /><span>{useVad ? "On" : "Off"}</span></label
        >
      </div>
      <fieldset
        disabled={settingsLoading ||
          savingSettings ||
          connected ||
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
            disabled={settingsLoading ||
              savingSettings ||
              connected ||
              starting ||
              discovering ||
              cloneRecording ||
              cloneBusy}
          /><span>{useAsr ? "On" : "Off"}</span></label
        >
      </div>
      <fieldset
        disabled={settingsLoading ||
          savingSettings ||
          connected ||
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
        <button disabled={savingHotwords} on:click={saveHotwordsCsv}
          >{savingHotwords ? "Saving…" : "Save hotwords.csv"}</button
        >
        {#if hotwordsStatus}<small role="status">{hotwordsStatus}</small>{/if}

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
            disabled={settingsLoading ||
              savingSettings ||
              connected ||
              starting ||
              discovering ||
              cloneRecording ||
              cloneBusy}
          /><span>{useLlm ? "On" : "Off"}</span></label
        >
      </div>
      <fieldset
        disabled={settingsLoading ||
          savingSettings ||
          connected ||
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
              : selectedLlm?.status?.value === "incomplete"
                ? "Resume LFM2.5 Q4_K_M"
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
            disabled={settingsLoading ||
              savingSettings ||
              connected ||
              starting ||
              discovering ||
              cloneRecording ||
              cloneBusy}
          /><span>{useTts ? "On" : "Off"}</span></label
        >
      </div>
      <fieldset
        class="tts-controls"
        disabled={settingsLoading ||
          savingSettings ||
          connected ||
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
        <label class="tts-streaming-switch"
          ><span>Streaming</span><input
            type="checkbox"
            role="switch"
            aria-label="TTS streaming"
            checked={streamingTts}
            disabled={!ttsSupportsStreaming}
            on:change={(e) => setTtsStreaming(e.currentTarget.checked)}
          />
          <span>{streamingTts ? "On" : "Off"}</span></label
        >
        <small
          >{ttsSupportsStreaming
            ? "Play chunks as speech is generated."
            : "This model supports offline speech only."}</small
        >
        {#if supportsReference}
          <div class="voice-picker-row">
            <label
              >Saved voices<select
                aria-label="Saved voices"
                value={savedVoiceId}
                on:change={(e) => selectSavedVoice(e.currentTarget.value)}
              >
                {#each protectedVoices as id}<option value={`preset-${id}`}
                    >{id}</option
                  >{/each}
                {#if savedVoiceId && !protectedVoice && !savedVoices.some((v) => v.id === savedVoiceId)}<option
                    value={savedVoiceId}
                    disabled>Saved voice unavailable</option
                  >{/if}
                <option value="">New recording / file</option>
                {#each customSavedVoices as saved}<option value={saved.id}
                    >{saved.name}</option
                  >{/each}
              </select></label
            >
            <button
              aria-label="Refresh voices"
              title="Refresh voices"
              on:click={refreshVoices}>↻</button
            >
          </div>
          <div class="voice-capture-row">
            <button
              aria-label="Record clone voice"
              title="Record clone voice"
              on:click={startCloneRecording}
              disabled={settingsLoading ||
                savingSettings ||
                connected ||
                starting ||
                cloneBusy ||
                !useTts ||
                (useAsr && !asrKey)}><Mic size={16} /></button
            >
            <input
              aria-label="Custom reference voice"
              title="Choose reference audio"
              type="file"
              accept="audio/*"
              on:change={(e) =>
                chooseReference(e.currentTarget.files?.[0] || null)}
            />
          </div>
          <div class="reference-recording">
            <small>Reference recording</small>
            <audio
              class="reference-preview"
              bind:this={referencePreviewPlayer}
              src={referencePreviewUrl}
              controls
              preload="metadata"
              aria-label="Voice reference playback"
              on:play={() => cloneTestPlayer?.pause()}
            ></audio>
          </div>
          <label
            >Reference transcript<textarea
              rows="2"
              value={voiceFile
                ? referenceText
                : builtinReference?.transcript || ""}
              readonly={!voiceFile}
              on:input={(e) => (referenceText = e.currentTarget.value)}
              placeholder={voiceFile
                ? "Exact words in reference audio"
                : "Bundled voice transcript unavailable"}></textarea></label
          >
          <div class="voice-name-actions">
            <label
              >Clone Custom Voice<input
                aria-label="Clone Custom Voice"
                value={protectedVoice ? voice : voiceName}
                readonly={protectedVoice}
                on:input={(e) => (voiceName = e.currentTarget.value)}
                placeholder="Record or choose a reference file"
              /></label
            >
            <button
              disabled={protectedVoice || !voiceFile || !voiceName.trim()}
              on:click={addCloneVoice}>Add</button
            >
            <button
              disabled={!savedVoiceId || protectedVoice}
              on:click={removeCloneVoice}>Delete</button
            >
          </div>
          {#if voiceLibraryStatus}<p role="status">{voiceLibraryStatus}</p>{/if}
          <div class="voice-test-row">
            <label
              >Clone TTS test<textarea rows="1" bind:value={cloneTestText}
              ></textarea></label
            >
            <button
              disabled={(!voiceFile && !protectedVoice) ||
                (voiceFile && !referenceText.trim()) ||
                !cloneTestText.trim() ||
                !ttsKey}
              on:click={testCloneVoice}>Send</button
            >
          </div>
        {/if}
      </fieldset>
      {#if cloneTestUrl}<audio
          bind:this={cloneTestPlayer}
          src={cloneTestUrl}
          controls
          aria-label="Cloned voice test playback"
        ></audio>{/if}
      {#if cloneRecording}<button
          aria-label="Stop recording"
          title="Stop recording"
          on:click={() => cloneRecorder?.stop()}><MicOff size={16} /></button
        >{/if}
      {#if cloneStatus}<p role="status">{cloneStatus}</p>{/if}
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
  <!-- A focusable separator is the ARIA window-splitter pattern; it supports arrow keys. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
  <div
    class="sidebar-divider"
    role="separator"
    aria-label="Resize sidebar"
    aria-controls="demo-settings"
    aria-orientation="vertical"
    aria-valuemin={240}
    aria-valuemax={640}
    aria-valuenow={sidebarWidth}
    tabindex="0"
    on:pointerdown={(event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      resizingSidebar = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    on:pointermove={resizeSidebar}
    on:pointerup={finishSidebarResize}
    on:pointercancel={finishSidebarResize}
    on:lostpointercapture={finishSidebarResize}
    on:keydown={sidebarResizeKey}
  ></div>
  <main
    style:--details-width={`${detailsWidth}px`}
    style:--bottom-height={`${bottomHeight}px`}
    style:--events-share={`${eventsShare}fr`}
    style:--scenarios-share={`${100 - eventsShare}fr`}
    style:--wave-height={`${waveHeight}px`}
    style:--composer-height={`${composerHeight}px`}
  >
    <header>
      <div>
        <strong>Console</strong><span
          class="badge"
          title={systemDescription || undefined}
          >LOCAL IVR DEMO{systemModel ? ` on ${systemModel}` : ""}</span
        >
      </div>
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
            {speaking && playbackRole !== "assistant"
              ? playbackRole === "technician"
                ? "TECHNICIAN"
                : "CALLER"
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
        <div class="wave-resize panel-resize">
          <PanelDivider
            label="Resize waveform"
            orientation="horizontal"
            bind:value={waveHeight}
            min={70}
            max={260}
            oncommit={savePanelLayout}
          />
        </div>
        <div
          class="transcript"
          bind:this={transcriptElement}
          aria-live="polite"
        >
          {#if !messages.length}<div class="empty">
              <h1>Your local voice assistant</h1>
              <p>Start a call, then speak or type a message.</p>
              <small>VAD → ASR → LLM → TTS</small>
            </div>{/if}{#each messages as message}<article
              class:user={message.role === "user"}
            >
              <small>{message.role === "user" ? "YOU" : "GEOVISION"}</small>
              {#if message.audioId && message.audioUrl}
                <strong class="audio-message-name">{message.audioName}</strong>
                <audio
                  controls
                  preload="metadata"
                  src={message.audioUrl}
                  aria-label={`Audio message: ${message.audioName}`}
                  bind:this={chatAudioElements[message.audioId]}
                ></audio>
              {/if}
              {#if message.content}<p>{message.content}</p>{/if}
            </article>{/each}
        </div>
        <div class="composer-resize panel-resize">
          <PanelDivider
            label="Resize message input"
            orientation="horizontal"
            bind:value={composerHeight}
            min={120}
            max={300}
            reverse
            oncommit={savePanelLayout}
          />
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
      <div class="details-resize panel-resize">
        <PanelDivider
          label="Resize session details"
          bind:value={detailsWidth}
          min={150}
          max={500}
          reverse
          oncommit={savePanelLayout}
        />
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
    <div class="bottom-resize panel-resize">
      <PanelDivider
        label="Resize bottom panels"
        orientation="horizontal"
        bind:value={bottomHeight}
        min={160}
        max={Math.max(260, viewportHeight - 400)}
        reverse
        oncommit={savePanelLayout}
      />
    </div>
    <div class="bottom-panels" data-resize-container>
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
                ><th title="Real-time factor reported by the model response"
                  >RTF</th
                ><th>EVENT TYPE</th><th>SUMMARY</th></tr
              ></thead
            ><tbody
              >{#each events as event}<tr
                  ><td>{new Date(event.time).toLocaleTimeString()}</td><td
                    class="runtime">{runtimeLabel(event.runtimeMs)}</td
                  ><td class="rtf">{rtfLabel(event.rtf)}</td><td
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
      <div class="events-resize panel-resize">
        <PanelDivider
          label="Resize events and scenarios"
          bind:value={eventsShare}
          min={20}
          max={80}
          percent
          oncommit={savePanelLayout}
        />
      </div>
      <section class="scenario-dock" aria-label="Demo scenarios">
        <div class="scenario-title"><strong>Scenarios</strong></div>
        <div class="scenario-panel">
          <label
            ><select
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
              <strong title={scenarioAudioName || "No audio selected"}
                >{scenarioAudioName || "No audio selected"}</strong
              >
              <small>WAV, MP3, FLAC</small>
              <label class="audio-choice"
                >Choose audio<input
                  class="audio-file-input"
                  aria-label="Choose scenario audio"
                  type="file"
                  accept=".wav,.mp3,.flac,audio/*"
                  disabled={scenarioRunning}
                  on:change={(e) =>
                    setScenarioFile(e.currentTarget.files?.[0] || null)}
                /></label
              >
            </div>
            <div class="example-chips">
              <small>Example audio</small>
              {#each scenarioAudioExamples as example}<button
                  class:selected={selectedExampleName === example.name}
                  class:processing={activeExampleName === example.name}
                  aria-pressed={selectedExampleName === example.name}
                  aria-current={activeExampleName === example.name
                    ? "step"
                    : undefined}
                  disabled={scenarioRunning ||
                    exampleLoading ||
                    busy ||
                    starting}
                  on:click={() => selectScenarioExample(example)}
                  >{example.name}</button
                >{/each}
            </div>
            {#if scenarioPreviewUrl}<audio
                class="scenario-preview"
                controls
                preload="metadata"
                src={scenarioPreviewUrl}
                aria-label="Selected audio preview"
                bind:this={scenarioPreviewPlayer}
              ></audio>{/if}
            <button
              disabled={scenarioRunning ||
                busy ||
                detecting ||
                starting ||
                !scenarioFile ||
                exampleLoading ||
                !useAsr ||
                (!connected && !canCall)}
              on:click={() => runScenario()}>Send audio</button
            ><button
              disabled={scenarioRunning ||
                busy ||
                detecting ||
                starting ||
                !useAsr ||
                (!connected && !canCall)}
              on:click={() => runScenario(undefined, scenarioAudioExamples)}
              >Play all 5 examples</button
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
    grid-template-columns: var(--sidebar-width, 290px) minmax(0, 1fr);
    position: relative;
    min-height: 100vh;
    font-family: Inter, system-ui, sans-serif;
    font-size: 13px;
    background: var(--bg);
    color: var(--text);
  }
  .sidebar-divider {
    position: absolute;
    left: calc(var(--sidebar-width, 290px) - 4px);
    top: 0;
    bottom: 0;
    width: 8px;
    z-index: 5;
    cursor: col-resize;
    touch-action: none;
    border-left: 2px solid transparent;
    outline: none;
  }
  .sidebar-divider:hover,
  .sidebar-divider:focus-visible,
  .resizing-sidebar .sidebar-divider {
    border-left-color: var(--accent, #38d9d3);
    background: #38d9d322;
  }
  .resizing-sidebar {
    user-select: none;
    cursor: col-resize;
  }
  .demo * {
    box-sizing: border-box;
  }
  .demo .tts-controls label {
    margin: 7px 0 3px;
  }
  .demo .tts-controls input,
  .demo .tts-controls select,
  .demo .tts-controls textarea {
    padding: 7px;
    margin-top: 4px;
  }
  .voice-name-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: end;
    gap: 4px;
  }
  .voice-test-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 5px;
  }
  .voice-name-actions button,
  .voice-test-row button {
    margin-bottom: 3px;
    padding: 8px 6px;
  }

  .voice-picker-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 6px;
  }
  .voice-capture-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .voice-capture-row input {
    min-width: 0;
    width: 100%;
    font-size: 11px;
  }
  .voice-picker-row button,
  .voice-capture-row button {
    padding: 7px;
  }
  .tts-controls textarea {
    min-height: 38px;
  }
  .stage-settings audio {
    width: 100%;
    min-width: 0;
    height: 34px;
  }
  .reference-preview {
    width: 100%;
    min-width: 0;
    height: 36px;
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
  .demo label.tts-streaming-switch {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .demo .tts-streaming-switch input {
    width: 16px;
    margin: 0;
  }
  .model-settings-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .model-settings-actions button {
    font-size: 11px;
    padding: 8px;
  }
  .settings-status {
    color: var(--muted);
    font-size: 11px;
    overflow-wrap: anywhere;
  }
  .stage-settings fieldset:disabled {
    opacity: 0.5;
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
    grid-template-columns: minmax(0, 1fr) 6px minmax(
        150px,
        var(--details-width, 225px)
      );
    min-height: 320px;
    flex: 1;
    padding: 20px;
    gap: 8px;
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
    grid-template-rows: auto minmax(0, 1fr);
    height: min(var(--wave-height, 124px), 40%);
    min-height: 70px;
    overflow: hidden;
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
    height: 100%;
    min-height: 0;
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
  .audio-message-name {
    display: block;
    margin-top: 8px;
    font-size: 11px;
    overflow-wrap: anywhere;
  }
  .transcript article audio {
    display: block;
    max-width: 100%;
    width: 290px;
    height: 36px;
    margin-top: 8px;
  }
  .transcript article p {
    margin: 6px 0;
    white-space: pre-wrap;
    line-height: 1.7;
  }
  .bottom-panels {
    display: grid;
    grid-template-columns: minmax(0, var(--events-share, 50fr)) 6px minmax(
        0,
        var(--scenarios-share, 50fr)
      );
    height: clamp(160px, var(--bottom-height, 320px), calc(100vh - 400px));
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
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 8px;
    border: 1px dashed var(--control-border);
    border-radius: 8px;
    padding: 8px 10px;
    margin-top: 10px;
  }
  .scenario-upload > strong {
    min-width: 0;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .scenario-upload > small {
    flex-shrink: 0;
    white-space: nowrap;
  }
  .demo .audio-choice {
    position: relative;
    display: inline-flex;
    margin: 0;
    padding: 7px 9px;
    background: var(--button-bg);
    border: 1px solid var(--control-border);
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .demo .audio-file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
    padding: 0;
    margin: 0;
    border: 0;
  }
  .audio-choice:focus-within {
    outline: 2px solid var(--blue);
    outline-offset: 2px;
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
  .demo .example-chips button.selected {
    background: #17375b;
    border-color: var(--blue);
    color: #b9d7ff;
  }
  .demo .example-chips button.processing {
    opacity: 1;
    box-shadow: 0 0 0 1px var(--blue);
  }
  .scenario-preview {
    display: block;
    width: 100%;
    height: 36px;
    margin: 8px 0;
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
    height: min(var(--composer-height, 136px), 45%);
    min-height: 120px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    padding: 14px;
    border-top: 1px solid var(--line);
  }
  .composer form {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .composer textarea {
    height: 100%;
    min-height: 35px;
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
    min-width: 0;
    overflow: auto;
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
  .events td.runtime,
  .events td.rtf {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .events th:nth-child(2) {
    width: 110px;
  }
  .events th:nth-child(3) {
    width: 80px;
  }
  .events th:nth-child(4) {
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
  .panel-resize {
    min-width: 0;
    min-height: 0;
  }
  .bottom-resize,
  .wave-resize,
  .composer-resize {
    height: 6px;
    flex: 0 0 6px;
  }
  @media (max-width: 1050px) {
    .details-resize,
    .events-resize {
      display: none;
    }
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
      grid-template-columns: var(--sidebar-width, 290px) minmax(0, 1fr);
    }
  }
  @media (max-width: 700px) {
    .sidebar-divider,
    .panel-resize {
      display: none;
    }
    .wave-area,
    .composer {
      height: auto;
    }
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
    .events th:nth-child(4) {
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
