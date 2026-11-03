<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Mic, MicOff, Phone, PhoneOff, Send, Trash2 } from "@lucide/svelte";
  import logo from "../../../static/logo_cloud.svg?raw";
  import "../../app.css";
  import { browserDecodeToWav, encodePcm16Wav } from "$lib/audio";
  import { uploadWav } from "$lib/api";
  import {
    endpointJson,
    endpointBlob,
    endpointRouterModels,
    chatText,
    type ChatMessage,
  } from "$lib/openai";
  type Event = { time: string; run: string; type: string; summary: string };
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
  let root = "/app/models",
    asrPath = "Audio8-ASR-0.1B-GGUF/audio8-asr-0.1b-q8_0.gguf";
  let ttsPath = "ZipVoice-Distill-GGUF",
    llm = "bartowski/LiquidAI_LFM2.5-1.2B-Instruct-GGUF:Q4_K_M";
  let prompt =
    "你是現場維修保養的語音助理。請用繁體中文簡短回答，準確保留工單、設備代碼及數字。";
  let threshold = 0.5,
    windowMs = 650,
    voiceFile: File | null = null,
    referenceText = "",
    referencePath = "";
  let voice = "lingCLvocals";
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
  function record(type: string, summary: string) {
    events = [
      { time: new Date().toISOString(), run, type, summary },
      ...events,
    ].slice(0, 300);
    try {
      localStorage.setItem(historyKey, JSON.stringify(events));
    } catch {}
  }
  function fail(cause: unknown) {
    error = cause instanceof Error ? cause.message : String(cause);
    status = "Error";
    record("ERROR", error);
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
    id: string,
    family: string,
    path: string,
    task: string,
    signal: AbortSignal,
  ) {
    status = `Loading ${family}…`;
    await endpointJson(
      "",
      "models/load",
      {
        method: "POST",
        body: JSON.stringify({ id, family, path, task, mode: "offline" }),
      },
      signal,
    );
  }
  async function detect(samples: Float32Array, generation: number) {
    const ctx = context,
      signal = controller?.signal;
    if (!ctx || !signal || detecting || busy || speaking || muted) return;
    detecting = true;
    try {
      await load(
        "demo-vad",
        "silero_vad",
        "/app/assets/framework/models/silero_vad",
        "vad",
        signal,
      );
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
            model: "demo-vad",
            audio,
            options: {
              threshold: String(threshold),
              min_speech_duration_ms: "100",
            },
          }),
        },
        signal,
      );
      if (epoch !== generation || muted || !connected) return;
      const speech = (result.segments || result.speech_segments || []).some(
        (s: any) => s.end_sample > s.start_sample,
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
        fail(cause);
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
    try {
      if (audio) {
        await load(
          "demo-audio8-asr",
          "audio8_asr",
          `${root}/${asrPath}`,
          "asr",
          signal,
        );
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
            body: JSON.stringify({ model: "demo-audio8-asr", audio: path }),
          },
          signal,
        );
        text = result.text?.trim();
        if (!text) {
          record("ASR_EMPTY", "No speech recognized");
          return;
        }
        record("USER_INPUT_TRANSCRIBED", text);
      }
      if (generation !== epoch) return;
      messages = [...messages, { role: "user", content: text }];
      record("CONVERSATION_ITEM_ADDED", `USER · ${text}`);
      status = "Thinking";
      record("AGENT_STATE_CHANGED", "listening → thinking");
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
      messages = [...messages, { role: "assistant", content: reply }];
      record("CONVERSATION_ITEM_ADDED", `ASSISTANT · ${reply}`);
      await load(
        "demo-zipvoice",
        "zipvoice",
        `${root}/${ttsPath}`,
        "clon",
        signal,
      );
      status = "Synthesizing";
      const body: Record<string, unknown> = {
        model: "demo-zipvoice",
        input: reply,
        response_format: "wav",
      };
      if (referencePath) {
        body.voice_ref = referencePath;
        body.reference_text = referenceText;
      } else body.voice = voice;
      const output = await endpointBlob("", "audio/speech", body, signal);
      if (generation !== epoch || !context) return;
      const buffer = await context.decodeAudioData(await output.arrayBuffer());
      if (generation !== epoch || !context) return;
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
        speaking = false;
        player = null;
        analyser = null;
        record("AGENT_STATE_CHANGED", "speaking → listening");
      }
    } catch (cause) {
      if (generation === epoch && !signal.aborted) fail(cause);
    } finally {
      if (generation === epoch) {
        busy = false;
        reset();
        if (!error) status = muted ? "Microphone muted" : "Listening";
      }
    }
  }
  function send() {
    const text = input.trim();
    if (!text || busy || detecting || !connected) return;
    input = "";
    void respond(text);
  }
  async function call() {
    if (connected || starting) return;
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
      root = (
        await endpointJson<{ models_root: string }>(
          "",
          "ui/models-root",
          {},
          controller.signal,
        )
      ).models_root.replace(/\/$/, "");
      const available = await endpointRouterModels(
        llmBase(),
        controller.signal,
      );
      const match = available.find((m) =>
        /LFM2\.5-1\.2B-Instruct.*Q4_K_M/i.test(m.id),
      );
      if (match && /LFM2\.5-1\.2B-Instruct/i.test(llm)) llm = match.id;
      if (voiceFile) {
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
    stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    record("MICROPHONE", muted ? "Muted" : "Unmuted");
  }
  onMount(() => {
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
  onDestroy(() => hangup(false));
</script>

<svelte:head><title>GeoVision · Voice Demo</title></svelte:head>
<div class="demo">
  <aside>
    <a class="brand" href="#/?studio"
      ><span class="gv">{@html logo}</span><span
        >GeoVision<small>VOICE CONSOLE</small></span
      ></a
    >
    <div class="section-label">MODEL SETTINGS</div>
    <fieldset disabled={connected || starting}>
      <label>VAD<select><option>Silero VAD</option></select></label>
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
        >ASR<select><option>Audio8 ASR 0.1B (local setup)</option></select
        ></label
      >
      <label>ASR file<input bind:value={asrPath} /></label>
      <label>LLM<input aria-label="LLM model" bind:value={llm} /></label><small
        >LiquidAI LFM2.5 1.2B Instruct · Q4_K_M</small
      >
      <label
        >TTS<select><option>ZipVoice (zh/en zero-shot cloning)</option></select
        ></label
      >
      <label>TTS folder<input bind:value={ttsPath} /></label>
      <label
        >Built-in voice<select bind:value={voice}>
          <option value="lingCLvocals">Ling · Chinese</option>
          <option value="wangSG9s">Wang · Chinese</option>
        </select></label
      >
      <label
        >Custom reference voice (optional)<input
          type="file"
          accept="audio/*"
          on:change={(e) => (voiceFile = e.currentTarget.files?.[0] || null)}
        /></label
      >
      <label
        >Reference transcript<textarea
          rows="2"
          bind:value={referenceText}
          placeholder="Exact words in reference audio"></textarea></label
      >
      <label
        >System prompt<textarea rows="4" bind:value={prompt}></textarea></label
      >
    </fieldset>
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
            ><span role="status">{status}</span
            >{#if connected || starting}<button
                class="hangup"
                on:click={() => hangup()}><PhoneOff size={16} /> Hang up</button
              >{:else}<button class="call" on:click={call}
                ><Phone size={16} /> Start call</button
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
          <dd>Silero VAD</dd>
          <dt>ASR</dt>
          <dd>Audio8 0.1B</dd>
          <dt>LLM</dt>
          <dd>LFM2.5 1.2B Q4_K_M</dd>
          <dt>TTS</dt>
          <dd>ZipVoice</dd>
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
              ><th>TIMESTAMP</th><th>SESSION</th><th>EVENT TYPE</th><th
                >SUMMARY</th
              ></tr
            ></thead
          ><tbody
            >{#each events as event}<tr
                ><td>{new Date(event.time).toLocaleTimeString()}</td><td
                  >{event.run}</td
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
    background: #090c10;
    color: #e5e9ee;
  }
  .demo {
    --line: #242b34;
    display: grid;
    grid-template-columns: 290px 1fr;
    min-height: 100vh;
    font-family: Inter, system-ui, sans-serif;
    font-size: 13px;
    background: #090c10;
    color: #e5e9ee;
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
    text-decoration: none;
    font-size: 20px;
    font-weight: 650;
    margin-bottom: 35px;
  }
  .brand small {
    display: block;
    color: #7d8998;
    font-size: 9px;
    letter-spacing: 2px;
    margin-top: 3px;
  }
  .gv {
    width: 34px;
    height: 34px;
  }
  .section-label {
    color: #83909f;
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
    color: #b3bdc9;
    font-size: 11px;
    margin: 17px 0 5px;
  }
  .demo input,
  .demo select,
  .demo textarea {
    display: block;
    width: 100%;
    background: #11171e;
    border: 1px solid #303b47;
    border-radius: 6px;
    color: #e5e9ee;
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
    color: #8995a4;
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
    color: #8995a4;
    font-size: 9px;
    letter-spacing: 1.5px;
  }
  .connection {
    font-size: 10px;
    letter-spacing: 1px;
    color: #8b98a6;
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
    color: #7d8998;
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
    color: #7d8998;
  }
  .empty h1 {
    font-size: 21px;
    font-weight: 500;
    color: #e0e7ef;
  }
  .empty p {
    font-size: 13px;
  }
  .transcript article {
    max-width: 88%;
    padding: 12px 16px;
    background: #111921;
    border-radius: 10px;
    align-self: flex-start;
  }
  .transcript article.user {
    align-self: flex-end;
    background: #1b2932;
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
    border: 1px solid #303b47;
    border-radius: 6px;
    background: #18212b;
    color: #e5e9ee;
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
    color: #91a1af;
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
    color: #7d8998;
    margin-top: 22px;
  }
  .details dd {
    margin: 6px 0 0;
    overflow-wrap: anywhere;
  }
  .details p {
    color: #7d8998;
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
    color: #7d8998;
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
  }
  .events th {
    position: sticky;
    top: 0;
    background: #11151b;
    color: #8894a2;
    font-size: 9px;
    letter-spacing: 1px;
    padding: 11px 20px;
  }
  .events td {
    padding: 10px 20px;
    border-top: 1px solid #1b222b;
    color: #aeb9c7;
    overflow-wrap: anywhere;
  }
  .events th:first-child {
    width: 110px;
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
    color: #7d8998;
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
    .events th:nth-child(2),
    .events td:nth-child(2) {
      display: none;
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
