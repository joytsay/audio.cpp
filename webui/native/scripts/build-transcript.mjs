import { build } from 'esbuild';
// Share the UI's transcription rules and scenario prompts with the SIP bridge.
await build({
  stdin: {
    contents: [
      "export * from './src/lib/transcript.ts';",
      "export { correctAsrTranscript, DEFAULT_ASR_POSTPROCESS_MODEL } from './src/lib/asr-postprocess.ts';",
    ].join("\n"),
    resolveDir: process.cwd(),
  },
  outfile: 'dist/transcript.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  minify: true,
});
