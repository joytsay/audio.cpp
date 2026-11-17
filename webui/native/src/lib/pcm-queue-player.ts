// One render-thread PCM queue for native-rate streamed speech. Sources do not
// connect/disconnect at every model patch, and the UI thread does not clock audio.
export const pcmQueueProcessor = `
class SpeechPcmQueue extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.queue = []; this.head = 0; this.offset = 0;
    this.ended = false; this.started = false; this.stopped = false; this.starved = false;
    this.lead = Math.round((options.processorOptions.leadInSeconds || 0) * sampleRate);
    this.port.onmessage = ({data}) => {
      if (data.type === 'audio') this.queue.push(data.samples);
      else if (data.type === 'end') this.ended = true;
      else if (data.type === 'stop') this.stopped = true;
    };
  }
  underrun() {
    if (this.started && !this.ended && !this.starved) {
      this.starved = true; this.port.postMessage({type:'underrun'});
    }
  }
  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output?.length || this.stopped) return false;
    for (const channel of output) channel.fill(0);
    if (this.head >= this.queue.length) {
      if (this.ended) { this.port.postMessage({type:'done'}); return false; }
      this.underrun(); return true;
    }
    for (let frame = 0; frame < output[0].length; frame++) {
      if (this.lead > 0) { this.lead--; continue; }
      if (this.head >= this.queue.length) { this.underrun(); break; }
      this.starved = false;
      if (!this.started) { this.started = true; this.port.postMessage({type:'started'}); }
      const chunk = this.queue[this.head];
      for (let channel = 0; channel < output.length; channel++)
        output[channel][frame] = chunk[channel][this.offset];
      if (++this.offset === chunk[0].length) {
        this.queue[this.head++] = null; this.offset = 0;
        if (this.head === this.queue.length) { this.queue = []; this.head = 0; }
      }
    }
    if (this.ended && this.head >= this.queue.length) {
      this.port.postMessage({type:'done'}); return false;
    }
    return true;
  }
}
registerProcessor('speech-pcm-queue', SpeechPcmQueue);
`;

const modules = new WeakMap<AudioContext, Promise<void>>();

export class PcmQueuePlayer {
  private node: AudioWorkletNode;
  private error: Error | undefined;
  private stopped = false;
  private resolve!: () => void;
  private reject!: (error: Error) => void;
  private done: Promise<void>;

  static async create(
    context: AudioContext,
    channels: number,
    destination: AudioNode,
    leadInSeconds: number,
    onStarted: () => void,
    onUnderrun?: () => void,
  ): Promise<PcmQueuePlayer | undefined> {
    if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined') return;
    let module = modules.get(context);
    if (!module) {
      const url = URL.createObjectURL(new Blob([pcmQueueProcessor], {type:'text/javascript'}));
      module = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
      modules.set(context, module);
    }
    try { await module; }
    catch { return; } // Existing scheduling remains available on unsupported origins.
    return new PcmQueuePlayer(context, channels, destination, leadInSeconds, onStarted, onUnderrun);
  }

  private constructor(context: AudioContext, channels: number, destination: AudioNode, leadInSeconds: number, onStarted: () => void, onUnderrun?: () => void) {
    this.done = new Promise<void>((resolve,reject) => { this.resolve=resolve; this.reject=reject; });
    void this.done.catch(() => undefined);
    this.node = new AudioWorkletNode(context, 'speech-pcm-queue', {
      numberOfInputs:0, numberOfOutputs:1, outputChannelCount:[channels],
      processorOptions:{leadInSeconds},
    });
    this.node.port.onmessage = ({data}) => {
      if (data.type === 'started') onStarted();
      if (data.type === 'done') this.resolve();
      if (data.type === 'underrun') onUnderrun?.();
    };
    this.node.onprocessorerror = () => {
      this.error = new Error('Streaming PCM playback failed.');
      this.reject(this.error);
    };
    this.node.connect(destination);
  }

  push(buffer: AudioBuffer) {
    if (this.error) throw this.error;
    const samples = Array.from({length:buffer.numberOfChannels}, (_,channel) => buffer.getChannelData(channel).slice());
    this.node.port.postMessage({type:'audio', samples}, samples.map(channel => channel.buffer));
  }

  pause(seconds: number, sampleRate: number, channels: number) {
    const samples = Array.from({length:channels}, () => new Float32Array(Math.round(seconds*sampleRate)));
    if (samples[0].length) this.node.port.postMessage({type:'audio',samples},samples.map(channel=>channel.buffer));
  }

  finish(): Promise<void> {
    this.node.port.postMessage({type:'end'});
    return this.done;
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.node.port.postMessage({type:'stop'});
    this.node.disconnect();
    this.node.port.close();
    this.resolve();
  }
}
