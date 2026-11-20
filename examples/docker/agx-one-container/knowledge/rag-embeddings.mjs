import {createHash} from 'node:crypto';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid = hex => [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20,32)].join('-');
const markers = /<__media__>|<\|(?:im_start|im_end|endoftext|vision_start|vision_end)\|>/g;
const fail = (message,status=400) => Object.assign(Error(message),{status});

function prompt(text, image, query) {
  const instruction = query ? 'Find document passages, tables and figures that answer this question.' : "Represent the user's input.";
  const prefix = `<|im_start|>system\n${instruction}<|im_end|>\n<|im_start|>user\n`;
  const suffix = `${text.replace(markers,'')}<|im_end|>\n<|im_start|>assistant\n`;
  if (!image) return prefix + suffix;
  // llama.cpp inserts its own media marker when it parses the content parts.
  return {content:[
    {type:'text',text:prefix},
    {type:'image_url',image_url:{url:image}},
    {type:'text',text:suffix},
  ]};
}

export function createRagBridge({
  workflowUrl=process.env.IVR_RAG_URL||'http://n8n:5678/webhook/ivr-document-rag',
  embeddingModel=process.env.IVR_RAG_EMBED_MODEL||'gorse-io/Qwen3-VL-Embedding-2B-GGUF:Q4_K_M',
  embeddingDimensions=Number(process.env.IVR_RAG_EMBED_DIMENSIONS||2048),
  fetchImpl=fetch,
}={}) {
  // Qdrant retains vectors and metadata. n8n fetches original content only
  // for uncached embeddings and selected evidence during an active request.
  const active = new Map();
  if(!Number.isInteger(embeddingDimensions)||embeddingDimensions<1||embeddingDimensions>16384)
    throw fail('Invalid IVR_RAG_EMBED_DIMENSIONS');
  const collection=`ivr_documents_${hash(['qwen-vl-v1',embeddingModel,embeddingDimensions]).slice(0,16)}`;
  function resolve(scope,ids,limit) {
    if(!/^[a-f0-9]{64}$/.test(scope??'')||!Array.isArray(ids)||!ids.length||ids.length>limit)
      throw fail('Invalid RAG evidence request');
    const snapshot=active.get(scope);
    if(!snapshot)throw fail('RAG document snapshot expired',404);
    return ids.map(id=>{
      const item=snapshot.documents.get(id);
      if(!item)throw fail('Document is outside the current RAG scope',404);
      return item;
    });
  }
  return {
    async run({items,query='',previous='',language='zh',index=false}) {
      if(items.length>2200)throw fail('RAG corpus exceeds 2,200 items',413);
      const documents=new Map(items.map(item=>[uuid(hash(item)),item]));
      const scope=hash([...documents.keys()].sort());
      const snapshot=active.get(scope)??{documents,users:0};
      active.set(scope,snapshot);
      snapshot.users++;
      try{
        const response=await fetchImpl(workflowUrl,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            scope,collection,dimensions:embeddingDimensions,query,previous,language,index,
            query_prompt:query?prompt(previous?`Previous question: ${previous}\nQuestion: ${query}`:query,'',true):'',
            documents:[...documents].map(([id,{kind}])=>({id,kind})),
          }),
          signal:AbortSignal.timeout(240000),
        });
        if(!response.ok)throw fail(`RAG workflow returned HTTP ${response.status}`,502);
        return await response.json();
      }finally{
        if(--snapshot.users===0)active.delete(scope);
      }
    },
    evidence({scope,ids}={}) {
      return {items:resolve(scope,ids,5)};
    },
    embeddingInputs({scope,ids}={}) {
      const items=resolve(scope,ids,8);
      if(items.length>1&&items.some(item=>item.image))throw fail('Use one image per embedding batch');
      return {
        ids,content:items.map(item=>prompt(item.text??'',item.image,false)),
        payloads:items.map(({source,locator,kind})=>({source,locator,kind})),
      };
    },
  };
}
