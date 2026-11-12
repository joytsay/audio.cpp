import { build } from 'esbuild';
// Share the exact UI dictionaries and number rules with the native SIP bridge.
await build({ entryPoints: ['src/lib/transcript.ts'], outfile: 'dist/transcript.mjs', bundle: true, platform: 'node', format: 'esm', minify: true });
