import { PcmQueuePlayer } from "./pcm-queue-player";
import { splitSpeechText } from "./speech-text";
import { encodePcm16Wav } from "./audio";
import { reportedRtf } from "./response-timing";

// Match the context clock to the effective source rate, including speed.
// Web Audio then resamples the continuous output once instead of restarting
// an independent resampler for every PCM source.
export function speechContextOptions(family: string | undefined, playbackRate = 1): AudioContextOptions | undefined {
  return family === "voxcpm1" ? {sampleRate: Math.round(16000 * playbackRate)} : undefined;
}

export interface SpeechChunk {
  type: "speech.audio.delta";
  audio: string;
  sample_rate: number;
  channels: number;
  format: "pcm_s16le";
}
export type SpeechEvent =
  SpeechChunk | { type: "speech.audio.done"; timing?: Record<string, unknown> };

export async function* speechStreamEvents(
  body: Record<string, unknown>,
  signal: AbortSignal,
): AsyncGenerator<SpeechEvent> {
  const response = await fetch(new URL("v1/audio/speech", document.baseURI), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      ...body,
      stream: true,
      stream_format: "sse",
      response_format: "pcm",
    }),
    signal,
  });
  if (!response.ok) {
    const message = await response.text();
    try {
      const error = JSON.parse(message);
      throw new Error(error.error?.message || error.message || message);
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new Error(message || `Speech stream failed: ${response.status}`);
      throw error;
    }
  }
  if (!response.body)
    throw new Error("This browser cannot read streamed speech.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let pending = "",
    data: string[] = [],
    completed = false,
    eof = false;
  try {
    while (!eof) {
      const chunk = await reader.read();
      eof = chunk.done;
      pending += decoder.decode(chunk.value, { stream: !eof });
      if (eof) pending += "\n\n";
      let end: number;
      while ((end = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, end).replace(/\r$/, "");
        pending = pending.slice(end + 1);
        if (line.startsWith("data:"))
          data.push(line.slice(5).replace(/^ /, ""));
        if (line !== "" || !data.length) continue;
        const payload = data.join("\n");
        data = [];
        if (payload === "[DONE]") continue;
        const event = JSON.parse(payload);
        if (event.type === "error" || event.error)
          throw new Error(
            event.error?.message || event.message || "Speech stream failed.",
          );
        if (event.type === "speech.audio.delta") {
          if (completed)
            throw new Error("Audio arrived after speech completed.");
          yield event as SpeechChunk;
        } else if (event.type === "speech.audio.done") {
          completed = true;
          yield event as SpeechEvent;
        }
      }
    }
    if (signal.aborted)
      throw signal.reason || new DOMException("Cancelled", "AbortError");
    if (!completed) throw new Error("Speech stream closed before completion.");
  } finally {
    if (!eof) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function decodeSpeechChunk(event: SpeechChunk): {
  samples: Float32Array<ArrayBuffer>[];
  sampleRate: number;
  frames: number;
} {
  if (
    !Number.isInteger(event.sample_rate) ||
    event.sample_rate < 8000 ||
    event.sample_rate > 192000 ||
    !Number.isInteger(event.channels) ||
    event.channels < 1 ||
    event.channels > 8 ||
    event.format !== "pcm_s16le"
  )
    throw new Error(
      "Streamed speech is missing valid PCM format metadata. Rebuild the audio server.",
    );
  const bytes = Uint8Array.from(atob(event.audio), (c) => c.charCodeAt(0));
  if (!bytes.length || bytes.length % (2 * event.channels))
    throw new Error("Invalid streamed PCM audio length.");
  const frames = bytes.length / (2 * event.channels),
    view = new DataView(bytes.buffer);
  const samples = Array.from(
    { length: event.channels },
    () => new Float32Array(frames),
  );
  for (let frame = 0; frame < frames; frame++)
    for (let channel = 0; channel < event.channels; channel++)
      samples[channel][frame] =
        view.getInt16((frame * event.channels + channel) * 2, true) / 32768;
  return { samples, sampleRate: event.sample_rate, frames };
}

async function* speechBuffers(
  ctx: AudioContext,
  body: Record<string, unknown>,
  signal: AbortSignal,
): AsyncGenerator<{ buffer?: AudioBuffer; rtf?: number | null }> {
  for await (const event of speechStreamEvents(body, signal)) {
    if (event.type === "speech.audio.done") {
      yield { rtf: reportedRtf(event) };
      continue;
    }
    const decoded = decodeSpeechChunk(event);
    const buffer = ctx.createBuffer(
      decoded.samples.length,
      decoded.frames,
      decoded.sampleRate,
    );
    decoded.samples.forEach((samples, channel) =>
      buffer.getChannelData(channel).set(samples),
    );
    yield { buffer };
  }
}

export interface SpeechStreamSummary {
  chunks: number;
  textGroups?: number;
  rtf: number | null;
  wallMs: number;
  playbackMs: number;
  audio?: Blob;
}

// Build a short startup reserve when requested, while generation continues.
// The shared audio clock keeps chunks ordered without overlapping playback.
export async function playSpeechStream(
  ctx: AudioContext,
  body: Record<string, unknown>,
  signal: AbortSignal,
  options: {
    destination?: AudioNode;
    leadInSeconds?: number;
    bufferSeconds?: number;
    collectAudio?: boolean;
    playbackRate?: number;
    groupPauseSeconds?: number;
    continuousPcm?: boolean;
    onFirstAudio?: (wallMs: number) => void;
    onUnderrun?: () => void;
    onRenderer?: (renderer: "pcm-queue" | "scheduled-sources") => void;
    onSynthesized?: (summary: SpeechStreamSummary) => void;
  } = {},
): Promise<SpeechStreamSummary> {
  const started = performance.now();
  const rate = options.playbackRate ?? 1;
  if (!Number.isFinite(rate) || rate < 0.7 || rate > 1.25)
    throw new Error("Playback speed must be between 0.7 and 1.25.");
  const bufferSeconds = options.bufferSeconds ?? 0;
  if (!Number.isFinite(bufferSeconds) || bufferSeconds < 0 || bufferSeconds > 2)
    throw new Error("Streaming buffer must be between 0 and 2 seconds.");
  const texts = splitSpeechText(String(body.input || ""));
  let weightedRtf = 0,
    rtfDuration = 0,
    allRtf = true;
  let nextStart = 0,
    firstAudio = 0,
    chunks = 0,
    scheduledChunks = 0,
    rtf: number | null = null;
  let format: { sampleRate: number; channels: number } | undefined;
  let pcmPlayer: PcmQueuePlayer | undefined;
  let pcmAttempted = false;
  const sources = new Map<AudioBufferSourceNode, () => void>();
  const playback: Promise<void>[] = [],
    captured: AudioBuffer[] = [];
  const stop = () => {
    pcmPlayer?.stop();
    for (const [source, resolve] of sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* already ended */
      }
      source.disconnect();
      resolve();
    }
    sources.clear();
  };
  signal.addEventListener("abort", stop, { once: true });
  try {
    if (signal.aborted)
      throw signal.reason || new DOMException("Cancelled", "AbortError");
    await ctx.resume();
    for (let group = 0; group < texts.length; group++) {
      let groupDuration = 0,
        groupRtf: number | null = null,
        groupChunks = 0;
      const pending: AudioBuffer[] = [];
      let pendingSeconds = 0,
        buffering = true;
      const flushPending = () => {
        for (const buffer of pending) {
          if (pcmPlayer) { pcmPlayer.push(buffer); scheduledChunks++; continue; }
          if (!scheduledChunks) {
            firstAudio = performance.now();
            nextStart = ctx.currentTime + (options.leadInSeconds ?? 0.06);
            options.onFirstAudio?.(firstAudio - started);
          }
          scheduledChunks++;
          const source = ctx.createBufferSource();
          let duration = buffer.duration / rate;
          if (rate !== 1 && Math.abs(ctx.sampleRate - buffer.sampleRate * rate) < 0.5) {
            // Playback speed is represented by the context clock. Relabel
            // identical PCM at that rate instead of enabling a per-source
            // resampler through playbackRate (even 0.9 has float32 rounding).
            const paced = ctx.createBuffer(buffer.numberOfChannels, buffer.length, ctx.sampleRate);
            for (let channel = 0; channel < buffer.numberOfChannels; channel++)
              paced.copyToChannel(buffer.getChannelData(channel), channel);
            source.buffer = paced;
            source.playbackRate.value = 1;
            duration = paced.duration;
          } else {
            source.buffer = buffer;
            source.playbackRate.value = rate;
          }
          source.connect(options.destination || ctx.destination);
          playback.push(
            new Promise<void>((resolve) => {
              sources.set(source, resolve);
              source.onended = () => {
                sources.delete(source);
                source.disconnect();
                resolve();
              };
            }),
          );
          // Keep already queued chunks contiguous. A late chunk can start now;
          // adding a new safety delay to every source creates audible holes.
          const when = Math.max(nextStart, ctx.currentTime);
          source.start(when);
          nextStart = when + duration;
        }
        pending.length = 0;
        pendingSeconds = 0;
        buffering = false;
      };
      for await (const event of speechBuffers(
        ctx,
        { ...body, input: texts[group] },
        signal,
      )) {
        if (signal.aborted)
          throw signal.reason || new DOMException("Cancelled", "AbortError");
        if (event.rtf !== undefined) groupRtf = event.rtf;
        const buffer = event.buffer;
        if (!buffer) continue;
        if (
          format &&
          (format.sampleRate !== buffer.sampleRate ||
            format.channels !== buffer.numberOfChannels)
        )
          throw new Error("Speech audio format changed within a stream.");
        format = {
          sampleRate: buffer.sampleRate,
          channels: buffer.numberOfChannels,
        };
        if (options.continuousPcm && !pcmAttempted) {
          pcmAttempted = true;
          if (Math.abs(ctx.sampleRate-buffer.sampleRate*rate)<0.5)
            pcmPlayer = await PcmQueuePlayer.create(ctx, format.channels, options.destination || ctx.destination, options.leadInSeconds ?? 0.06, () => {
              firstAudio = performance.now();
              options.onFirstAudio?.(firstAudio-started);
            }, options.onUnderrun);
          options.onRenderer?.(pcmPlayer ? "pcm-queue" : "scheduled-sources");
          if (signal.aborted) {
            pcmPlayer?.stop();
            throw signal.reason || new DOMException("Cancelled", "AbortError");
          }
        }
        if (group > 0 && !groupChunks) {
          const pause = options.groupPauseSeconds ?? 0.22;
          nextStart += pause;
          pcmPlayer?.pause(pause,ctx.sampleRate,format.channels);
          if (options.collectAudio && pause > 0)
            captured.push(
              ctx.createBuffer(
                format.channels,
                Math.max(1, Math.round(pause * rate * format.sampleRate)),
                format.sampleRate,
              ),
            );
        }
        groupChunks++;
        groupDuration += buffer.duration;
        if (options.collectAudio) captured.push(buffer);
        chunks++;
        pending.push(buffer);
        pendingSeconds += buffer.duration / rate;
        // Once playback has started, feed the queue continuously like the
        // native TUI. Even a near-deadline arrival used to restart buffering,
        // holding several patches and turning small jitter into long pauses.
        if (!buffering || pendingSeconds >= bufferSeconds) flushPending();
      }
      flushPending(); // Drain short utterances and the last partial reserve.
      if (!groupChunks)
        throw new Error(
          "The streaming model produced no audio for a text group.",
        );
      if (groupRtf === null) allRtf = false;
      else {
        weightedRtf += groupRtf * groupDuration;
        rtfDuration += groupDuration;
      }
    }
    rtf = allRtf && rtfDuration ? weightedRtf / rtfDuration : null;
    if (!chunks) throw new Error("The streaming model produced no audio.");
    const summary: SpeechStreamSummary = {
      chunks,
      textGroups: texts.length,
      rtf,
      wallMs: performance.now() - started,
      playbackMs: 0,
    };
    const pcmDrained = pcmPlayer?.finish();
    options.onSynthesized?.(summary);
    await Promise.all(pcmDrained ? [...playback,pcmDrained] : playback);
    if (signal.aborted)
      throw signal.reason || new DOMException("Cancelled", "AbortError");
    summary.playbackMs = performance.now() - firstAudio;
    if (options.collectAudio && format) {
      const buffer = ctx.createBuffer(
        format.channels,
        captured.reduce((n, b) => n + b.length, 0),
        format.sampleRate,
      );
      let offset = 0;
      for (const part of captured) {
        for (let channel = 0; channel < format.channels; channel++)
          buffer.copyToChannel(part.getChannelData(channel), channel, offset);
        offset += part.length;
      }
      summary.audio = encodePcm16Wav(buffer);
    }
    return summary;
  } finally {
    signal.removeEventListener("abort", stop);
    stop();
  }
}
