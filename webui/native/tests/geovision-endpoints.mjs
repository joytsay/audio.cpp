import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
const bundle = buildSync({entryPoints:[new URL('../src/lib/openai.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false});
const {siblingWorkerEndpoint} = await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
for (const [base, expected] of [
  ['http://127.0.0.1:8081/','http://127.0.0.1:8083/llm/v1'],
  ['https://127.0.0.1:8082/','https://127.0.0.1:8082/llm/v1'],
  ['http://127.0.0.1:8083/','http://127.0.0.1:8083/llm/v1'],
  ['https://127.0.0.1:8084/','https://127.0.0.1:8084/llm/v1'],
  ['https://ivr.example:9443/','https://ivr.example:9443/llm/v1'],
]) {
  globalThis.document = {baseURI:base};
  assert.equal(siblingWorkerEndpoint(8082),expected);
}
delete globalThis.document;
console.log('PASS demo HTTP LLM access and full interface HTTP/HTTPS same-origin LLM endpoints');
