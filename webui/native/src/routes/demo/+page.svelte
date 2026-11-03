<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Mic, MicOff, Phone, PhoneOff, Send, Trash2 } from "@lucide/svelte";
  import logo from "../../../static/logo_cloud.svg?raw";
  import "../../app.css";
  import { browserDecodeToWav, encodePcm16Wav } from "$lib/audio";
  import { readGreetingCsv, writeGreetingCsv } from "$lib/greetings";
  import { recognitionContext } from "$lib/asr-context";
  import { uploadWav } from "$lib/api";
  import {
    endpointJson,
    endpointBlob,
    type OpenAIModel,
    chatText,
    type ChatMessage,
  } from "$lib/openai";
  import {
    discoverDemoAudioModels,
    discoverDemoLlmModels,
    preferredDemoModel,
    type DemoAudioModel,
  } from "$lib/demo-models";
  type Event = {
    time: string;
    run: string;
    type: string;
    summary: string;
    runtimeMs?: number | null;
  };
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
    llmModels: OpenAIModel[] = [];
  let vadKey = "",
    asrKey = "",
    ttsKey = "",
    llm = "";
  let discovering = false,
    modelError = "";
  $: vadModels = audioModels.filter((m) => m.task === "vad");
  $: asrModels = audioModels.filter((m) => ["asr", "stt"].includes(m.task));
  $: ttsModels = audioModels.filter((m) => ["tts", "clon"].includes(m.task));
  $: selectedVad = audioModels.find((m) => m.key === vadKey);
  $: selectedAsr = audioModels.find((m) => m.key === asrKey);
  $: selectedTts = audioModels.find((m) => m.key === ttsKey);
  $: canCall = !!(
    selectedVad &&
    selectedAsr &&
    selectedTts &&
    llm &&
    filesReady &&
    greeting.trim()
  );
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
          llmModels.find((m) => /LFM2[._-]?5.*1[._-]?2B.*Q4_K_M/i.test(m.id))
            ?.id ||
          llmModels[0]?.id ||
          "";
    } else {
      llmModels = [];
      llm = "";
      modelError += ` LLM models: ${result[1].reason}`;
    }
    discovering = false;
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
    mounted && filesReady,
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
  async function respond(text: string, audio?: Blob, generation = epoch) {
    const signal = controller?.signal;
    if (!connected || busy || !signal) return;
    busy = true;
    error = "";
    reset();
    const turnStarted = performance.now();
    let operationStarted = turnStarted;
    try {
      if (audio) {
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
            messages: [{ role: "system", content: prompt }, ...messages],
            max_tokens: 256,
            temperature: 0.4,
            stream: false,
          }),
        },
        signal,
      );
      const reply = chatText(response).trim();
      if (!reply)
        throw new Error("The language model returned an empty reply.");
      if (generation !== epoch) return;
      record("LLM_COMPLETED", llm, performance.now() - operationStarted);
      messages = [...messages, { role: "assistant", content: reply }];
      record("CONVERSATION_ITEM_ADDED", `ASSISTANT · ${reply}`);
      operationStarted = performance.now();
      const ttsId = await load(ttsKey, signal);
      status = "Synthesizing";
      const body: Record<string, unknown> = {
        model: ttsId,
        input: reply,
        response_format: "wav",
      };
      if (referencePath && supportsReference) {
        body.voice_ref = referencePath;
        body.reference_text = referenceText;
      } else {
        body.voice = voice;
        if (supportsReference && referenceText.trim())
          body.reference_text = referenceText.trim();
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
      if (generation !== epoch) return;
      record("PLAYBACK_COMPLETED", "Assistant reply played", playbackMs);
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
        if (!error) status = muted ? "Microphone muted" : "Listening";
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
      await prepareGreeting();
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
    status = "Speaking";
    record("AGENT_STATE_CHANGED", "thinking → speaking");
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
      record("AGENT_STATE_CHANGED", "speaking → listening");
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
      referenceText,
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
    if (!ready || inCall) return;
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
    if (
      key === preparedKey ||
      (key === preparingKey &&
        greetingPreparing &&
        !greetingAborter?.signal.aborted)
    )
      return;
    greetingAborter?.abort();
    greetingTimer = setTimeout(() => {
      void prepareGreeting();
    }, 500);
  }
  async function prepareGreeting(): Promise<Blob | null> {
    const key = greetingFingerprint();
    if (!greeting.trim()) return null;
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
        if (voiceFile && supportsReference) {
          if (!referenceText.trim())
            throw new Error("Enter the reference transcript first.");
          body.voice_ref = await uploadWav(
            await browserDecodeToWav(voiceFile, 24000, 1),
            aborter.signal,
          );
          body.reference_text = referenceText;
        } else {
          body.voice = voice;
          if (supportsReference && referenceText.trim())
            body.reference_text = referenceText.trim();
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
    if (file && asrKey) void transcribeReference(file);
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
  function send() {
    const text = input.trim();
    if (!text || busy || detecting || !connected) return;
    input = "";
    void respond(text);
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
      if (!window.isSecureContext || !navigator.mediaDevices)
        throw new Error(
          "Open this page over trusted HTTPS to use the microphone.",
        );
      context = new AudioContext();
      await context.resume();
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
      if (!canCall)
        throw new Error(
          "Choose an installed model for each stage before calling.",
        );
      if (voiceFile && supportsReference) {
        if (!referenceText.trim())
          throw new Error("Enter the matching reference voice transcript.");
        referencePath = await uploadWav(
          await browserDecodeToWav(voiceFile, 24000, 1),
          controller.signal,
        );
      } else referencePath = "";
      if (epoch !== generation || !context) return;
      source = context.createMediaStreamSource(stream);
      processor = context.createScriptProcessor(4096, 1, 1);
      gain = context.createGain();
      gain.gain.value = 0;
      source.connect(processor);
      processor.connect(gain);
      gain.connect(context.destination);
      connected = true;
      muted = false;
      status = "Listening";
      record(
        "SESSION_STARTED",
        "Microphone connected · echo cancellation enabled",
      );
      busy = !!greeting.trim();
      processor.onaudioprocess = (e) => {
        const samples = new Float32Array(e.inputBuffer.getChannelData(0));
        inputBars = muted ? Array(36).fill(2) : bars(samples);
        if (muted || busy || speaking) {
          windows = [];
          frames = 0;
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
          outputBars = bars(data);
        } else outputBars = Array(36).fill(2);
        animation = requestAnimationFrame(draw);
      };
      draw();
      if (greeting.trim()) {
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
        status = "Listening";
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
    starting = false;
    busy = false;
    detecting = false;
    speaking = false;
    reset();
    inputBars = Array(36).fill(2);
    outputBars = Array(36).fill(2);
    if (log) {
      status = "Call ended";
      record("SESSION_ENDED", "Call ended");
    }
  }
  function toggleMute() {
    muted = !muted;
    reset();
    if (!busy) status = muted ? "Microphone muted" : "Listening";
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
    {#if !discovering && !llmModels.length && !modelError}<p class="error">
        No downloaded LLM models found. Download a model in the LLM page, then
        refresh models.
      </p>{/if}
    <fieldset
      disabled={connected ||
        starting ||
        discovering ||
        cloneRecording ||
        cloneBusy}
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
      <label
        >LLM<select aria-label="LLM" bind:value={llm}
          ><option value="" disabled>No downloaded LLM models</option
          >{#each llmModels as model}<option value={model.id}>{model.id}</option
            >{/each}</select
        ></label
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
        >Built-in voice<select bind:value={voice}>
          {#each voiceChoices as id}<option value={id}
              >{id === "lingCLvocals"
                ? "Ling · Chinese"
                : id === "wangSG9s"
                  ? "Wang · Chinese"
                  : id}</option
            >{/each}
        </select></label
      >
      {#if supportsReference}<label
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
        >
      {/if}<label
        >System prompt<textarea rows="4" bind:value={prompt}></textarea></label
      ><button disabled={savingPrompt} on:click={savePromptCsv}
        >{savingPrompt ? "Saving…" : "Save prompt.csv"}</button
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
      <p role="status">{fileStatus}</p>
    </fieldset>
    {#if supportsReference}<div class="clone-recording">
        {#if cloneRecording}<button on:click={() => cloneRecorder?.stop()}
            ><MicOff size={16} /> Stop recording</button
          >
        {:else}<button
            disabled={connected || starting || cloneBusy || !asrKey}
            on:click={startCloneRecording}
            ><Mic size={16} /> Record clone voice</button
          >{/if}
        {#if cloneStatus}<p role="status">{cloneStatus}</p>{/if}
      </div>{/if}
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
          <div class="wave-label">MICROPHONE</div>
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
        <div class="transcript" aria-live="polite">
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
            <input
              aria-label="Message"
              placeholder="Type something…"
              bind:value={input}
              disabled={!connected}
            /><button
              aria-label="Send message"
              disabled={!connected || busy || detecting || !input.trim()}
              ><Send size={18} /></button
            >
          </form>
          <div class="controls">
            <button
              class:muted
              on:click={toggleMute}
              disabled={!connected}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              >{#if muted}<MicOff size={18} />{:else}<Mic
                  size={18}
                />{/if}</button
            ><span class="call-status" role="status">{status}</span
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
          <dd>{selectedVad?.label || "—"}</dd>
          <dt>ASR</dt>
          <dd>{selectedAsr?.label || "—"}</dd>
          <dt>LLM</dt>
          <dd>{llm || "—"}</dd>
          <dt>TTS</dt>
          <dd>{selectedTts?.label || "—"}</dd>
          <dt>Session</dt>
          <dd>{run || "—"}</dd>
        </dl>
        <p>
          Sequential voice pipeline. Listening pauses while the assistant
          processes and speaks.
        </p>
      </div>
    </section>
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
    min-height: 100px;
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
  .composer input {
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
    height: 30vh;
    min-height: 180px;
    border-top: 1px solid var(--line);
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
