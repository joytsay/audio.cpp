import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
const built = buildSync({entryPoints: [new URL('../src/lib/loudness.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', write: false});
const {speechGain, normalizeBuffer, volumeGain} = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const tone = (amplitude, seconds = 1, rate = 24000) => {
  const data = new Float32Array(seconds * rate);
  for (let i = 0; i < data.length; i++) data[i] = i < rate * 0.2 ? 0 : amplitude * Math.sin(i / 7);
  return data;
};
const rms = data => Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);
const buffer = data => ({numberOfChannels: 1, getChannelData: () => data});
// A quiet voice and a loud voice end up at the same speech level.
const quiet = normalizeBuffer(buffer(tone(0.02))).getChannelData(0), loud = normalizeBuffer(buffer(tone(0.3))).getChannelData(0);
const active = data => rms(data.subarray(24000 * 0.2));
assert.ok(Math.abs(active(quiet) - active(loud)) < 0.01, `${active(quiet)} vs ${active(loud)}`);
assert.ok(Math.abs(active(loud) - 0.1) < 0.01);
assert.equal(speechGain([new Float32Array(1000)]), 1, 'silence is left alone');
// Volume 1–10 scales the normalized level; nothing clips.
assert.equal(volumeGain(5), 1); assert.equal(volumeGain(10), 2); assert.equal(volumeGain(1), 0.2); assert.equal(volumeGain(99), 2);
const max = normalizeBuffer(buffer(tone(0.9)), 10).getChannelData(0);
assert.ok(Math.max(...max.map(Math.abs)) <= 1);
console.log('PASS loudness: voices normalized to one level, volume 1–10 scales it, limiter prevents clipping');
