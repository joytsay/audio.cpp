<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { DEFAULT_NOTICE_DELAY_SECONDS, ivrDialogue, type DialogueSource } from "$lib/n8n-dialogue";
  import {importScenarioFiles,listKnowledgeScenarios,removeKnowledgeScenario,type KnowledgeScenario} from "$lib/knowledge-scenarios";
  import SipSidebar from "$lib/SipSidebar.svelte";
  import type { SipSettings, SipLive } from "$lib/sip";
  import PanelDivider from "$lib/PanelDivider.svelte";
  import { catalog, modelModes, modelCapabilities } from "$lib/catalog";
  import {
    playSpeechStream,
    speechContextOptions,
    type SpeechStreamSummary,
  } from "$lib/speech-stream";
  import { readHotwordsCsv, writeHotwordsCsv } from "$lib/hotwords";
  import {
    audioModelSettings,
    savedAudioModel,
    type DemoSettings,
    type AudioStage,
  } from "$lib/demo-settings";
  import {
    Mic,
    MicOff,
    Phone,
    PhoneOff,
    Send,
    Trash2,
    PanelLeftClose,
    PanelLeftOpen,
    Radio,
    Activity,
    ListMusic,
    Satellite,
  } from "@lucide/svelte";
  import logo from "../../../static/logo_cloud.svg?raw";
  import "../../app.css";
  import { browserDecodeToWav, encodePcm16Wav } from "$lib/audio";
  import { readGreetingCsv, writeGreetingCsv } from "$lib/greetings";
  import { recognitionContext } from "$lib/asr-context";
  import { correctAsrTranscript, DEFAULT_ASR_POSTPROCESS_LABEL, DEFAULT_ASR_POSTPROCESS_MODEL } from "$lib/asr-postprocess";
  import { reportedRtf, rtfLabel } from "$lib/response-timing";
  import { normalizeTranscript } from "$lib/transcript";
  import { uploadWav, pathStatus } from "$lib/api";
  import {
    listVoices,
    saveVoice,
    deleteVoice,
    createLocalId,
    type SavedVoice,
  } from "$lib/voices";
  import {
    endpointJson,
    routerEndpoint,
    siblingWorkerEndpoint,
    chatText,
    type ChatMessage,
  } from "$lib/openai";
  import { splitReplySentences } from "$lib/text";
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
    if (typeof saved.asr_postprocess_enabled === "boolean") useAsrPostprocess = saved.asr_postprocess_enabled;
    if (saved.asr_postprocess_model && saved.asr_postprocess_model !== DEFAULT_ASR_POSTPROCESS_MODEL) {
      if (llmModels.some(model => model.id === saved.asr_postprocess_model && !model.requiresDownload))
        asrPostprocessModel = saved.asr_postprocess_model;
      else warnings.push("ASR post-processing model unavailable, using S1-mini");
    }
    if (typeof saved.llm_enabled === "boolean") useLlm = saved.llm_enabled;
    if (typeof saved.tts_enabled === "boolean") useTts = saved.tts_enabled;
    if (typeof saved.vad_threshold === "number")
      threshold = saved.vad_threshold;
    if (typeof saved.vad_window_ms === "number") windowMs = saved.vad_window_ms;
    if (typeof saved.vad_end_silence_ms === "number") endSilenceMs = savedEndSilenceMs = saved.vad_end_silence_ms;
    if (saved.dialogue_source === "n8n" || saved.dialogue_source === "prompt.csv")
      dialogueSource = saved.dialogue_source;
    savedSipScenarioId = saved.sip_scenario_id;
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
    if (typeof saved.lookup_notice_delay_seconds === "number")
      noticeDelaySeconds = savedNoticeDelaySeconds = saved.lookup_notice_delay_seconds;
    if (typeof saved.tts_playback_rate === "number")
      ttsPlaybackRate = saved.tts_playback_rate;
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
      savingDialogueSource ||
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
      if (
        !Number.isFinite(ttsPlaybackRate) ||
        ttsPlaybackRate < 0.7 ||
        ttsPlaybackRate > 1.25
      )
        throw new Error("Playback speed must be between 0.7 and 1.25.");
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
        asr_postprocess_enabled: useAsrPostprocess,
        asr_postprocess_model: asrPostprocessModel,
        llm_enabled: useLlm,
        tts_enabled: useTts,
        ...audioModelSettings("vad", selectedVad),
        ...audioModelSettings("asr", selectedAsr),
        ...audioModelSettings("tts", selectedTts),
        vad_threshold: threshold,
        vad_window_ms: windowMs,
        vad_end_silence_ms: endSilenceMs,
        llm_model: llm,
        dialogue_source: dialogueSource,
        sip_scenario_id: savedSipScenarioId,
        lookup_notice_delay_seconds: noticeDelaySeconds,
        tts_streaming: streamingTts,
        tts_playback_rate: ttsPlaybackRate,
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
  type DemoPanel = "settings" | "session" | "events" | "scenarios" | "sip";
  let visiblePanels: Record<DemoPanel, boolean> = {
    settings: true,
    session: true,
    events: true,
    scenarios: true,
    sip: true,
  };
  function restorePanelVisibility() {
    visiblePanels = { ...visiblePanels, session: window.innerWidth > 1050 };
    try {
      const saved = JSON.parse(
        localStorage.getItem("geovision.demo.panel-visibility") || "{}",
      );
      for (const name of Object.keys(visiblePanels) as DemoPanel[])
        if (typeof saved[name] === "boolean") visiblePanels[name] = saved[name];
      visiblePanels = { ...visiblePanels };
    } catch {}
  }
  async function togglePanel(name: DemoPanel) {
    const visible = !visiblePanels[name];
    visiblePanels = { ...visiblePanels, [name]: visible };
    try {
      localStorage.setItem(
        "geovision.demo.panel-visibility",
        JSON.stringify(visiblePanels),
      );
    } catch {}
    await tick();
    const control =
      name === "settings" || !visible
        ? `[data-panel-toggle="${name}"]`
        : `[data-hide-panel="${name}"]`;
    document.querySelector<HTMLButtonElement>(control)?.focus();
  }
  let sipWidth = 280;
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
          sipWidth,
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
      sipWidth = bounded("sipWidth", sipWidth, 240, 420);
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
    // A wait notice is shown and spoken but is not part of the dialogue.
    progressNotice?: boolean;
    audioId?: string;
    audioUrl?: string;
    audioName?: string;
  };
  // Show an assistant reply one sentence per chat bubble.
  function assistantBubbles(text: string): DemoMessage[] {
    return splitReplySentences(text).map(content => ({ role: "assistant", content }));
  }
  // Rejoin consecutive same-role bubbles so model history keeps one message per turn.
  function chatHistory(list: DemoMessage[]): ChatMessage[] {
    const turns: ChatMessage[] = [];
    for (const { role, content, progressNotice } of list) {
      if (progressNotice || !content.trim()) continue;
      const last = turns.at(-1);
      if (last && last.role === role)
        last.content += (/[\u3000-\u9fff\uff00-\uffef]$/.test(last.content) ? "" : " ") + content.trim();
      else turns.push({ role, content: content.trim() });
    }
    return turns;
  }
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
  let scenarioMode: "audio" | "add-scenario" | `scenario:${string}` = "add-scenario";
  let knowledgeScenarios: KnowledgeScenario[] = [];
  let savedSipScenarioId: string | undefined;
  let restoreScenarioOnLoad = true;
  let newScenarioFiles: File[] = [], knowledgeUploading = false, knowledgeDeleting = false, knowledgeStatus = "";
  let knowledgeAborter: AbortController | null = null;
  // One IVR engine session per call. The knowledge service holds the call
  // state; the page only keeps the session ID and the selected script.
  let simulation: {sessionId: string; scenarioId?: string} | null = null;
  function createSimulation(scenarioId?: string) {
    const sessionId = "web-" + Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, "0")).join("");
    return {sessionId, scenarioId};
  }
  $: selectedKnowledgeScenario = knowledgeScenarios.find(scenario => scenarioMode === `scenario:${scenario.id}`);
  $: if (restoreScenarioOnLoad && !settingsLoading && knowledgeScenarios.length)
    restoreScenarioSelection();
  function restoreScenarioSelection() {
    const scenario = savedSipScenarioId === undefined
      ? knowledgeScenarios.findLast(scenario => scenario.simulation)
      : knowledgeScenarios.find(scenario => scenario.simulation && scenario.id === savedSipScenarioId);
    if (scenario) scenarioMode = `scenario:${scenario.id}`;
    restoreScenarioOnLoad = false;
  }
  async function refreshKnowledgeScenarios() {
    try { knowledgeScenarios = await listKnowledgeScenarios(); }
    catch (cause) { if (scenarioMode === "add-scenario") knowledgeStatus = String(cause); }
  }
  async function removeSelectedKnowledgeScenario() {
    const scenario=selectedKnowledgeScenario;
    if(!scenario||knowledgeUploading||knowledgeDeleting)return;
    knowledgeDeleting=true;
    knowledgeStatus=`Removing ${scenario.name}…`;
    try{
      await removeKnowledgeScenario(scenario.id);
      knowledgeScenarios=knowledgeScenarios.filter(saved=>saved.id!==scenario.id);
      scenarioMode="add-scenario";
      changeScenario();
      scenarioStatus=`${scenario.name} removed`;
      record("SCENARIO_REMOVED",scenarioStatus);
    }catch(cause){knowledgeStatus=cause instanceof Error?cause.message:String(cause);}
    finally{knowledgeDeleting=false;}
  }
  function chooseKnowledgeFiles(files: FileList | null) {
    newScenarioFiles = Array.from(files || []);
    if (newScenarioFiles.length) restoreScenarioOnLoad = false;
    knowledgeStatus = "";
  }
  async function uploadKnowledgeScenario() {
    if (knowledgeUploading) return;
    knowledgeUploading = true; knowledgeAborter = new AbortController();
    knowledgeStatus = "Importing scenario references…";
    const imported: KnowledgeScenario[] = [];
    try {
      await importScenarioFiles(newScenarioFiles,AbortSignal.any([knowledgeAborter.signal,AbortSignal.timeout(900000)]),scenario=>{
        imported.push(scenario);
        knowledgeScenarios=[...knowledgeScenarios.filter(saved=>saved.id!==scenario.id),scenario];
        record("SCENARIO_ADDED", `${scenario.name} imported`);
      });
      const scenario=imported.findLast(scenario=>scenario.simulation) ?? imported.at(-1);
      if(!scenario)return;
      knowledgeStatus = `Imported ${imported.length} ${imported.length===1?"file":"files"}.`;
      scenarioMode = `scenario:${scenario.id}`;
      await saveScenarioSelection(scenario);
      newScenarioFiles = [];
    } catch (cause) {
      if (!knowledgeAborter.signal.aborted) knowledgeStatus = cause instanceof Error ? cause.message : String(cause);
    } finally { knowledgeUploading = false; knowledgeAborter = null; }
  }
  let scenarioPreviewUrl = "";
  let scenarioPreviewPlayer: HTMLAudioElement | null = null;
  let scenarioUploadInput: HTMLInputElement | undefined;
  let scenarioFile: File | null = null,
    scenarioAudioName = "",
    scenarioStatus = "";
  let transcriptElement: HTMLDivElement | null = null;
  let lastTranscriptSnapshot = "";
  $: if (transcriptElement) void scrollTranscript(JSON.stringify(displayMessages));
  async function scrollTranscript(snapshot: string) {
    // SIP publishes repeated snapshots and caps its message history. Compare
    // content so new replies scroll even at the cap, without pulling the user
    // back down on every unchanged SIP status update.
    if (snapshot === lastTranscriptSnapshot) return;
    lastTranscriptSnapshot = snapshot;
    await tick();
    if (transcriptElement)
      transcriptElement.scrollTop = transcriptElement.scrollHeight;
  }
  let scenarioRunning = false,
    scenarioToken = 0;
  let playbackRole: "assistant" | "technician" | "caller" = "assistant";
  $: isAudioScenario = scenarioMode === "audio";
  async function saveScenarioSelection(scenario?: KnowledgeScenario) {
    const sipScenarioId = scenario?.simulation ? scenario.id : "";
    const changes: Partial<DemoSettings> = { sip_scenario_id: sipScenarioId };
    if (scenario && !scenario.simulation) {
      dialogueSource = "n8n";
      changes.dialogue_source = "n8n";
    }
    if (await saveCallOption(changes)) savedSipScenarioId = sipScenarioId;
  }
  function changeScenario(mode: typeof scenarioMode = scenarioMode) {
    scenarioMode = mode;
    restoreScenarioOnLoad = false;
    knowledgeStatus = "";
    setScenarioFile(null);
    if (scenarioUploadInput) scenarioUploadInput.value = "";
    scenarioStatus = "";
    if (scenarioMode === "add-scenario") void refreshKnowledgeScenarios();
    void saveScenarioSelection(knowledgeScenarios.find(scenario => scenarioMode === `scenario:${scenario.id}`));
  }
  let events: Event[] = [],
    messages: DemoMessage[] = [];
  let useSip = false;
  let sipSettings: SipSettings | null = null;
  let sipLive: SipLive = { live: false, status: null };
  let sipInstance = '', sipEventId = 0;
  function receiveSipSettings(value: SipSettings) {
    sipSettings = value;
    if (value.enabled && !useSip && (connected || starting)) hangup(false);
    useSip = value.enabled;
  }
  function receiveSipStatus(value: SipLive) {
    sipLive = value;
    const snapshot = value.status;
    if (!snapshot || !useSip) return;
    if (sipInstance !== snapshot.instance) { sipInstance = snapshot.instance; sipEventId = 0; }
    const fresh = snapshot.events.filter((event) => event.id > sipEventId);
    if (fresh.length) {
      sipEventId = Math.max(...fresh.map((event) => event.id));
      events = [...fresh.map((event) => ({
        time: new Date(event.time).toISOString(), run: event.run,
        type: event.type, summary: event.summary,
      })).reverse(), ...events].slice(0, 300);
      try { localStorage.setItem(historyKey, JSON.stringify(events)); } catch {}
    }
  }
  $: sipOnline = useSip && sipLive.live && !!sipLive.status?.registered;
  $: sipConnected = useSip && sipLive.live && !!sipLive.status?.active;
  $: sipCanSend = sipConnected && sipSettings?.mode !== "tts" && sipLive.status?.stage === "Listening";
  $: canSendText = (useSip ? sipCanSend : connected) && !busy && !detecting && !scenarioRunning;
  $: scenarioConnected = useSip ? sipConnected : connected;
  $: scenarioCanCall = useSip ? sipCanSend : connected || canCall;
  $: displayMessages = (useSip ? sipLive.status?.messages || [] : messages) as DemoMessage[];
  $: sipStatus = !sipLive.live ? (useSip ? "Waiting for SIP worker" : "SIP disabled")
    : sipLive.status?.stage || "Waiting for incoming call";
  function sipBars(values: number[] | undefined) {
    const samples = values || [];
    return [...Array(Math.max(0, 36 - samples.length)).fill(2),
      ...samples.slice(-36).map((value) => Math.max(2, Math.min(70, Math.sqrt(Math.max(0, value)) * 70)))];
  }
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
  let useAsrPostprocess = true;
  let asrPostprocessModel = DEFAULT_ASR_POSTPROCESS_MODEL;
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
  $: asrPostprocessModels = llmModels.filter((m) => !m.requiresDownload && m.id !== DEFAULT_ASR_POSTPROCESS_MODEL);
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
        Number.isFinite(ttsPlaybackRate) &&
        ttsPlaybackRate >= 0.7 &&
        ttsPlaybackRate <= 1.25 &&
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
      if (asrPostprocessModel !== DEFAULT_ASR_POSTPROCESS_MODEL &&
          !llmModels.some(model => model.id === asrPostprocessModel && !model.requiresDownload))
        asrPostprocessModel = DEFAULT_ASR_POSTPROCESS_MODEL;
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
  let dialogueSource: DialogueSource = "prompt.csv";
  let savingDialogueSource = false;
  async function changeDialogueSource() {
    if (!useSip || savingDialogueSource || savingSettings || settingsLoading) return;
    savingDialogueSource = true;
    try {
      const current = await endpointJson<{ settings: DemoSettings | null }>("", "ui/demo-settings", { cache: "no-store" });
      await endpointJson("", "ui/demo-settings", {
        method: "POST",
        body: JSON.stringify({ settings: { ...(current.settings || { schema_version: 1 }), dialogue_source: dialogueSource } }),
      });
      settingsStatus = "Dialogue source saved · applies to the next SIP turn";
    } catch (cause) {
      settingsStatus = `Could not save SIP dialogue source: ${cause instanceof Error ? cause.message : cause}`;
    } finally { savingDialogueSource = false; }
  }
  let prompt =
    "你是現場維修保養的語音助理。請用繁體中文簡短回答，準確保留工單、設備代碼及數字。";
  const defaultReferenceText =
    "你好我是語音助手 請問您需要什麼服務 如果需要轉接請按分機號碼";
  let threshold = 0.5,
    windowMs = 650,
    endSilenceMs = 2000,
    savedEndSilenceMs = 2000,
    voiceFile: File | null = null,
    referenceText = defaultReferenceText,
    referencePath = "";
  let hotwords = "",
    savingHotwords = false,
    hotwordsStatus = "";
  // Wait notice: spoken when an IVR turn is still running after this delay.
  let noticeDelaySeconds = DEFAULT_NOTICE_DELAY_SECONDS, savedNoticeDelaySeconds = DEFAULT_NOTICE_DELAY_SECONDS;
  async function saveNoticeDelay() {
    const value = noticeDelaySeconds;
    if (!Number.isInteger(value) || value < 1 || value > 60) {
      noticeDelaySeconds = savedNoticeDelaySeconds;
      settingsStatus = "Wait notice delay must be a whole number from 1 to 60 seconds.";
      return;
    }
    savingSettings = true;
    try {
      const current = await endpointJson<{settings: DemoSettings | null}>("", "ui/demo-settings", {cache: "no-store"});
      await endpointJson("", "ui/demo-settings", {method: "POST", body: JSON.stringify({settings: {...(current.settings || {schema_version: 1}), lookup_notice_delay_seconds: value}})});
      savedNoticeDelaySeconds = value;
      settingsStatus = "Wait notice delay saved · applies to the next turn";
    } catch (cause) {
      noticeDelaySeconds = savedNoticeDelaySeconds;
      settingsStatus = `Could not save wait notice delay: ${cause instanceof Error ? cause.message : cause}`;
    } finally { savingSettings = false; }
  }
  // Wait phrases are synthesized as soon as the turn's intent is known and
  // kept for the session, so a notice plays at once when it is due.
  const noticeSpeech = new Map<string, Promise<Blob>>();
  function noticeBody(phrase: string, id: string): Record<string, unknown> {
    const body: Record<string, unknown> = {model: id, input: phrase, response_format: "wav"};
    if (referencePath && supportsReference) { body.voice_ref = referencePath; body.reference_text = referenceText; }
    else body.voice = voice;
    return body;
  }
  function prepareNotice(phrase: string): Promise<Blob> | undefined {
    if (!useTts) return undefined;
    const key = JSON.stringify([ttsKey, voice, referencePath, ttsPlaybackRate, phrase]);
    let speech = noticeSpeech.get(key);
    if (!speech) {
      speech = load(ttsKey, new AbortController().signal, true, ttsRunMode)
        .then(id => synthesizeSpeech(noticeBody(phrase, id), AbortSignal.timeout(30000)))
        .then(result => result.audio);
      speech.catch(() => noticeSpeech.delete(key));
      noticeSpeech.set(key, speech);
      if (noticeSpeech.size > 60) noticeSpeech.delete(noticeSpeech.keys().next().value!);
    }
    return speech;
  }
  let ttsStreaming = false,
    ttsPlaybackRate = 0.9;
  $: ttsRunMode = streamingTts ? "streaming" : "offline";
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
  async function setTtsStreaming(enabled: boolean) {
    ttsStreaming = enabled;
    try {
      localStorage.setItem("geovision.demo.tts-streaming", String(enabled));
    } catch {}
    if (useSip && !(await saveCallOption({tts_streaming: enabled,...audioModelSettings("tts", selectedTts)}))) ttsStreaming = !enabled;
  }
  async function saveCallOption(changes: Partial<DemoSettings>) {
    if ("vad_end_silence_ms" in changes && (!Number.isInteger(changes.vad_end_silence_ms) || endSilenceMs < 500 || endSilenceMs > 5000)) {
      endSilenceMs = savedEndSilenceMs; settingsStatus = "End-of-speech silence must be 500–5000 ms."; return false;
    }
    savingSettings = true;
    try {
      const current = await endpointJson<{settings: DemoSettings | null}>("", "ui/demo-settings", {cache:"no-store"});
      await endpointJson("", "ui/demo-settings", {method:"POST",body:JSON.stringify({settings:{...(current.settings||{schema_version:1}),...changes}})});
      if (changes.vad_end_silence_ms !== undefined) savedEndSilenceMs = changes.vad_end_silence_ms;
      settingsStatus = "Call setting saved · applies to the next turn";
      return true;
    } catch (cause) { if (changes.vad_end_silence_ms !== undefined) endSilenceMs = savedEndSilenceMs; settingsStatus = `Could not save call setting: ${String(cause)}`; return false; }
    finally { savingSettings = false; }
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
      (voiceFile && requiresReferenceText && !referenceText.trim()) ||
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
        previewContext = new AudioContext(speechContextOptions(selectedTts?.family, ttsPlaybackRate));
        await previewContext.resume();
      }
      const model = await load(
        ttsKey,
        aborter.signal,
        true,
        previewContext ? ttsRunMode : "offline",
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
              bufferSeconds: selectedTts?.family === "voxcpm1" ? 0.32 : 0,
              continuousPcm: selectedTts?.family === "voxcpm1",
              onUnderrun: () => record("TTS_BUFFER_UNDERRUN", "Speech generation or delivery fell behind playback"),
              onRenderer: (renderer) => record("TTS_PLAYBACK_MODE", renderer === "pcm-queue" ? "Continuous PCM queue" : "Scheduled audio chunks"),
              playbackRate: ttsPlaybackRate,
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
        if (cloneTestPlayer) cloneTestPlayer.playbackRate = ttsPlaybackRate;
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
    (modelCapabilities[selectedTts?.family || ""] || []).includes("speaker_reference") ||
    ["audio8_tts", "voxcpm1", "qwen3_tts"].includes(selectedTts?.family || "");
  $: requiresReferenceText = supportsReference && selectedTts?.family !== "bluemagpie";
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
  let silenceSamples = 0;
  let windows: Float32Array[] = [],
    frames = 0,
    utterance: Float32Array[] = [],
    preRoll: Float32Array | null = null;
  const historyKey = "geovision.demo.events.v1";
  let callLog: {id: string; started: number; pending: Promise<void>} | null = null;
  function saveCallLog(role: "Caller" | "AI" | "Call", text: string) {
    const session = callLog;
    if (!session || !text.trim()) return;
    // Start the fetches in transcript order, even when turns finish back-to-back.
    session.pending = session.pending.then(async () => {
      await endpointJson("", "ui/demo-call-log", {
        method: "POST",
        keepalive: true,
        body: JSON.stringify({
          session_id: session.id,
          started_at_ms: session.started,
          entries: [{role, text}],
        }),
      }, AbortSignal.timeout(5000));
    }).catch(cause => {
      if (callLog === session) record("CALL_LOG_ERROR", String(cause));
    });
  }
  // HTTPS uses Caddy's same-origin proxy; the native HTTP server has no /llm route.
  const llmBase = () => location.protocol === "https:"
    ? new URL("/llm/v1/", location.href).toString()
    : siblingWorkerEndpoint(8082);
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
    silenceSamples = 0;
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
        silenceSamples = 0;
        if (!utterance.length) {
          record("USER_STATE_CHANGED", "listening → speaking");
          if (preRoll) utterance.push(preRoll);
        }
        utterance.push(samples);
      } else if (utterance.length) { utterance.push(samples); silenceSamples += samples.length; }
      else preRoll = samples;
      if (
        utterance.length &&
        (silenceSamples >= ctx.sampleRate * endSilenceMs / 1000 ||
          utterance.reduce((n, p) => n + p.length, 0) >= ctx.sampleRate * 60)
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
      playInputAudio?: boolean;
      audioName?: string;
      // A mock-call line: its text is the script's own words, so ASR and
      // transcript correction are skipped and only its speech is played.
      scripted?: boolean;
    } = {},
  ) {
    if (useSip && (!controller || controller.signal.aborted)) controller = new AbortController();
    const signal = controller?.signal;
    if (!(useSip ? sipCanSend : connected) || busy || !signal) return;
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
      if (audio && useAsr && !options.scripted) {
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
          { preserveTranscript: true },
        );
        const originalTranscript = result.text || "";
        text = normalizeTranscript(originalTranscript, hotwords).trim();
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
          originalTranscript,
          performance.now() - operationStarted,
          reportedRtf(result),
        );
      }
      if (signal.aborted || generation !== epoch) return;
      if (useSip) { await sendSipText(normalizeTranscript(text, hotwords), signal); return; }
      const textLength = [...text].length;
      if (!options.scripted && useAsrPostprocess && textLength >= 3 && textLength <= 1200 && text.trim()) {
        const correctionStarted = performance.now();
        status = "Correcting transcript";
        try {
          text = await correctAsrTranscript(text, asrPostprocessModel, hotwords, llmBase(), signal);
          if (signal.aborted || generation !== epoch) return;
          record("ASR_POSTPROCESS_COMPLETED", text, performance.now() - correctionStarted);
        } catch {
          if (signal.aborted || generation !== epoch) return;
          record("ASR_POSTPROCESS_FALLBACK", text, performance.now() - correctionStarted);
        }
      }
      if (audioMessageId)
        messages = messages.map((message) =>
          message.audioId === audioMessageId
            ? { ...message, content: text }
            : message,
        );
      else messages = [...messages, { role: "user", content: text }];
      saveCallLog("Caller", text);
      record("CONVERSATION_ITEM_ADDED", `USER · ${text}`);
      let reply = text;
      if (simulation) {
        status = "Thinking";
        record("AGENT_STATE_CHANGED", "listening → thinking");
        operationStarted = performance.now();
        const result = await ivrDialogue({sessionId: simulation.sessionId, text, scenarioId: simulation.scenarioId}, signal, {
          noticeDelaySeconds,
          onNoticeReady: phrase => { prepareNotice(phrase)?.catch(() => undefined); },
          onNotice: async (phrase, noticeSignal) => {
            if (generation !== epoch || noticeSignal.aborted) return;
            messages = [...messages, {role: "assistant", content: phrase, progressNotice: true}];
            status = phrase;
            record("WAIT_NOTICE", phrase, performance.now() - operationStarted);
            try {
              const speech = prepareNotice(phrase);
              if (speech) {
                const audio = await speech;
                if (generation === epoch && !noticeSignal.aborted) await playAudio(audio, generation, "assistant", noticeSignal);
              }
            } catch (cause) {
              if (!noticeSignal.aborted && generation === epoch) record("WAIT_NOTICE_FAILED", String(cause));
            } finally {
              if (generation === epoch && !noticeSignal.aborted) status = "Thinking";
            }
          },
          onWorkflow: state => {
            if (generation !== epoch || signal.aborted) return;
            record(`N8N_WORKFLOW_${state.toUpperCase()}`, "GeoVision · Workflow");
          },
        });
        if (generation !== epoch || signal.aborted) return;
        reply = result.reply;
        record("LLM_COMPLETED", result.scenario ? `情境 ${result.scenario.number}：${result.scenario.title} · ${result.status}` : `IVR ${result.stage}`,
          performance.now() - operationStarted);
        if (result.work_order) record("WORK_ORDER_COMPLETED", result.work_order.order_id);
      } else if (useLlm) {
        status = "Thinking";
        record("AGENT_STATE_CHANGED", "listening → thinking");
        operationStarted = performance.now();
        const response = await completeLocalTurn(prompt, messages, signal);
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
      if (!simulation) reply = normalizeTranscript(reply, hotwords);
      messages = [...messages, ...assistantBubbles(reply)];
      saveCallLog("AI", reply);
      record("CONVERSATION_ITEM_ADDED", `ASSISTANT · ${reply}`);
      operationStarted = performance.now();
      await speakReply(reply, generation, signal);
      if (generation !== epoch || signal.aborted) return;
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
  async function completeLocalTurn(
    system: string,
    history: typeof messages,
    signal: AbortSignal,
    generationOptions = { max_tokens: 256, temperature: 0.4 },
  ) {
    const ready = await ensureDemoLlmReady(llmBase(), llm, signal, (message) => { status = message; });
    signal.throwIfAborted();
    llm = ready;
    status = "Thinking";
    return endpointJson<any>(llmBase(), "chat/completions?autoload=true", {
      method: "POST",
      body: JSON.stringify({
        model: ready,
        messages: [{ role: "system", content: system }, ...chatHistory(history)],
        ...generationOptions,
        stream: false,
      }),
    }, signal);
  }
  async function speakReply(reply: string, generation: number, signal: AbortSignal) {
    if (!useTts) { record("TTS_SKIPPED", "Text response only"); return; }
    const started = performance.now();
    const id = await load(ttsKey, signal, true, ttsRunMode);
    status = "Synthesizing";
    const body: Record<string, unknown> = { model: id, input: reply, response_format: "wav" };
    if (referencePath && supportsReference) {
      body.voice_ref = referencePath;
      body.reference_text = referenceText;
    } else body.voice = voice;
    let playbackMs: number | null;
    if (streamingTts) playbackMs = (await streamTts(body, generation, signal)).playbackMs;
    else {
      const synthesis = await synthesizeSpeech(body, signal);
      if (generation !== epoch || signal.aborted) return;
      record("TTS_COMPLETED", selectedTts?.label || "Speech synthesized", performance.now() - started, synthesis.rtf);
      playbackMs = await playAudio(synthesis.audio, generation, "assistant", signal);
    }
    if (generation === epoch && !signal.aborted) record("PLAYBACK_COMPLETED", "Assistant reply played", playbackMs);
  }
  async function playSimulationOpening(generation: number, signal: AbortSignal) {
    const active = simulation;
    if (!active) return;
    if (!useTts && greeting.trim() && !messages.length)
      messages = assistantBubbles(greeting);
    const {reply: prompt} = await ivrDialogue({sessionId: active.sessionId, start: true, scenarioId: active.scenarioId}, signal);
    if (generation !== epoch || signal.aborted || simulation !== active) return;
    messages = [...messages, ...assistantBubbles(prompt)];
    saveCallLog("AI", prompt);
    record("CONVERSATION_ITEM_ADDED", `ASSISTANT · ${prompt}`);
    await speakReply(prompt, generation, signal);
  }
  // A loaded scenario can become selected after the browser call has started.
  $: if (selectedKnowledgeScenario?.simulation && useLlm && connected && !useSip &&
    !simulation && !starting && !busy && !speaking && !detecting && !manualRecording && !scenarioRunning)
    void startSimulationDuringCall(selectedKnowledgeScenario);
  async function startSimulationDuringCall(scenario: KnowledgeScenario) {
    const signal = controller?.signal, generation = epoch;
    if (!signal || signal.aborted) return;
    simulation = createSimulation(scenario.id);
    busy = true;
    error = "";
    reset();
    try {
      await playSimulationOpening(generation, signal);
    } catch (cause) {
      if (generation === epoch && !signal.aborted) fail(cause);
    } finally {
      if (generation === epoch) {
        busy = false;
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
        bufferSeconds: selectedTts?.family === "voxcpm1" ? 0.32 : 0,
              continuousPcm: selectedTts?.family === "voxcpm1",
              onUnderrun: () => record("TTS_BUFFER_UNDERRUN", "Speech generation or delivery fell behind playback"),
              onRenderer: (renderer) => record("TTS_PLAYBACK_MODE", renderer === "pcm-queue" ? "Continuous PCM queue" : "Scheduled audio chunks"),
        playbackRate: ttsPlaybackRate,
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
    node.playbackRate.value = ttsPlaybackRate;
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
      (voiceFile && requiresReferenceText && !referenceText.trim())
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
          if (requiresReferenceText && !referenceText.trim())
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
        referenceText = normalizeTranscript(result.text || "", hotwords).trim();
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
    if (file && !requiresReferenceText) cloneStatus = "Reference ready · no transcript needed";
    else if (file && useAsr && asrKey) void transcribeReference(file);
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
  function setScenarioFile(file: File | null) {
    scenarioPreviewPlayer?.pause();
    if (scenarioPreviewUrl) URL.revokeObjectURL(scenarioPreviewUrl);
    scenarioFile = file;
    scenarioAudioName = file?.name || "";
    scenarioPreviewUrl = file ? URL.createObjectURL(file) : "";
  }
  // Mock call: plays the caller's side of the uploaded call script — the
  // opening answers, then each selected 情境's caller lines. Each line is
  // spoken with TTS, sent as the caller's turn, and the next line waits until
  // the reply has been spoken.
  let mockSections: number[] = [], mockScenarioId = "", mockRunning = false, mockToken = 0, mockStatus = "", mockLine = -1;
  $: mockCall = selectedKnowledgeScenario?.simulation ? selectedKnowledgeScenario.mockCall : undefined;
  $: if ((selectedKnowledgeScenario?.id || "") !== mockScenarioId) {
    mockScenarioId = selectedKnowledgeScenario?.id || "";
    mockSections = mockCall?.sections.filter(section => section.outbound).map(section => section.number) ?? [];
    mockVaried = null;
    mockStatus = "";
  }
  // Lines of the current run: the script's own until a run starts, then the
  // run's fresh names and numbers.
  let mockVaried: NonNullable<KnowledgeScenario["mockCall"]> | null = null;
  $: mockSource = mockVaried ?? mockCall;
  $: mockLines = mockSource ? [
    ...mockSource.opening.map(text => ({text, label: "Opening"})),
    ...mockSource.sections.filter(section => mockSections.includes(section.number))
      .flatMap(section => section.lines.map(text => ({text, label: `情境 ${section.number}`}))),
  ] : [];
  async function variedMockCall(scenarioId: string, sections: number[]) {
    const response = await fetch("/n8n/webhook/ivr-mock-call", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({scenarioId, sections}), signal: AbortSignal.timeout(180000),
    });
    const result = await response.json().catch(() => undefined);
    if (!response.ok || !Array.isArray(result?.opening) || !Array.isArray(result?.sections))
      throw new Error(result?.message || result?.error || `HTTP ${response.status}`);
    return result as NonNullable<KnowledgeScenario["mockCall"]>;
  }
  function toggleMockSection(number: number, on: boolean) {
    mockSections = on ? [...new Set([...mockSections, number])].sort((a, b) => a - b) : mockSections.filter(item => item !== number);
    mockVaried = null;
  }
  async function whenIdle(token: number) {
    let quiet = 0;
    while (token === mockToken && quiet < 3) {
      quiet = connected && !starting && !busy && !speaking ? quiet + 1 : 0;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  // The mock caller speaks with a saved voice of its own (default tsaiK…),
  // used as the TTS speaker reference; its uploaded reference is reused.
  let callerVoiceId = "";
  const callerReferences = new Map<string, Promise<string>>();
  $: if (!savedVoices.some(item => item.id === callerVoiceId)) {
    const named = (pattern: RegExp) => savedVoices.find(item => pattern.test(item.name));
    callerVoiceId = (named(/^tsaiky$/i) ?? named(/^tsaik[^-]*$/i) ?? named(/^tsaik/i) ?? savedVoices[0])?.id ?? "";
  }
  async function mockCallerSpeech(line: string, signal: AbortSignal): Promise<Blob | undefined> {
    if (!useTts) return undefined;
    const id = await load(ttsKey, signal, true, ttsRunMode);
    const caller = savedVoices.find(item => item.id === callerVoiceId);
    let body: Record<string, unknown>;
    if (caller && supportsReference) {
      let reference = callerReferences.get(caller.id);
      if (!reference) {
        reference = browserDecodeToWav(new File([caller.audio], `${caller.name}.wav`, {type: "audio/wav"}), 24000, 1).then(wav => uploadWav(wav, signal));
        reference.catch(() => callerReferences.delete(caller.id));
        callerReferences.set(caller.id, reference);
      }
      body = {model: id, input: line, response_format: "wav", voice_ref: await reference, reference_text: caller.transcript};
    } else {
      const builtin = caller?.id.startsWith("preset-") ? caller.id.slice(7) : undefined;
      body = builtin && (selectedTts?.builtin_voices ?? []).includes(builtin) ? {model: id, input: line, response_format: "wav", voice: builtin} : noticeBody(line, id);
    }
    return (await synthesizeSpeech(body, signal)).audio;
  }
  // Speak one caller line with the caller voice and send it as the caller's
  // turn; resolves after the reply has been spoken.
  async function sendCallerLine(text: string, label: string) {
    const speech = await mockCallerSpeech(text, controller?.signal ?? new AbortController().signal);
    await respond(text, speech, epoch, {playInputAudio: !!speech, audioName: `Mock caller · ${label}`, scripted: true});
  }
  async function runMockCall() {
    if (!mockCall || mockRunning || useSip || scenarioRunning || starting) return;
    const token = ++mockToken;
    mockRunning = scenarioRunning = true;
    error = "";
    try {
      // Each run speaks new names and numbers; the script's own lines are
      // used if the variation is unavailable.
      mockStatus = "Preparing new names and numbers…";
      try { mockVaried = await variedMockCall(selectedKnowledgeScenario!.id, mockSections); }
      catch (cause) { mockVaried = null; record("MOCK_CALL_VARIATION_FAILED", String(cause)); }
      await tick();
      if (token !== mockToken) return;
      const lines = mockLines;
      if (!connected) await call();
      for (const [index, line] of lines.entries()) {
        await whenIdle(token);
        if (token !== mockToken || !connected) break;
        mockLine = index;
        mockStatus = `Q${index + 1}/${lines.length} · ${line.label}`;
        await sendCallerLine(line.text, `Q${index + 1} · ${line.label}`);
        if (error) break;
      }
      if (token === mockToken) mockStatus = error ? `Mock call stopped: ${error}` : !connected ? "Mock call ended with the call" : `Mock call complete · ${lines.length} lines`;
    } catch (cause) {
      if (token === mockToken) { fail(cause); mockStatus = `Mock call stopped: ${error}`; }
    } finally {
      if (token === mockToken) { mockRunning = scenarioRunning = false; mockLine = -1; }
    }
  }
  // Stop scenario and Hang up both end a running mock call.
  function stopMockCall() {
    if (!mockRunning) return;
    mockToken++;
    mockLine = -1;
    mockRunning = false;
    mockStatus = "Mock call stopped";
  }
  async function runScenario() {
    if (scenarioRunning || busy || detecting || starting) return;
    if (!isAudioScenario || !scenarioFile || !useAsr) return;
    const token = ++scenarioToken;
    scenarioRunning = true;
    scenarioPreviewPlayer?.pause();
    manualRecording = false;
    manualParts = [];
    error = "";
    scenarioStatus = "Starting scenario…";
    try {
      if (!useSip && !scenarioConnected) await call();
      if (!scenarioConnected || token !== scenarioToken) return;
      const file = scenarioFile;
      scenarioStatus = `Audio input · ${file.name}`;
      await respond("", file, epoch, {playInputAudio: true, audioName: file.name});
      if (!error && token === scenarioToken) scenarioStatus = "Audio input complete";
    } catch (cause) {
      if (token === scenarioToken) {
        fail(cause);
        scenarioStatus = error;
      }
    } finally {
      if (token === scenarioToken) {
        scenarioRunning = false;
            if (!busy && connected) status = idleStatus();
      }
    }
  }
  function stopScenario() {
    stopMockCall();
    if (starting) {
      hangup();
      scenarioStatus = "Scenario stopped";
      return;
    }
    scenarioToken++;
    scenarioRunning = false;
    scenarioPreviewPlayer?.pause();
    controller?.abort();
    if (connected) controller = new AbortController();
    if (player) player.stop();
    stopIncomingPlayback?.();
    scenarioStatus = "Scenario stopped";
    reset();
  }
  async function sendSipText(text: string, signal: AbortSignal) {
    const callId = sipLive.status?.call_id;
    const after = Math.max(0, ...(sipLive.status?.events || []).map(e => e.id));
    await endpointJson("", "ui/sip/text", { method: "POST", body: JSON.stringify({call_id: callId, text}) }, signal);
    const deadline = Date.now() + 300_000;
    let accepted = false;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      const snapshot = await endpointJson<SipLive>("", "ui/sip/live", {cache: "no-store"}, signal);
      receiveSipStatus(snapshot);
      if (!snapshot.live || !snapshot.status?.active || snapshot.status.call_id !== callId) throw new Error("SIP call ended");
      const events = snapshot.status.events.filter(e => e.id > after);
      if (events.some(e => e.type === "TEXT_INPUT_REJECTED" || e.type === "ERROR")) throw new Error("SIP turn could not complete");
      accepted ||= events.some(e => e.type === "TEXT_INPUT");
      if (accepted && snapshot.status.stage === "Listening") return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error("SIP text turn timed out");
  }
  let messageInput: HTMLTextAreaElement;
  // A mockup question is spoken with the caller voice and sent at once
  // (connecting the call first when needed).
  async function sendScenarioQuestion(question: string, index: number) {
    if (mockRunning || useSip || scenarioRunning || starting) return;
    const token = ++mockToken;
    mockRunning = scenarioRunning = true;
    error = "";
    try {
      if (!connected) await call();
      await whenIdle(token);
      if (token !== mockToken || !connected) return;
      mockStatus = `Q${index + 1}: ${question}`;
      await sendCallerLine(question, `Q${index + 1}`);
      if (token === mockToken) mockStatus = error ? `Stopped: ${error}` : `Q${index + 1} answered`;
    } catch (cause) {
      if (token === mockToken) { fail(cause); mockStatus = `Stopped: ${error}`; }
    } finally {
      if (token === mockToken) mockRunning = scenarioRunning = false;
    }
  }
  function send() {
    const text = input.trim();
    if (!text || !canSendText) return;
    input = "";
    void respond(text, undefined, epoch);
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
    // A selected call script, or the n8n dialogue source, runs the IVR engine.
    simulation = useLlm && selectedKnowledgeScenario?.simulation ? createSimulation(selectedKnowledgeScenario.id)
      : useLlm && dialogueSource === "n8n" ? createSimulation() : null;
    controller = new AbortController();
    try {
      if (useAsr && (!window.isSecureContext || !navigator.mediaDevices))
        throw new Error(
          "Open this page over trusted HTTPS to use the microphone.",
        );
      context = new AudioContext(speechContextOptions(selectedTts?.family, ttsPlaybackRate));
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
        if (requiresReferenceText && !referenceText.trim())
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
      callLog = {id: `demo-${createLocalId()}`, started: Date.now(), pending: Promise.resolve()};
      saveCallLog("Call", "Started");
      muted = false;
      status = idleStatus();
      record(
        "SESSION_STARTED",
        useAsr
          ? "Microphone connected · echo cancellation enabled"
          : "Text input · ASR skipped",
      );
      busy = !!simulation || (useTts && !!greeting.trim());
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
                  context.sampleRate * 60
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
        saveCallLog("AI", greeting);
        record("GREETING_REQUESTED", greeting);
        let playbackMs: number | null;
        if (
          streamingTts &&
          !(preparedKey === greetingFingerprint() && preparedGreeting)
        ) {
          greetingAborter?.abort();
          const id = await load(ttsKey, controller.signal, true, ttsRunMode);
          const body: Record<string, unknown> = { model: id, input: greeting };
          if (referencePath && supportsReference) {
            body.voice_ref = referencePath;
            body.reference_text = referenceText;
          } else body.voice = voice;
          messages = assistantBubbles(greeting);
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
          messages = assistantBubbles(greeting);
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
      }
      if (simulation) {
        await playSimulationOpening(generation, controller.signal);
        if (generation !== epoch) return;
      }
      busy = false;
      status = idleStatus();
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
    stopMockCall();
    saveCallLog("Call", "Ended");
    callLog = null;
    simulation = null;
    scenarioToken++;
    scenarioRunning = false;
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
    restorePanelVisibility();
    void loadSystemInfo();
    void refreshKnowledgeScenarios();
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
              : event.type === "LLM_SKIPPED" &&
                  event.summary === "Maintenance readback assembled from user transcript fields"
                ? { ...event, type: "LLM_TRANSCRIPT_GROUNDED" }
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
    knowledgeAborter?.abort();
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
  class:no-settings={!visiblePanels.settings}
  style:--sidebar-width={`${sidebarWidth}px`}
>
  <header class="top-bar">
    <div class="brand">
      <span class="gv">{@html logo}</span><span>GeoVision IVR</span>
    </div>
    <div class="console-title">
      <button
        class="panel-toggle"
        aria-label={visiblePanels.settings ? "Hide settings" : "Show settings"}
        title={visiblePanels.settings ? "Hide settings" : "Show settings"}
        aria-controls="demo-settings"
        aria-expanded={visiblePanels.settings}
        data-panel-toggle="settings"
        on:click={() => togglePanel("settings")}
      >
        {#if visiblePanels.settings}<PanelLeftClose
            size={17}
          />{:else}<PanelLeftOpen size={17} />{/if}
      </button>
      <strong>Conversation</strong><span
        class="badge"
        title={systemDescription || undefined}
        >LOCAL IVR DEMO{systemModel ? ` on ${systemModel}` : ""}</span
      >
    </div>
    <div class="header-actions">
      <div class="panel-restores" aria-label="Hidden panels">
        {#if !visiblePanels.sip}<button class="panel-toggle"
          aria-label="Show SIP"
          title="Show SIP"
          aria-controls="demo-sip" aria-expanded="false"
          data-panel-toggle="sip" on:click={() => togglePanel("sip")}><Satellite size={17} /></button>{/if}
        {#if !visiblePanels.session}<button
            class="panel-toggle"
            aria-label="Show session"
            title="Show session"
            aria-controls="demo-session-details"
            aria-expanded="false"
            data-panel-toggle="session"
            on:click={() => togglePanel("session")}
            ><Radio size={17} /></button
          >{/if}
      </div>
      <div class="connection">
        <i class:online={useSip ? sipOnline : connected}></i>{(useSip ? sipOnline : connected)
          ? "CONNECTED"
          : starting
            ? "CONNECTING"
            : "DISCONNECTED"}
      </div>
    </div>
  </header>
  <aside id="demo-settings" hidden={!visiblePanels.settings}>
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
          >Greeting transcript<textarea rows="3" bind:value={greeting}
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
          savingDialogueSource ||
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
        <label>End-of-speech silence (ms)<input
          aria-label="End-of-speech silence (ms)" type="number" min="500" max="5000" step="100"
          bind:value={endSilenceMs}
          on:change={() => saveCallOption({vad_end_silence_ms:endSilenceMs})}
        /></label>
        <small>Wait through pauses before starting ASR. Default: 2 seconds.</small>
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
          cloneBusy}
      >
        <label
          >ASR<select aria-label="ASR" bind:value={asrKey} disabled={!useAsr}
            ><option value="" disabled>No installed ASR models</option
            >{#each asrModels as model}<option value={model.key}
                >{model.label}</option
              >{/each}</select
          ></label
        >
        <label class="stage-switch postprocess-switch">
          <span class="postprocess-label">Transcript post-processing</span>
          <span class="postprocess-control">
            <input type="checkbox" role="switch" aria-label="Enable transcript post-processing" bind:checked={useAsrPostprocess} />
            <span>{useAsrPostprocess ? "On" : "Off"}</span>
          </span>
        </label>
        {#if useAsrPostprocess}
          <label>Post-processing model
            <select aria-label="Post-processing model" bind:value={asrPostprocessModel}>
              <option value={DEFAULT_ASR_POSTPROCESS_MODEL}>{DEFAULT_ASR_POSTPROCESS_LABEL}</option>
              {#each asrPostprocessModels as model}
                <option value={model.id}>{model.label}</option>
              {/each}
            </select>
          </label>
        {/if}
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
    <section class="stage-settings" aria-label="Wait notice settings">
      <div class="stage-heading"><h2>Wait notice</h2></div>
      <fieldset disabled={settingsLoading || savingSettings}>
        <label>Speak a wait notice after (seconds)<input
          aria-label="Wait notice delay (seconds)"
          type="number" min="1" max="60" step="1" required
          bind:value={noticeDelaySeconds}
          on:change={saveNoticeDelay}
        /></label>
        <small>When an IVR turn takes longer, the caller hears what is being done, e.g. 「好的，我幫您查一下庫存，請稍等。」 Browser and SIP. Default: 2 seconds.</small>
      </fieldset>
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
        <label>Dialogue source<select aria-label="Dialogue source" bind:value={dialogueSource} on:change={changeDialogueSource} disabled={savingDialogueSource}>
          <option value="prompt.csv">prompt.csv</option>
          <option value="n8n">n8n</option>
        </select></label>
        {#if useSip}<small>Source changes apply to the next SIP turn. Save model settings to change its LLM.</small>{/if}
        {#if dialogueSource === "n8n"}
          <small>Uses the published GeoVision · Workflow.</small>
        {:else}
        <label
          >System prompt<textarea rows="4" bind:value={prompt}
          ></textarea></label
        >
        <button disabled={savingPrompt} on:click={savePromptCsv}
          >{savingPrompt ? "Saving…" : "Save prompt.csv"}</button
        >
        {/if}
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
            on:change={(e) => {
              const model = audioModels.find((m) => m.key === e.currentTarget.value);
              if (useSip) void saveCallOption({...audioModelSettings("tts", model), tts_streaming: ttsStreaming && (modelModes[model?.family || ""] || []).includes("streaming")});
            }}
            ><option value="" disabled>No installed TTS models</option
            >{#each ttsModels as model}<option value={model.key}
                >{model.label}</option
              >{/each}</select
          ></label
        >
        <div class="tts-playback-options">
          <label class="stage-switch tts-streaming-switch"
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
          <label class="tts-speed"
            >Playback speed<input
              aria-label="Playback speed"
              type="number"
              min="0.7"
              max="1.25"
              step="0.05"
              bind:value={ttsPlaybackRate}
            /></label
          >
        </div>
        <small
          >{ttsSupportsStreaming
            ? "Play two-line speech groups as they are generated."
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
                (requiresReferenceText && useAsr && !asrKey)}><Mic size={16} /></button
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
          {#if requiresReferenceText}<label
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
          {/if}
          {#if !requiresReferenceText}<small>Use 3–30 seconds of reference speech. No transcript needed.</small>{/if}
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
                (voiceFile && requiresReferenceText && !referenceText.trim()) ||
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
    hidden={!visiblePanels.settings}
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
    style:--sip-width={`${sipWidth}px`}
    style:--details-width={`${detailsWidth}px`}
    style:--bottom-height={`${bottomHeight}px`}
    style:--events-share={`${eventsShare}fr`}
    style:--scenarios-share={`${100 - eventsShare}fr`}
    style:--wave-height={`${waveHeight}px`}
    style:--composer-height={`${composerHeight}px`}
  >
    <section class="session" class:no-session={!visiblePanels.session} class:no-sip={!visiblePanels.sip}>
      <div class="conversation">
        <div class="wave-area">
          <div class="wave-label">ASSISTANT</div>
          <div class="wave wave-out" aria-label="Live assistant waveform">
            {#each (useSip ? sipBars(sipConnected ? sipLive.status?.output : undefined) : outputBars) as height}<span style:height={`${height}px`}
              ></span>{/each}
          </div>
          <div class="wave-label">
            {useSip ? "MICROPHONE · SIP CALLER" : speaking && playbackRole !== "assistant"
              ? playbackRole === "technician"
                ? "TECHNICIAN"
                : "CALLER"
              : "MICROPHONE"}
          </div>
          <div class="wave wave-in" aria-label="Live microphone waveform">
            {#each (useSip ? sipBars(sipConnected ? sipLive.status?.input : undefined) : inputBars) as height}<span style:height={`${height}px`}
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
          {#if !displayMessages.length}<div class="empty">
              <h1>Your local voice assistant</h1>
              <p>{useSip ? "Call 521 from your phone. SIP activity appears here." : "Start a call, then speak or type a message."}</p>
              {#if useSip && sipSettings?.mode === "tts"}<small>Echo + keypad TTS · press #1 or #2. Caller transcription requires IVR conversation mode.</small>{/if}
              <small>VAD → ASR → LLM → TTS</small>
            </div>{/if}{#each displayMessages as message}<article
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
              bind:this={messageInput}
              bind:value={input}
              disabled={(useSip ? !sipCanSend : !connected) || scenarioRunning}
              on:keydown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}></textarea><button
              aria-label="Send message"
              disabled={!canSendText || !input.trim()}><Send size={18} /></button
            >
          </form>
          <div class="controls">
            <button
              class:muted
              on:click={toggleMute}
              disabled={useSip || !connected || !useAsr}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              >{#if muted}<MicOff size={18} />{:else}<Mic
                  size={18}
                />{/if}</button
            >{#if !useVad && useAsr}<button
                disabled={useSip || !connected || busy || muted || scenarioRunning}
                on:click={toggleManualTurn}
                ><Mic size={16} />{manualRecording
                  ? "Send voice turn"
                  : "Record voice turn"}</button
              >{/if}<span class="call-status" role="status">{useSip ? sipStatus : status}</span
            >{#if useSip}<span class="sip-call-hint">{sipConnected ? "Hang up on your phone" : "Dial 521 from 520"}</span>{:else if connected || starting}<button
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
      <div class="details-resize panel-resize" hidden={!visiblePanels.session}>
        <PanelDivider
          label="Resize session details"
          bind:value={detailsWidth}
          min={150}
          max={500}
          reverse
          oncommit={savePanelLayout}
        />
      </div>
      <div
        class="details"
        id="demo-session-details"
        role="region"
        aria-label="Session details"
        hidden={!visiblePanels.session}
      >
        <div class="panel-heading">
          <button
            class="panel-toggle"
            aria-label="Hide session"
            title="Hide session"
            aria-controls="demo-session-details"
            aria-expanded="true"
            data-hide-panel="session"
            on:click={() => togglePanel("session")}><Radio size={15} /></button
          >
          <div class="section-label">SESSION</div>
        </div>
        <dl>
          <dt>Transport</dt>
          <dd>{useSip ? "SIP / RTP" : "HTTPS"}</dd>
          <dt>Audio</dt>
          <dd>{useSip ? "Phone microphone + earpiece" : "Microphone + speaker"}</dd>
          <dt>Turn detection</dt>
          <dd>{useSip ? (sipSettings?.mode === "tts" ? "Echo test" : sipLive.status?.models?.vad || "Server VAD") : useVad && useAsr ? selectedVad?.label || "—" : "Skipped"}</dd>
          <dt>ASR</dt>
          <dd>{useSip ? (sipSettings?.mode === "tts" ? "Skipped · echo test" : sipLive.status?.models?.asr || "Server ASR") : useAsr ? selectedAsr?.label || "—" : "Skipped · text input"}</dd>
          <dt>LLM</dt>
          <dd>{useSip ? (sipSettings?.mode === "tts" ? "Skipped · echo test" : `${(sipLive.status?.dialogue_source || dialogueSource) === "n8n" ? "n8n · " : ""}${(sipLive.status?.dialogue_source ? sipLive.status?.models?.llm : llm) || "Server LLM"}`) : useLlm ? (dialogueSource === "n8n" ? `n8n · ${llm || "—"}` : llm || "—") : "Skipped · passthrough"}</dd>
          <dt>TTS</dt>
          <dd>
            {useSip ? sipLive.status?.models?.tts || selectedTts?.label || sipSettings?.tts_model || "Server TTS" : useTts ? selectedTts?.label || "—" : "Skipped · text output"}
          </dd>
          <dt>Session</dt>
          <dd>{useSip ? sipLive.status?.call_id || "—" : run || "—"}</dd>
        </dl>
        <p>
          {useSip ? "Live SIP call. Audio stays on the phone; waveforms show received and transmitted RTP audio." : "Sequential voice pipeline. Listening pauses while the assistant processes and speaks."}
        </p>
      </div>
      <div class="sip-resize panel-resize" hidden={!visiblePanels.sip}>
        <PanelDivider label="Resize SIP sidebar" bind:value={sipWidth} min={240} max={420} reverse oncommit={savePanelLayout} />
      </div>
      <section class="sip-sidebar" id="demo-sip" aria-label="SIP connection" hidden={!visiblePanels.sip}>
        <div class="panel-heading">
          <button class="panel-toggle" aria-label="Hide SIP" title="Hide SIP"
            aria-controls="demo-sip" aria-expanded="true" data-hide-panel="sip"
            on:click={() => togglePanel("sip")}><Satellite size={15} /></button>
          <div class="section-label">SIP CONNECTION</div>
        </div>
        <SipSidebar onsettings={receiveSipSettings} onstatus={receiveSipStatus} browserBusy={connected || starting} />
      </section>
    </section>
    <div
      class="bottom-resize panel-resize"
      hidden={!visiblePanels.events && !visiblePanels.scenarios}
    >
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
    <div
      class="bottom-panels"
      class:collapsed={!visiblePanels.events && !visiblePanels.scenarios}
      data-resize-container
    >
      <section class="events" id="demo-events">
        <div class="events-title">
          <button
            class="panel-heading title-toggle"
            aria-label={visiblePanels.events ? "Hide events" : "Show events"}
            aria-controls="demo-events-content"
            aria-expanded={visiblePanels.events}
            data-panel-toggle="events"
            data-hide-panel="events"
            on:click={() => togglePanel("events")}
          >
            <Activity size={15} />
            <strong>Events <span>{events.length}</span></strong>
          </button>
          <button
            hidden={!visiblePanels.events}
            on:click={() => {
              events = [];
              localStorage.removeItem(historyKey);
            }}><Trash2 size={14} /> Clear events</button
          >
        </div>
        <div
          class="event-scroll"
          id="demo-events-content"
          hidden={!visiblePanels.events}
        >
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
      <div
        class="events-resize panel-resize"
        hidden={!visiblePanels.events || !visiblePanels.scenarios}
      >
        <PanelDivider
          label="Resize events and scenarios"
          bind:value={eventsShare}
          min={20}
          max={80}
          percent
          oncommit={savePanelLayout}
        />
      </div>
      <section
        class="scenario-dock"
        id="demo-scenarios"
        aria-label="Demo scenarios"
      >
        <button
          class="scenario-title panel-heading title-toggle"
          aria-label={visiblePanels.scenarios
            ? "Hide scenarios"
            : "Show scenarios"}
          aria-controls="demo-scenarios-content"
          aria-expanded={visiblePanels.scenarios}
          data-panel-toggle="scenarios"
          data-hide-panel="scenarios"
          on:click={() => togglePanel("scenarios")}
        >
          <ListMusic size={15} />
          <strong>Scenarios</strong>
        </button>
        <div
          class="scenario-panel"
          id="demo-scenarios-content"
          hidden={!visiblePanels.scenarios}
        >
          <label
            ><select
              aria-label="Scenario"
              value={scenarioMode}
              disabled={scenarioRunning || knowledgeUploading || knowledgeDeleting || savingSettings || !!simulation}
              on:change={(event) => changeScenario(event.currentTarget.value as typeof scenarioMode)}
              >
              <option value="audio">Audio input</option>
              {#each knowledgeScenarios as scenario}<option value={`scenario:${scenario.id}`}>{scenario.name}</option>{/each}
              <option value="add-scenario">Add New Scenario</option></select
            ></label
          >
          {#if scenarioMode === "add-scenario"}
            <label class="audio-choice">Choose documents<input
              class="audio-file-input" aria-label="Scenario documents" type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.html,.htm,.png,.jpg,.jpeg,.gif,.webp"
              disabled={knowledgeUploading} on:change={(event) => chooseKnowledgeFiles(event.currentTarget.files)}
            /></label>
            <small>PDF, DOCX, XLSX, CSV, TXT, Markdown, HTML · up to 8 files, 10 MiB total</small>
            <small>Select HTML and its companion images together.</small>
            {#each newScenarioFiles as file}<p>{file.name} · {Math.ceil(file.size / 1024)} KB</p>{/each}
            <button disabled={knowledgeUploading || !newScenarioFiles.length} on:click={uploadKnowledgeScenario}>
              {knowledgeUploading ? "Adding scenario…" : "Add scenario"}
            </button>
            <p role="status">{knowledgeStatus}</p>
          {:else if selectedKnowledgeScenario}
            <p><strong>{selectedKnowledgeScenario.name}</strong> · {selectedKnowledgeScenario.qaCount} Q/A pairs</p>
            {#if selectedKnowledgeScenario.simulation}
              <small>{useSip
                ? "The simulation starts after the greeting on the next SIP IVR call."
                : "The simulation starts after the greeting when LLM is enabled."}</small>
            {/if}
            {#each selectedKnowledgeScenario.files as file}<p>{file.name}</p>{/each}
            {#each selectedKnowledgeScenario.attachments ?? [] as file}<p>{file.name}</p>{/each}
            {#each selectedKnowledgeScenario.tables ?? [] as table}<p>{table.name} · {table.rowCount} rows</p>{/each}
            <label>Caller voice<select aria-label="Caller voice" bind:value={callerVoiceId} disabled={mockRunning || !savedVoices.length}>
              {#each savedVoices as item}<option value={item.id}>{item.name}</option>{/each}
            </select></label>
            {#if selectedKnowledgeScenario.examples?.length}
              <div class="scenario-examples" role="group" aria-labelledby="scenario-examples-title">
                <h3 id="scenario-examples-title">Mockup questions:</h3>
                {#each selectedKnowledgeScenario.examples as question, index}
                  <button type="button" disabled={knowledgeDeleting || mockRunning || useSip || busy || starting} on:click={() => sendScenarioQuestion(question, index)}>
                    <strong>Q{index + 1}:</strong> <span>{question}</span>
                  </button>
                {/each}
              </div>
              <small>Click a question to speak it with the caller voice and send it{scenarioConnected ? "" : " (starts the call)"}.</small>
            {:else}
              <small>Speak or type a question during a call.</small>
            {/if}
            {#if mockCall}
              <div class="scenario-examples mock-call" role="group" aria-labelledby="mock-call-title">
                <h3 id="mock-call-title">Mock call:</h3>
                <small>Speaks the opening answers, then each selected 情境's caller lines, waiting for every reply. Every run uses new names and numbers.</small>
                <div class="mock-columns">
                  <div class="mock-choices">
                    {#each mockCall.sections as section}
                      <label class="mock-section"><input type="checkbox" aria-label={`Mock 情境 ${section.number}`}
                        checked={mockSections.includes(section.number)} disabled={mockRunning}
                        on:change={(event) => toggleMockSection(section.number, event.currentTarget.checked)} /> 情境 {section.number}：{section.title}</label>
                    {/each}
                  </div>
                  <ol class="mock-lines">
                    {#each mockLines as line, index}<li class:current={index === mockLine}><strong>Q{index + 1}</strong> {line.text}</li>{/each}
                  </ol>
                </div>
                {#if useSip}<small>Mock calls run in the browser; turn SIP off.</small>{/if}
                {#if mockStatus}<small role="status">{mockStatus}</small>{/if}
              </div>
            {/if}
            <div class="scenario-actions">
              {#if mockCall}
                <button type="button" disabled={mockRunning || useSip || busy || starting || knowledgeDeleting} on:click={runMockCall}>{mockRunning ? "Mock call running…" : "Run mock call"}</button>
              {/if}
              <button title="Remove this scenario and its imported data" disabled={knowledgeDeleting || knowledgeUploading || !!simulation || mockRunning} on:click={removeSelectedKnowledgeScenario}><Trash2 size={14} /> {knowledgeDeleting ? "Removing scenario…" : "Remove scenario"}</button>
            </div>
            <p role="status">{knowledgeStatus}</p>
          {:else if isAudioScenario}
            <div class="scenario-upload">
              <strong title={scenarioAudioName || "No audio selected"}
                >{scenarioAudioName || "No audio selected"}</strong
              >
              <small>WAV, MP3, FLAC</small>
              <label class="audio-choice"
                >Choose audio<input
                  class="audio-file-input"
                  bind:this={scenarioUploadInput}
                  aria-label="Choose scenario audio"
                  type="file"
                  accept=".wav,.mp3,.flac,audio/*"
                  disabled={scenarioRunning}
                  on:change={(e) =>
                    setScenarioFile(e.currentTarget.files?.[0] || null)}
                /></label
              >
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
                !useAsr ||
                !scenarioCanCall}
              on:click={() => runScenario()}>Send audio</button
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
    grid-template-rows: 65px minmax(0, 1fr);
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
    top: 65px;
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
  .demo [hidden] {
    display: none !important;
  }
  .demo.no-settings {
    grid-template-columns: minmax(0, 1fr);
  }
  .session.no-session {
    grid-template-columns: minmax(0, 1fr) 6px var(--sip-width, 280px);
    grid-template-rows: minmax(0, 1fr);
    min-height: 320px;
  }
  .session.no-sip { grid-template-columns: minmax(0, 1fr) 6px var(--details-width, 225px); }
  .session.no-session.no-sip { grid-template-columns: minmax(0, 1fr); }
  .sip-sidebar { min-width: 0; overflow: auto; padding: 4px 8px; border-left: 1px solid var(--line); }
  .sip-call-hint { color: var(--muted); font-size: 11px; }
  .bottom-panels.collapsed {
    height: 54px;
  }
  .bottom-panels > .scenario-dock {
    grid-column: 3;
  }
  .demo .title-toggle {
    background: transparent;
    border: 0;
    border-radius: 0;
    color: inherit;
    text-align: left;
    cursor: pointer;
    margin: 0;
  }
  .events-title .title-toggle {
    flex: 1;
    align-self: stretch;
    font-size: 13px;
  }
  .demo .title-toggle:hover {
    background: var(--panel-2);
  }
  .demo .top-bar {
    grid-column: 1 / -1;
    gap: 24px;
  }
  .top-bar .brand {
    margin: 0;
  }
  .console-title {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1;
    gap: 12px;
  }
  .console-title strong {
    flex-shrink: 0;
  }
  .header-actions,
  .panel-restores,
  .panel-heading {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .header-actions {
    flex-shrink: 0;
    gap: 12px;
  }
  .panel-restores:empty {
    display: none;
  }
  .demo .panel-toggle {
    padding: 5px;
    flex-shrink: 0;
    min-width: 28px;
    min-height: 28px;
    color: var(--muted);
    background: transparent;
  }
  .demo .panel-toggle:hover {
    color: var(--text);
    background: var(--button-bg);
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
    max-height: calc(100vh - 65px);
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
  .demo label.postprocess-switch {
    justify-content: space-between;
    margin: 12px 0;
  }
  .postprocess-control {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tts-playback-options {
    display: flex;
    gap: 10px;
    align-items: end;
    justify-content: space-between;
  }
  .demo label.tts-speed {
    font-size: 10px;
    max-width: 92px;
  }
  .demo label.tts-streaming-switch {
    display: flex;
    align-items: center;
    gap: 8px;
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
    height: calc(100vh - 65px);
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
    margin-left: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    grid-template-columns: minmax(0, 1fr) 6px var(--details-width, 225px) 6px var(--sip-width, 280px);
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
  .scenario-panel > button {
    margin: 8px 5px 8px 0;
  }
  .scenario-panel > small {
    display: block;
    margin-top: 6px;
  }
  .scenario-examples {
    display: grid;
    gap: 5px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
  }
  .scenario-examples h3 {
    margin: 0 0 2px;
    font-size: inherit;
  }
  .demo .scenario-examples button {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    justify-content: start;
    align-items: start;
    text-align: left;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .demo .scenario-examples label.mock-section {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 8px;
    margin: 2px 0;
    text-align: left;
    font-size: inherit;
    color: var(--text);
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  .demo .scenario-examples label.mock-section input {
    display: inline-block;
    flex: none;
    width: auto;
    margin: 2px 0 0;
    padding: 0;
  }
  .mock-columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    align-items: start;
  }
  .mock-choices {
    display: grid;
    gap: 2px;
  }
  .scenario-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  }
  .demo .scenario-actions button {
    width: 100%;
    margin: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .mock-lines {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 3px;
    max-height: 220px;
    overflow-y: auto;
    font-size: 0.9em;
  }
  .mock-lines li {
    padding: 2px 6px;
    border-radius: 6px;
    overflow-wrap: anywhere;
  }
  .mock-lines li.current {
    background: var(--accent-soft, rgba(80, 140, 255, 0.15));
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
  .scenario-preview {
    display: block;
    width: 100%;
    height: 36px;
    margin: 8px 0;
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

    .sip-resize { display: none; }
    .sip-sidebar { max-height: 420px; border-left: 0; border-top: 1px solid var(--line); }
    .details {
      max-height: 220px;
      overflow: auto;
    }
    .demo .session {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(280px, 1fr) auto auto;
      min-height: 540px;
    }
    .bottom-panels {
      grid-template-rows: auto auto;
    }
    .bottom-panels > .scenario-dock {
      grid-column: 1;
    }
    .bottom-panels.collapsed {
      height: 108px;
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
    .top-bar .brand {
      font-size: 15px;
      gap: 6px;
    }
    .demo .top-bar {
      gap: 10px;
    }
    .top-bar .console-title {
      gap: 6px;
    }
    .top-bar .console-title strong {
      display: none;
    }
    .top-bar .connection {
      font-size: 8px;
      letter-spacing: 0;
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
