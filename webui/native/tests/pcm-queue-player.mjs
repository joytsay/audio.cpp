import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
const compiled=buildSync({entryPoints:[new URL('../src/lib/pcm-queue-player.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false});
const {pcmQueueProcessor,PcmQueuePlayer}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
function renderer(leadInSeconds=0){
 let Processor;const events=[];
 vm.runInNewContext(pcmQueueProcessor,{sampleRate:16000,AudioWorkletProcessor:class{constructor(){this.port={postMessage:event=>events.push(event)};}},registerProcessor:(_name,type)=>{Processor=type;}});
 const processor=new Processor({processorOptions:{leadInSeconds}});
 return {processor,events,send:data=>processor.port.onmessage({data}),render:()=>{const output=[new Float32Array(128),new Float32Array(128)];const active=processor.process([], [output]);return {output,active};}};
}
const queue=renderer(),left=Float32Array.from({length:270},(_,i)=>(i+1)/1000),right=left.map(value=>-value);
let offset=0;
for(const length of [1,17,127,13,112]){queue.send({type:'audio',samples:[left.slice(offset,offset+length),right.slice(offset,offset+length)]});offset+=length;}
queue.send({type:'end'});const rendered=[[],[]];
for(let i=0;i<3;i++){const {output,active}=queue.render();for(let channel=0;channel<2;channel++)rendered[channel].push(...output[channel]);assert.equal(active,i<2);}
assert.deepEqual(rendered[0].slice(0,270),[...left]);assert.deepEqual(rendered[1].slice(0,270),[...right]);assert.ok(rendered[0].slice(270).every(value=>value===0));
assert.deepEqual(queue.events.map(event=>event.type),['started','done']);
const delayed=renderer(.01);delayed.send({type:'audio',samples:[left,right]});
assert.ok(delayed.render().output[0].every(value=>value===0));assert.equal(delayed.events.length,0);
const second=delayed.render().output[0];assert.ok(second.slice(0,32).every(value=>value===0));assert.equal(second[32],left[0]);
const jitter=renderer();jitter.send({type:'audio',samples:[left.slice(0,2),right.slice(0,2)]});
assert.equal(jitter.render().output[0][0],left[0]);jitter.render();
assert.equal(jitter.events.filter(event=>event.type==='underrun').length,1,'one event per real starvation episode');
jitter.send({type:'audio',samples:[left.slice(2,4),right.slice(2,4)]});jitter.send({type:'end'});
assert.equal(jitter.render().output[0][0],left[2],'late data resumes without another startup buffer');
const cancelled=renderer();cancelled.send({type:'audio',samples:[left,right]});cancelled.send({type:'stop'});assert.equal(cancelled.render().active,false);
assert.equal(await PcmQueuePlayer.create({},1,{},0,()=>{}),undefined,'unsupported origins retain existing playback');
console.log('PASS continuous render-thread PCM: stereo and tiny chunk joins, startup lead, final drain, underrun diagnostics, immediate recovery, cancellation and unsupported-origin fallback');
