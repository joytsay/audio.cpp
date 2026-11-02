import assert from 'node:assert/strict';
import { recognitionContext } from '../src/lib/asr-context.ts';

assert.equal(recognitionContext('X光機', 'nemotron_asr'), 'X光機\nX光机');
assert.equal(recognitionContext('X光机', 'nemotron_asr'), 'X光机\nX光機');
assert.equal(recognitionContext('Technical terms: X光機 T5', 'nemotron_asr'), 'X光機\nX光机\nT5');
assert.equal(recognitionContext('Jane Smith，X光機', 'nemotron_asr'), 'Jane Smith\nX光機\nX光机');
assert.equal(recognitionContext('X光機、T5；X光機', 'nemotron_asr'), 'X光機\nX光机\nT5');
assert.equal(recognitionContext('X光機', 'qwen3_asr'), 'X光機');
assert.equal(recognitionContext(' ', 'nemotron_asr'), ' ');
console.log('PASS: X光機 script variants, multiword phrases, Chinese delimiters, deduplication, other-family parity');
