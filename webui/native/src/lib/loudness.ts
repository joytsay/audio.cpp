// Speech loudness: every TTS voice plays at the same level, then the demo's
// volume (1–10, 5 = normalized) scales it. A quiet cloned voice is raised to
// the same level as a loud one instead of each playing at its own level.

export const DEFAULT_TTS_VOLUME = 5;
// Target RMS of active speech (about -20 dBFS).
const TARGET_RMS = 0.1;
// Frames quieter than this are pauses and do not count towards loudness.
const SPEECH_GATE = 0.004;
const MIN_GAIN = 0.25, MAX_GAIN = 12;

export const volumeGain = (volume: number) =>
  (Number.isFinite(volume) ? Math.min(10, Math.max(1, volume)) : DEFAULT_TTS_VOLUME) / DEFAULT_TTS_VOLUME;

// Gain that brings the active speech in these channels to the target RMS.
export function speechGain(channels: Float32Array[], frameSize = 1024): number {
  let sum = 0, count = 0;
  const length = channels[0]?.length ?? 0;
  for (let start = 0; start < length; start += frameSize) {
    let frame = 0, n = 0;
    for (const data of channels)
      for (let i = start; i < Math.min(length, start + frameSize); i++) { frame += data[i] * data[i]; n++; }
    if (n && Math.sqrt(frame / n) > SPEECH_GATE) { sum += frame; count += n; }
  }
  if (!count) return 1;
  return Math.min(MAX_GAIN, Math.max(MIN_GAIN, TARGET_RMS / Math.sqrt(sum / count)));
}

// Soft limiter: unchanged below 0.8, approaching ±1 smoothly above it.
const limit = (x: number) => {
  const a = Math.abs(x);
  return a <= 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2));
};

// Normalizes a decoded clip in place and applies the volume.
export function normalizeBuffer(buffer: AudioBuffer, volume = DEFAULT_TTS_VOLUME): AudioBuffer {
  const channels = Array.from({length: buffer.numberOfChannels}, (_, channel) => buffer.getChannelData(channel));
  const gain = speechGain(channels) * volumeGain(volume);
  for (const data of channels) for (let i = 0; i < data.length; i++) data[i] = limit(data[i] * gain);
  return buffer;
}

// A limiter for live playback, so a raised voice never clips.
export function createLimiter(ctx: BaseAudioContext): DynamicsCompressorNode {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 3;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  return limiter;
}

// Streamed speech arrives in pieces, so its level is measured as it plays:
// input → gain → limiter → output, with the gain following the running
// loudness of the speech so far. A voice's last gain starts its next stream.
const streamGains = new Map<string, number>();
export function createStreamLeveler(ctx: AudioContext, output: AudioNode, voiceKey: string, volume: number) {
  const input = ctx.createGain();
  const meter = ctx.createAnalyser();
  meter.fftSize = 2048;
  const gain = ctx.createGain();
  const limiter = createLimiter(ctx);
  input.connect(meter);
  input.connect(gain);
  gain.connect(limiter);
  limiter.connect(output);
  const scale = volumeGain(volume);
  let level = streamGains.get(voiceKey) ?? 1;
  gain.gain.value = level * scale;
  let energy = 0, frames = 0;
  const samples = new Float32Array(meter.fftSize);
  const timer = setInterval(() => {
    meter.getFloatTimeDomainData(samples);
    let frame = 0;
    for (const sample of samples) frame += sample * sample;
    if (Math.sqrt(frame / samples.length) <= SPEECH_GATE) return;
    energy += frame;
    frames += samples.length;
    level = Math.min(MAX_GAIN, Math.max(MIN_GAIN, TARGET_RMS / Math.sqrt(energy / frames)));
    gain.gain.setTargetAtTime(level * scale, ctx.currentTime, 0.25);
  }, 100);
  return {
    input,
    stop() {
      clearInterval(timer);
      if (frames) streamGains.set(voiceKey, level);
      input.disconnect();
      gain.disconnect();
      limiter.disconnect();
    },
  };
}
