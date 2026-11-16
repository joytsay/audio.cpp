import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {buildSync} from 'esbuild';
const lib=new URL('../src/lib/',import.meta.url),specDir=new URL('../../../model_specs/',import.meta.url);
const specs=Object.fromEntries(readdirSync(specDir).filter(f=>f.endsWith('.json')).map(f=>[f,JSON.parse(readFileSync(new URL(f,specDir)))]));
const source=readFileSync(new URL('catalog.ts',lib),'utf8').replace(/import\.meta\.glob\([\s\S]*?\}\)/,JSON.stringify(specs));
const bundle=buildSync({stdin:{contents:source,resolveDir:lib.pathname,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const {catalog,modelModes,modelCapabilities,parameterCatalog}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const entry=catalog.find(e=>e.family==='bluemagpie');assert.ok(entry);
assert.equal(entry.install_packages.length,5);assert.equal(entry.download_id,'bluemagpie_1b_q8_0');
assert.deepEqual(new Set(entry.install_packages.map(p=>p.precision)),new Set(['q8_0','q4_k_m','q5_k_m','q6_k','f16']));
assert.deepEqual(modelModes.bluemagpie,['offline','streaming']);assert.ok(modelCapabilities.bluemagpie.includes('speaker_reference'));
assert.ok(parameterCatalog.bluemagpie.some(p=>p.name==='stream_chunk_ms'));
for(const p of specs['bluemagpie.json'].packages){assert.equal(p.files.length,3);assert.match(p.files[0],/^BlueMagpie-Barbet-/);assert.equal(p.files[1],'BlueMagpie-AudioVAE-q8_0.gguf');assert.equal(p.files[2],'embedding_model.ckpt');}
console.log('PASS BlueMagpie catalog, all five paired download packages, clone/stream capabilities and parameters');
