import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {qaDocument} from './qa.mjs';

const maxBytes=10*1024*1024;
const extensions=new Set(['.pdf','.docx','.xlsx','.csv','.txt','.md']);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateScenarioUpload(input){
 if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.length>120)throw fail('A scenario name of 1–120 characters is required');
 if(!Array.isArray(input.files)||input.files.length<1||input.files.length>8)throw fail('Choose 1–8 documents');
 let total=0;
 const files=input.files.map(file=>{
  if(!file||typeof file.name!=='string'||!file.name.trim()||file.name.length>200||/[\\/\x00-\x1f]/.test(file.name)||!extensions.has(path.extname(file.name).toLowerCase()))throw fail('Supported files: PDF, DOCX, XLSX, CSV, TXT and Markdown');
  if(typeof file.data!=='string'||file.data.length>Math.ceil(maxBytes/3)*4)throw fail('Documents must total 10 MiB or less',413);
  const bytes=Buffer.from(file.data,'base64');
  if(!bytes.length||bytes.toString('base64')!==file.data)throw fail('Invalid or empty document data');
  total+=bytes.length;if(total>maxBytes)throw fail('Documents must total 10 MiB or less',413);
  return {name:file.name,bytes,sha256:hash(bytes),size:bytes.length,extension:path.extname(file.name).toLowerCase()};
 });
 return {name:input.name.trim(),files};
}

// Check ZIP expansion before handing DOCX/XLSX to their parsers.
export function validateOfficeArchive(bytes){
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0)throw fail('Invalid Office document');
 const entries=bytes.readUInt16LE(end+10);let at=bytes.readUInt32LE(end+16),expanded=0;
 if(entries>5000)throw fail('Office document contains too many entries');
 for(let i=0;i<entries;i++){
  if(at+46>bytes.length||bytes.readUInt32LE(at)!==0x02014b50)throw fail('Invalid Office archive directory');
  const size=bytes.readUInt32LE(at+24);expanded+=size;
  if(size===0xffffffff||expanded>25*1024*1024)throw fail('Office document expands beyond 25 MiB',413);
  if(bytes.readUInt16LE(at+8)&1)throw fail('Encrypted Office documents are not supported');
  const local=bytes.readUInt32LE(at+42),compressed=bytes.readUInt32LE(at+20),method=bytes.readUInt16LE(at+10);
  if(local+30>bytes.length||bytes.readUInt32LE(local)!==0x04034b50)throw fail('Invalid Office archive entry');
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
  if(start+compressed>bytes.length)throw fail('Invalid Office archive entry size');
  try{
   const data=bytes.subarray(start,start+compressed);
   const expanded=method===0?data:method===8?inflateRawSync(data,{maxOutputLength:Math.max(size,1)}):null;
   if(!expanded||expanded.length!==size)throw Error('size mismatch');
  }catch{throw fail('Invalid Office archive expansion');}

  at+=46+bytes.readUInt16LE(at+28)+bytes.readUInt16LE(at+30)+bytes.readUInt16LE(at+32);
 }
 const directoryEnd=bytes.readUInt32LE(end+16)+bytes.readUInt32LE(end+12);
 if(directoryEnd>end||at!==directoryEnd)throw fail('Invalid Office archive size');
}

