import { encodePcm16Wav } from "./audio";
import { reportedRtf } from "./response-timing";

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

export interface SpeechStreamSummary {
  chunks: number;
  rtf: number | null;
  wallMs: number;
  playbackMs: number;
  audio?: Blob;
}

// Schedule each decoded chunk immediately, while reading/generating the next.
// The shared audio clock keeps chunks ordered without overlapping playback.
export async function playSpeechStream(
  ctx: AudioContext,
  body: Record<string, unknown>,
  signal: AbortSignal,
  options: {
    destination?: AudioNode;
    leadInSeconds?: number;
    collectAudio?: boolean;
    onFirstAudio?: (wallMs: number) => void;
    onSynthesized?: (summary: SpeechStreamSummary) => void;
  } = {},
): Promise<SpeechStreamSummary> {
  const started = performance.now();
  let nextStart = 0,
    firstAudio = 0,
    chunks = 0,
    rtf: number | null = null;
  let format: { sampleRate: number; channels: number } | undefined;
  const sources = new Map<AudioBufferSourceNode, () => void>();
  const playback: Promise<void>[] = [],
    captured: AudioBuffer[] = [];
  const stop = () => {
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
    for await (const event of speechStreamEvents(body, signal)) {
      if (signal.aborted)
        throw signal.reason || new DOMException("Cancelled", "AbortError");
      if (event.type === "speech.audio.done") {
        rtf = reportedRtf(event);
        continue;
      }
      const decoded = decodeSpeechChunk(event);
      if (
        format &&
        (format.sampleRate !== decoded.sampleRate ||
          format.channels !== decoded.samples.length)
      )
        throw new Error("Speech audio format changed within a stream.");
      format = {
        sampleRate: decoded.sampleRate,
        channels: decoded.samples.length,
      };
      const buffer = ctx.createBuffer(
        decoded.samples.length,
        decoded.frames,
        decoded.sampleRate,
      );
      decoded.samples.forEach((samples, channel) =>
        buffer.getChannelData(channel).set(samples),
      );
      if (options.collectAudio) captured.push(buffer);
      if (!chunks) {
        firstAudio = performance.now();
        nextStart = ctx.currentTime + (options.leadInSeconds ?? 0.06);
        options.onFirstAudio?.(firstAudio - started);
      }
      chunks++;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
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
      const when = Math.max(nextStart, ctx.currentTime + 0.015);
      source.start(when);
      nextStart = when + buffer.duration;
    }
    if (!chunks) throw new Error("The streaming model produced no audio.");
    const summary: SpeechStreamSummary = {
      chunks,
      rtf,
      wallMs: performance.now() - started,
      playbackMs: 0,
    };
    options.onSynthesized?.(summary);
    await Promise.all(playback);
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
