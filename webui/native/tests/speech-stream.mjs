import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../package.json', import.meta.url));
const { buildSync } = require('esbuild');
const compiled = buildSync({ entryPoints: [fileURLToPath(new URL('../src/lib/speech-stream.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false });
const { decodeSpeechChunk, speechStreamEvents, playSpeechStream } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
globalThis.document = { baseURI: 'https://example.test/' };
const originalFetch = globalThis.fetch;
const pcm = Buffer.alloc(8); [32767, -32768, 16384, -16384].forEach((n, i) => pcm.writeInt16LE(n, i * 2));
const delta = { type: 'speech.audio.delta', audio: pcm.toString('base64'), sample_rate: 24000, channels: 2, format: 'pcm_s16le' };
const done = { type: 'speech.audio.done', timing: { rtf: 0.4 } };
const wire = event => `data: ${JSON.stringify(event)}\r\n\r\n`;
const response = (events, fragment = 5) => {
 const bytes = new TextEncoder().encode(events.map(wire).join('') + 'data: [DONE]\r\n\r\n');
 return new Response(new ReadableStream({ start(controller) { for (let i=0;i<bytes.length;i+=fragment) controller.enqueue(bytes.slice(i,i+fragment)); controller.close(); } }), {headers:{'Content-Type':'text/event-stream'}});
};
class FakeBuffer {
 constructor(channels, length, sampleRate) { this.numberOfChannels=channels;this.length=length;this.sampleRate=sampleRate;this.duration=length/sampleRate;this.samples=Array.from({length:channels},()=>new Float32Array(length)); }
 getChannelData(c) {return this.samples[c];}
 copyToChannel(samples,c,offset=0) {this.samples[c].set(samples,offset);}
}
class FakeContext {
 constructor() {this.origin=performance.now();this.starts=[];this.stops=0;this.destination={};}
 get currentTime() {return (performance.now()-this.origin)/1000;}
 async resume() {}
 createBuffer(c,n,sr) {return new FakeBuffer(c,n,sr);}
 createBufferSource() {
  const ctx=this; let timer;
  return {buffer:null,playbackRate:{value:1},onended:null,connect(){},disconnect(){},start(when){ctx.starts.push({when,duration:this.buffer.duration});timer=setTimeout(()=>this.onended?.(),Math.max(0,(when+this.buffer.duration/this.playbackRate.value-ctx.currentTime)*1000));},stop(){clearTimeout(timer);ctx.stops++;this.onended?.();}};
 }
}
try {
 const decoded=decodeSpeechChunk(delta);
 assert.equal(decoded.frames,2);assert.equal(decoded.samples[0][1],0.5);assert.equal(decoded.samples[1][0],-1);
 assert.throws(()=>decodeSpeechChunk({...delta,sample_rate:undefined}),/metadata/);
 assert.throws(()=>decodeSpeechChunk({...delta,audio:Buffer.alloc(3).toString('base64')}),/length/);
 let request;
 globalThis.fetch=async(url,init)=>{request=JSON.parse(init.body);return response([delta,done],1);};
 const events=[];for await(const event of speechStreamEvents({model:'tts',input:'你好'},new AbortController().signal))events.push(event);
 assert.equal(events.length,2);assert.equal(request.stream,true);assert.equal(request.response_format,'pcm');
 let sendRest, synthesized=false, firstAudio=false;
 globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(wire(delta)));sendRest=()=>{controller.enqueue(new TextEncoder().encode(wire(delta)+wire(done)));controller.close();};}}));
 const ctx=new FakeContext();
 const playing=playSpeechStream(ctx,{model:'tts',input:'Test speech'},new AbortController().signal,{collectAudio:true,onFirstAudio(){firstAudio=true;},onSynthesized(){synthesized=true;}});
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(firstAudio,true);assert.equal(ctx.starts.length,1);assert.equal(synthesized,false,'playback must begin before synthesis is complete');
 sendRest();const summary=await playing;
 assert.equal(summary.chunks,2);assert.equal(summary.rtf,0.4);assert.equal(summary.audio.size,44+pcm.length*2);
 assert.ok(Math.abs(ctx.starts[1].when-(ctx.starts[0].when+ctx.starts[0].duration))<0.000001,'chunks must be contiguous');
 globalThis.fetch=async()=>response([delta]);
 await assert.rejects(playSpeechStream(new FakeContext(),{input:"Test speech"},new AbortController().signal),/closed before completion/);
 globalThis.fetch=async()=>response([{type:'error',error:{message:'串流失敗'}}],1);
 await assert.rejects(playSpeechStream(new FakeContext(),{input:"Test speech"},new AbortController().signal),/串流失敗/);
 const large={...delta,audio:Buffer.alloc(24000*2).toString('base64'),channels:1};
 globalThis.fetch=async()=>response([large,done],1000000);
 const aborter=new AbortController(), cancelledCtx=new FakeContext();
 const cancelled=playSpeechStream(cancelledCtx,{input:"Test speech"},aborter.signal);
 setTimeout(()=>aborter.abort(),10);
 await assert.rejects(cancelled,{name:'AbortError'});assert.equal(cancelledCtx.stops,1,'abort stops scheduled audio');
 const groupRequests=[];
 globalThis.fetch=async(url,init)=>{groupRequests.push(JSON.parse(init.body));return response([delta,done]);};
 const groupCtx=new FakeContext();
 const groupSummary=await playSpeechStream(groupCtx,{input:'第一行\n第二行\n第三行\n第四行\n第五行'},new AbortController().signal,{playbackRate:0.9,collectAudio:true});
 assert.deepEqual(groupRequests.map(r=>r.input),['第一行\n第二行','第三行\n第四行','第五行']);
 assert.ok(groupRequests.every(r=>r.stream===true && r.response_format==='pcm'));
 assert.equal(groupSummary.textGroups,3);assert.equal(groupSummary.rtf,0.4);
 assert.ok(groupCtx.starts[1].when >= groupCtx.starts[0].when+(2/24000)/0.9+0.219);
 await assert.rejects(playSpeechStream(new FakeContext(),{input:'test'},new AbortController().signal,{playbackRate:0.2}),/Playback speed/);
 const textCompiled=buildSync({entryPoints:[fileURLToPath(new URL('../src/lib/speech-text.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
 const {splitSpeechText}=await import(`data:text/javascript;base64,${Buffer.from(textCompiled.outputFiles[0].text).toString('base64')}`);
 const longText='備註：SN14778725，製造日期2010年12月3日，電容值6460MF。'.repeat(10);
 const groups=splitSpeechText(longText);
 assert.ok(groups.length>1);assert.ok(groups.every(g=>[...g].length<=120 && g.split('\n').length<=2));
 assert.equal(groups.join('').replace(/\s/g,''),longText.replace(/\s/g,''));
 assert.equal(groups.filter(g=>g.includes('SN14778725')).length>0,true);
 console.log('PASS two-line length-limited groups, native PCM streaming, playback speed, pauses and invalid speed');
 console.log('PASS PCM metadata/stereo decoding, fragmented SSE, playback before completion, contiguous scheduling, replay WAV, errors, truncation and cancellation');
} finally {globalThis.fetch=originalFetch;delete globalThis.document;}
