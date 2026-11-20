import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

const binary = process.argv[2];
if(!binary)throw Error('Pass the path to the C++ ivr-rag executable');
const cache = await mkdtemp(path.join(os.tmpdir(),'ivr-rag-test-'));
let newEmbeddings = 0;
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrJ0AAAAASUVORK5CYII=';
const fake = createServer(async (request,response)=>{
  let raw='';
  for await(const chunk of request)raw+=chunk;
  const input=JSON.parse(raw);
  const respond=data=>response.end(JSON.stringify(data));
  if(request.url==='/embedding'){
    const result=input.content.map((prompt,index)=>{
      if(typeof prompt==='object'){
        newEmbeddings++;
        assert.equal(prompt.multimodal_data[0],image.split(',')[1]);
        assert.match(prompt.prompt_string,/<__media__>/);
        return {index,embedding:[[0.99,0.1]]};
      }
      const query=prompt.includes('Find document passages');
      if(!query)newEmbeddings++;
      return {index,embedding:[query?[1,0]:[0,1]]};
    });
    respond(result.reverse());
  }else{
    assert.equal(request.url,'/v1/chat/completions');
    const user=input.messages[1].content;
    assert.equal(user.find(item=>item.type==='image_url').image_url.url,image);
    assert.ok(!JSON.stringify(user).includes('unselected template'));
    assert.match(user.at(-1).text,/A01/);
    respond({choices:[{message:{content:'圖表中的 A01 庫存是 2 個。'}}]});
  }
}).listen(0,'127.0.0.1');
await once(fake,'listening');
const placeholder=createServer().listen(0,'127.0.0.1');
await once(placeholder,'listening');
const port=placeholder.address().port;
await new Promise(resolve=>placeholder.close(resolve));
const llama='http://127.0.0.1:'+fake.address().port;
const backend='http://127.0.0.1:'+port;
const worker=spawn(binary,{
  env:{...process.env,RAG_EMBED_URL:llama,RAG_VISION_URL:llama,RAG_PORT:String(port),RAG_HOST:'127.0.0.1',RAG_CACHE_DIR:cache},
  stdio:['ignore','inherit','pipe'],
});
let trace='';
worker.stderr.setEncoding('utf8').on('data',chunk=>{trace+=chunk;});
try{
  let ready=false;
  for(let i=0;i<100&&!ready;i++){
    ready=await fetch(backend+'/health').then(response=>response.ok,()=>false);
    if(!ready)await delay(30);
  }
  assert.ok(ready,'native worker failed to start');
  const items=[
    {source:'inventory.html',locator:'情境 4',kind:'image',image},
    ...Array.from({length:5},(_,i)=>({source:'inventory.html',locator:'情境 4',kind:'table',text:'table '+i})),
    {source:'inventory.html',locator:'情境 5',kind:'text',text:'unselected template'},
  ];
  const request=async (route,body)=>{
    const response=await fetch(backend+route,{method:'POST',body:JSON.stringify(body)});
    const result=await response.json();
    assert.ok(response.ok,JSON.stringify(result));
    return result;
  };
  assert.equal((await request('/index',{items})).indexed,items.length);
  const first=await request('/answer',{query:'A01 庫存？',items,language:'zh'});
  const second=await request('/answer',{query:'A01 庫存？',items,language:'zh'});
  assert.deepEqual(first,second);
  assert.equal(newEmbeddings,items.length,'repeat queries should reuse all document vectors');
  assert.equal(first.sources.length,5);
  assert.equal(first.sources[0].kind,'image');
  assert.equal(first.passages.length,4);
  assert.match(first.answer,/2 個/);
  for(let i=0;i<50&&trace.split('"vision_completed"').length<3;i++)await delay(10);
  const events=trace.split('\n').filter(line=>line.startsWith('[rag] ')).map(line=>JSON.parse(line.slice(6)));
  const indexed=events.find(event=>event.event==='index_completed');
  assert.equal(indexed.new_document_vectors,items.length);
  assert.equal(indexed.document_sample.kind,'text');
  assert.equal(indexed.document_sample.dimensions,2);
  assert.deepEqual(indexed.document_sample.first_eight,[0,1]);
  const cached=events.find(event=>event.event==='embeddings_ready');
  assert.equal(cached.cache_hits,items.length);
  assert.equal(cached.query_dimensions,2);
  const vision=events.find(event=>event.event==='vision_started');
  assert.equal(vision.request_id,cached.request_id);
  assert.equal(vision.sources[0].kind,'image');
  assert.equal(vision.images,1);
  assert.ok(events.some(event=>event.request_id===vision.request_id&&event.event==='vision_completed'));
  assert.ok(!trace.includes('A01')&&!trace.includes('unselected template'));
  console.log('PASS C++ image and text embeddings, persisted cache, top-five selection, and vision answer payload');
}finally{
  if(worker.exitCode===null){worker.kill();await once(worker,'exit');}
  await new Promise(resolve=>fake.close(resolve));
  await rm(cache,{recursive:true,force:true});
}