export function scenarioQa(document,name){
 const source={...document,kind:document.kind||'uploaded_reference',scenario_name:name};
 const text=document.text.replace(/\r\n?/g,'\n').trim();
 const chunks=[];
 let question='',answer=[],role='';
 const flush=()=>{
  if(question&&answer.length){for(let offset=0;offset<answer.join('\n').length;offset+=1400)chunks.push(qaDocument(source,question,answer.join('\n').slice(offset,offset+1400)));}
 };
 for(const raw of text.split('\n')){
  const line=raw.trim();
  const q=line.match(/^(?:Q|問題|问|問|維修人員|客戶|使用者|YOU)[：:]\s*(.*)/i);
  const a=line.match(/^(?:A|回答|答案|答|AI|助理|GEOVISION)[：:]\s*(.*)/i);
  if(q){flush();question=q[1];answer=[];role='q';}
  else if(a){answer.push(a[1]);role='a';}
  else if(line&&role==='a')answer.push(line);
  else if(line&&role==='q')question+=' '+line;
 }
 flush();

 // Narrative text and spreadsheet rows retain every fact as answer excerpts.
 for(let offset=0;offset<text.length;offset+=1400){
  const answer=text.slice(offset,offset+1400).trim();if(!answer)continue;
  const topic=(document.topic||answer.split(/[\n。！？.!?]/)[0]||name).slice(0,100);
  chunks.push(qaDocument(source,`「${name}」中「${topic}」的內容是什麼？`,answer,{section:document.sheet||`第 ${Math.floor(offset/1400)+1} 段`}));
 }
 return chunks;
}

export function createScenarioStore({root=path.join(process.env.KNOWLEDGE_DATA_ROOT||'/data','scenarios'),extract}={}){
 let pending=Promise.resolve();
 async function manifests(){
  let entries;try{entries=await fs.readdir(root,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return [];throw e;}
  const items=[];
  for(const entry of entries.filter(e=>e.isDirectory()&&/^[a-f0-9]{24}$/.test(e.name))){
   try{const record=JSON.parse(await fs.readFile(path.join(root,entry.name,'scenario.json'),'utf8'));if(record.id!==entry.name||!Array.isArray(record.documents))throw Error('Invalid saved scenario');items.push(record);}
   catch(e){if(e.code!=='ENOENT')throw e;}
  }
  return items.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 }
 const metadata=({documents,...record})=>({...record,qaCount:documents.length});
 return {
  async list(){return (await manifests()).map(metadata);},
  async documents(){return (await manifests()).flatMap(record=>record.documents);},
  async add(input){
   const upload=validateScenarioUpload(input);
   const operation=async()=>{
    const id=hash(JSON.stringify([upload.name,upload.files.map(f=>[f.name,f.sha256]).sort()])).slice(0,24);
    const existing=await manifests();
    const duplicate=existing.find(r=>r.id===id);if(duplicate)return {scenario:metadata(duplicate),duplicate:true};
    if(existing.some(r=>r.name.toLocaleLowerCase()===upload.name.toLocaleLowerCase()))throw fail('That scenario name already exists; choose another name',409);
    if(existing.length>=100)throw fail('The knowledge store already contains 100 uploaded scenarios',409);
    await fs.mkdir(root,{recursive:true});
    const temp=await fs.mkdtemp(path.join(root,'.upload-'));
    try{
     const documents=[];let textLength=0;
     for(const file of upload.files){
      if(file.extension==='.docx'||file.extension==='.xlsx')validateOfficeArchive(file.bytes);
      const stored=file.sha256+file.extension,filename=path.join(temp,stored);await fs.writeFile(filename,file.bytes,{mode:0o600});
      let sources;try{sources=await extract(filename,file);}catch(error){throw fail(`Cannot read ${file.name}: ${error.message}`);}
      for(const source of sources){
       textLength+=source.text.length;if(textLength>250000)throw fail('Extracted scenario text exceeds 250,000 characters',413);
       documents.push(...scenarioQa({...source,source:file.name,sha256:file.sha256,scenario_id:id},upload.name));
      }
     }
     if(!documents.length)throw fail('No readable content was found in these files');
     const record={id,name:upload.name,createdAt:new Date().toISOString(),files:upload.files.map(({name,size,sha256})=>({name,size,sha256})),documents};
     await fs.writeFile(path.join(temp,'scenario.json'),JSON.stringify(record),{mode:0o600});
     await fs.rename(temp,path.join(root,id));return {scenario:metadata(record),duplicate:false,qa_preview:documents.slice(0,3).map(({question,answer,source})=>({question,answer,source}))};
    }finally{await fs.rm(temp,{recursive:true,force:true});}
   };
   const result=pending.then(operation);pending=result.catch(()=>{});return result;
  },
 };
}
