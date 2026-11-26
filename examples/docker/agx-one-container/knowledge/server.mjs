import {createScenarioStore,validateOfficeArchive} from './scenarios.mjs';
import {createSopDrafts,markdownText} from './sop-drafts.mjs';
import {htmlScenarioText,uniqueHeaders} from './scenario-files.mjs';
import {readScenarioImage} from './scenario-image.mjs';
import {createServer} from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import os from 'node:os';
import {execFile as execFileCallback} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import {createRagBridge} from './rag-embeddings.mjs';
import {createSops} from './sops.mjs';
import {createIvrEngine} from './ivr-engine.mjs';
import {extractRagAssets,imageType,ragItems} from './rag-assets.mjs';
const execFile=promisify(execFileCallback);
function cellText(cell){const v=cell.result??cell.value;if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='number'&&/^0+$/.test(cell.numFmt||''))return String(v).padStart(cell.numFmt.length,'0');return cell.text?.trim()||'';}
function worksheetRows(sheet){
  let headers;const rows=[];sheet.eachRow((row,rowNumber)=>{
    if(!headers){headers=uniqueHeaders(Array.from({length:sheet.columnCount},(_,i)=>cellText(row.getCell(i+1))));return;}
    const fields=Object.fromEntries(headers.map((name,i)=>[name,cellText(row.getCell(i+1))]));
    if(Object.values(fields).some(Boolean))rows.push({row:rowNumber,fields});
  });return {name:sheet.name,headers:headers||[],rows};
}
export async function readWorkbook(file){
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);return workbook.worksheets.map(worksheetRows);
}
export async function readCsv(file){
  const text=new TextDecoder('utf-8',{fatal:true}).decode(await fs.readFile(file));
  const workbook=new ExcelJS.Workbook();
  const sheet=await workbook.csv.read(Readable.from([text]),{map:value=>value,parserOptions:{ignoreEmpty:true}});
  return worksheetRows(sheet);
}
function referenceRow(row){
  const entries=Object.entries(row.fields).filter(([,value])=>value);
  const question=entries.find(([key])=>/^(q|question|問題)$/i.test(key));
  const answer=entries.find(([key])=>/^(a|answer|答案|回答)$/i.test(key));
  if(question&&answer){
    const extra=entries.filter(entry=>entry!==question&&entry!==answer).map(([key,value])=>`${key}：${value}`).join('；');
    return `Q: ${question[1]}\nA: ${answer[1]}${extra?'\n'+extra:''}`;
  }
  return entries.map(([key,value])=>`${key}：${value}`).join('；');
}
function wordText(html){
  return html.replace(/<\/(?:p|h[1-6]|li)>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi,entity=>{
      const value=entity.slice(1,-1);
      if(value[0]!=='#')return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[value]||entity;
      const code=value[1]==='x'?parseInt(value.slice(2),16):Number(value.slice(1));
      return code<=0x10ffff?String.fromCodePoint(code):entity;
    }).trim();
}
async function extractScenarioWord(file,ocrImage){
  const images=[];
  const result=await mammoth.convertToHtml({path:file},{
    convertImage:mammoth.images.imgElement(async image=>{
      if(/^image\/(png|jpeg)$/.test(image.contentType)){
        images.push(await image.readAsBuffer());
      }
      return {src:''};
    }),
  });
  const sources=[];
  function appendRows(rows,name,extraction){
    const headers=uniqueHeaders(Array.from({length:Math.max(...rows.map(row=>row.length))},(_,i)=>rows[0][i]));
    sources.push({text:'',headers,section:name,extraction});
    rows.slice(1).forEach((cells,i)=>{
      if(!cells.some(Boolean))return;
      const row={row:i+2,fields:Object.fromEntries(headers.map((header,index)=>[header,cells[index]||'']))};
      sources.push({...row,text:referenceRow(row),headers,section:name,extraction});
    });
  }
  let section=0;
  const body=result.value.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi,(_table,html)=>{
    const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map(([,row])=>[...row.matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)].flatMap(([,attributes,cell])=>{
        const span=Math.min(Number(attributes.match(/\bcolspan="(\d+)"/i)?.[1])||1,256);
        return [wordText(cell),...Array(span-1).fill('')];
      })).filter(row=>row.some(Boolean));
    if(rows.length)appendRows(rows,`表格 ${++section}`,'docx_table');
    return '';
  });
  sources.unshift({text:wordText(body),extraction:'docx'});
  for(const [i,bytes] of images.entries()){
    const image=`圖片 ${i+1}`;
    const {text,rows}=await ocrImage(bytes);
    if(rows?.length)appendRows(rows,image,'ocr');
    else if(text?.trim())sources.push({text,image,extraction:'ocr'});
  }
  return sources;
}
function spreadsheetSources(sheet,extraction){
  const group=extraction==='xlsx'?{sheet:sheet.name}:{};
  return [{...group,text:'',headers:sheet.headers,extraction},...sheet.rows.map(row=>({
    ...group,...row,headers:sheet.headers,text:referenceRow(row),topic:`第 ${row.row} 列`,extraction,
  }))];
}
export async function extractPdf(file,{languages=process.env.OCR_LANGUAGES||'chi_tra+eng',run=execFile}={}){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-knowledge-pdf-'));
  try{
    const output=path.join(dir,'text.txt');
    await run('pdftotext',['-layout',file,output],{timeout:60000,maxBuffer:4*1024*1024});
    const text=await fs.readFile(output,'utf8');
    if(text.trim().length>=20)return {text,extraction:'pdf_text'};
    const {stdout:info}=await run('pdfinfo',[file],{timeout:15000,maxBuffer:1024*1024});
    const pages=Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
    if(!Number.isInteger(pages)||pages<1||pages>20)throw new Error('PDF must contain 1–20 pages for local OCR');
    const chunks=[];
    for(let page=1;page<=pages;page++){
      const prefix=path.join(dir,`page-${page}`);
      await run('pdftoppm',['-f',String(page),'-l',String(page),'-singlefile','-r','300','-png',file,prefix],{timeout:90000,maxBuffer:1024*1024});
      const {stdout}=await run('tesseract',[prefix+'.png','stdout','-l',languages,'--psm','3'],{timeout:120000,maxBuffer:4*1024*1024});
      chunks.push(`【第 ${page} 頁；OCR 辨識，代碼及數值需核對原件】\n${stdout.trim()}`);
    }return {text:chunks.join('\n\n'),extraction:'ocr',pages,languages,notice:'OCR output is not authoritative; verify codes, quantities and dates against the PDF image.'};
  }finally{await fs.rm(dir,{recursive:true,force:true});}
}
// The OCR reader takes PNG and JPEG; a GIF's first frame is converted.
async function ocrAnyImage(bytes,ocrImage){
  if(imageType(bytes)!=='gif')return ocrImage(bytes);
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-knowledge-gif-'));
  try{
    await fs.writeFile(path.join(dir,'in.gif'),bytes);
    await execFile('convert',['-limit','memory','64MiB','-limit','disk','0','gif:'+path.join(dir,'in.gif')+'[0]','png:'+path.join(dir,'out.png')],{timeout:60000});
    return ocrImage(await fs.readFile(path.join(dir,'out.png')));
  }finally{await fs.rm(dir,{recursive:true,force:true});}
}
// A non-HTML document for an SOP draft: its text, tables and images.
async function readDraftDocument(upload,{pdf,ocrImage}){
  const base=path.parse(upload.name).name.trim();
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-knowledge-draft-'));
  try{
    const file=path.join(dir,'upload'+upload.extension);
    await fs.writeFile(file,upload.bytes);
    if(upload.extension==='.pdf')return {text:(await pdf(file)).text,tables:[],images:[]};
    if(upload.extension==='.md'||upload.extension==='.markdown')
      return {text:markdownText(new TextDecoder('utf-8',{fatal:true}).decode(upload.bytes)),tables:[],images:[]};
    if(upload.extension==='.csv'){const sheet=await readCsv(file);return {text:'',tables:[{name:base,headers:sheet.headers,rows:sheet.rows.map(row=>row.fields)}],images:[]};}
    validateOfficeArchive(upload.bytes);
    if(upload.extension==='.xlsx')return {text:'',images:[],tables:(await readWorkbook(file)).map(sheet=>({name:`${base}_${sheet.name}`,headers:sheet.headers,rows:sheet.rows.map(row=>row.fields)}))};
    // DOCX: body text and the OCR text of its images; tables (and tables read from images) become CSV files.
    const images=[];
    const sources=await extractScenarioWord(file,async bytes=>{images.push(bytes);return ocrImage(bytes).catch(()=>({}));});
    const tables=new Map();
    for(const source of sources){
      if(!source.headers)continue;
      if(!tables.has(source.section))tables.set(source.section,{name:`${base}_${source.section.replace(/\s+/g,'')}`,headers:source.headers,rows:[]});
      if(source.fields)tables.get(source.section).rows.push(source.fields);
    }
    return {
      text:sources.filter(source=>!source.headers).map(source=>source.image?`【${source.image}】\n${source.text}`:source.text).join('\n\n'),
      tables:[...tables.values()],
      images:images.map((bytes,index)=>({name:`${base}_圖片${index+1}.${imageType(bytes)==='jpeg'?'jpg':'png'}`,bytes})),
    };
  }finally{await fs.rm(dir,{recursive:true,force:true});}
}
export function createKnowledgeStore({pdf=extractPdf,ocrImage=readScenarioImage,scenarioRoot,ragUrl,fetchImpl=fetch}={}){
  const scenarioDir=scenarioRoot??path.join(process.env.KNOWLEDGE_DATA_ROOT||'/data','scenarios');
  const scenarios=createScenarioStore({root:scenarioDir,extract:async(file,upload)=>{
    if(upload.extension==='.pdf')return [{...await pdf(file)}];
    if(upload.fileMode&&upload.extension==='.docx')return extractScenarioWord(file,ocrImage);
    if(upload.fileMode&&upload.extension==='.xlsx')return (await readWorkbook(file)).flatMap(sheet=>spreadsheetSources(sheet,'xlsx'));
    if(upload.fileMode&&upload.extension==='.csv')return spreadsheetSources(await readCsv(file),'csv');
    if(upload.extension==='.docx'){const result=await mammoth.extractRawText({path:file});return [{text:result.value,extraction:'docx',kind:/情境\s*\d/.test(result.value)?'scenario_examples':'uploaded_reference'}];}
    if(upload.extension==='.csv'){const sheet=await readCsv(file);return sheet.rows.map(row=>({text:referenceRow(row),row:row.row,topic:`第 ${row.row} 列`,extraction:'csv'}));}
    if(upload.extension==='.xlsx')return (await readWorkbook(file)).flatMap(sheet=>sheet.rows.map(row=>({text:Object.entries(row.fields).filter(([,value])=>value).map(([key,value])=>`${key}：${value}`).join('；'),sheet:sheet.name,row:row.row,topic:`${sheet.name} 第 ${row.row} 列`,extraction:'xlsx'})));
    const bytes=await fs.readFile(file);
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    if(/\.html?$/.test(upload.extension))return [{text:htmlScenarioText(text),extraction:'html'}];
    return [{text,extraction:'text'}];
  }});
  const assetCache=new Map();
  const visualAssets=async(records,section)=>{
    const assets=[];
    for(const {files,attachments} of records){
      for(const file of files){
        let stat;
        try{stat=await fs.stat(file.path);}catch(error){if(error.code==='ENOENT')continue;throw error;}
        const key=JSON.stringify([file.path,stat.mtimeMs,stat.size,section,attachments.map(item=>[item.name,item.sha256])]);
        if(!assetCache.has(key)){
          if(assetCache.size>=8)assetCache.delete(assetCache.keys().next().value);
          assetCache.set(key,extractRagAssets(file,attachments,section).catch(error=>{
            assetCache.delete(key);
            throw error;
          }));
        }
        assets.push(...await assetCache.get(key));
      }
    }
    return assets;
  };
  const rag=createRagBridge({workflowUrl:ragUrl,fetchImpl});
  // sops is declared below; the engine asks it for table rows only during calls.
  const ivr=createIvrEngine({scenarios,scenarioRoot:scenarioDir,fetchImpl,tableRows:(id,query)=>sops.tableRows(id,query)});
  const sops=createSops({scenarios,fetchImpl,script:id=>ivr.script(id),figureText:(id,figure)=>ivr.figureText(id,figure),
    dataRoot:path.dirname(scenarioDir)});
  const drafts=createSopDrafts({root:path.join(path.dirname(scenarioDir),'sop-drafts'),fetchImpl,
    read:upload=>readDraftDocument(upload,{pdf,ocrImage}),ocr:bytes=>ocrAnyImage(bytes,ocrImage)});
  const scriptTurns=new Map();
  const store = {
    drafts,
    ivr:body=>ivr.handle(body),
    warmIvr:()=>ivr.warm(),
    addScenario:input=>scenarios.add(input),
    embeddingInputs:args=>rag.embeddingInputs(args),
    evidence:args=>rag.evidence(args),
    readScenario:id=>scenarios.get(id),
    saveScenarioImport:(id,state)=>scenarios.saveImport(id,state),
    listScenarios:()=>scenarios.list(),
    async removeScenario(id){const result=await scenarios.remove(id);await sops.removed(id);return result;},
    sops:()=>sops.list(),
    indexSop:id=>sops.index(id),
    sopContext:body=>sops.context(body),
    rememberSop:body=>sops.remember(body),
    lookup:body=>sops.lookup(body),
    rankSops:body=>sops.rank(body),
    sopDocuments:id=>sops.documents(id),
    syncHotwords:async()=>({terms:await sops.syncHotwords()}),
    // The script skill: one grounded step of the HTML call script. A turn is
    // answered once: an agent that calls the skill twice gets the same step.
    script({sopId,sessionId,text,start,turnId,work_orders}){
      const key=typeof turnId==='string'&&turnId?`${sessionId}\n${turnId}`:'';
      if(key&&scriptTurns.has(key))return scriptTurns.get(key);
      const step=ivr.handle(start===true?{sessionId,start:true,scenarioId:sopId}:{sessionId,text,scenarioId:sopId,work_orders});
      if(key){
        scriptTurns.set(key,step);step.catch(()=>scriptTurns.delete(key));
        if(scriptTurns.size>500)scriptTurns.delete(scriptTurns.keys().next().value);
      }
      return step;
    },
    async indexScenario(id){
      if(typeof id!=='string')throw Object.assign(Error('A scenario ID is required'),{status:400});
      const uploads=await scenarios.corpus(id);
      return rag.run({index:true,items:ragItems(uploads.flatMap(upload=>upload.documents),await visualAssets(uploads))});
    },
    async health(){const saved=await scenarios.list();return {status:'ok',scenarios:saved.length,files:saved.flatMap(scenario=>scenario.files.map(file=>file.name))};},
  };
  return store;
}
// Draft files are shown, never run: the page is escaped HTML without
// scripts, and uploaded originals (an HTML script too) are shown as text or downloaded.
function sendDraftFile(res,{bytes,name}){
  const extension=path.extname(name).toLowerCase();
  const image=imageType(bytes);
  const type=name==='draft.html'?'text/html; charset=utf-8':image?`image/${image}`:extension==='.pdf'?'application/pdf':
    ['.csv','.md','.markdown','.html','.htm'].includes(extension)?'text/plain; charset=utf-8':'application/octet-stream';
  res.setHeader('Content-Type',type);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  if(type==='application/octet-stream')res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.end(bytes);
}
export function createKnowledgeServer(store=createKnowledgeStore()){
  return createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    try{
      const url=new URL(req.url,'http://localhost');let data;
      const importId=/^\/scenario-imports\/([a-f0-9]{24})$/.exec(url.pathname)?.[1];
      // SOP drafts (served to the browser through the HTTPS proxy as /knowledge/sop-drafts).
      const draft=/^\/sop-drafts(?:\/([a-f0-9]{24})(?:\/(draft\.html|bundle|files\/[^/]+))?)?$/.exec(url.pathname);
      if(draft){
        const [,id,part]=draft;
        if(req.method==='POST'&&!id){
          req.setEncoding('utf8');
          let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16*1024*1024)throw Object.assign(Error('Request too large'),{status:413});}
          let body;try{body=JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}
          data=await store.drafts.create(body);
        }
        else if(req.method==='DELETE'&&id&&!part)data=await store.drafts.remove(id);
        else if(req.method!=='GET'||!id){res.writeHead(405);res.end(JSON.stringify({error:'Method not allowed'}));return;}
        else if(!part)data=await store.drafts.get(id);
        else if(part==='bundle')data=await store.drafts.bundle(id);
        else{
          let name=part;
          try{name=part==='draft.html'?part:decodeURIComponent(part.slice('files/'.length));}catch{throw Object.assign(Error('Invalid file name'),{status:400});}
          const file=await store.drafts.file(id,name);
          sendDraftFile(res,file);return;
        }
        res.end(JSON.stringify(data));return;
      }
      if(req.method==='PUT'&&importId){
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>256*1024)throw Object.assign(Error('Request too large'),{status:413});}
        data=await store.saveScenarioImport(importId,JSON.parse(raw));
      }
      else if(req.method==='POST'&&['/ivr','/scenarios','/rag/index','/rag/evidence','/rag/embedding-inputs','/sops/index','/sops/context','/sops/session','/skills/lookup','/skills/script','/sops/rank','/sops/hotwords'].includes(url.pathname)){
        req.setEncoding('utf8');
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>(url.pathname==='/scenarios'?16*1024*1024:256*1024))throw Object.assign(Error('Request too large'),{status:413});}
        let body;try{body=JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}
        if(url.pathname==='/ivr')data=await store.ivr(body||{});
        else if(url.pathname==='/rag/embedding-inputs')data=store.embeddingInputs(body||{});
        else if(url.pathname==='/rag/evidence')data=store.evidence(body||{});
        else if(url.pathname==='/rag/index')data=await store.indexScenario(body?.id);
        else if(url.pathname==='/sops/index')data=await store.indexSop(body?.id);
        else if(url.pathname==='/sops/context')data=await store.sopContext(body||{});
        else if(url.pathname==='/sops/session')data=store.rememberSop(body||{});
        else if(url.pathname==='/skills/lookup')data=await store.lookup(body||{});
        else if(url.pathname==='/sops/rank')data=await store.rankSops(body||{});
        else if(url.pathname==='/sops/hotwords')data=await store.syncHotwords();
        else if(url.pathname==='/skills/script')data=await store.script(body||{});
        else data=await store.addScenario(body);
      }
      else if(req.method==='DELETE'&&url.pathname.startsWith('/scenarios/'))data=await store.removeScenario(url.pathname.slice('/scenarios/'.length));
      else if(req.method!=='GET'){res.writeHead(405);res.end(JSON.stringify({error:'Method not allowed'}));return;}
      else if(url.pathname==='/health')data=await store.health();
      else if(url.pathname==='/scenarios')data={scenarios:await store.listScenarios()};
      else if(url.pathname==='/sops')data={sops:await store.sops()};
      else if(/^\/sops\/[a-f0-9]{24}\/documents$/.test(url.pathname))data=await store.sopDocuments(url.pathname.split('/')[2]);
      else if(importId)data=await store.readScenario(importId);
      else{res.writeHead(404);res.end(JSON.stringify({error:'Unknown knowledge endpoint'}));return;}
      res.end(JSON.stringify(data));
    }catch(e){res.writeHead(e.status||500);res.end(JSON.stringify({error:e.message}));}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const store=createKnowledgeStore();
  createKnowledgeServer(store).listen(Number(process.env.PORT||8085),'0.0.0.0',()=>{
    console.log('[ivr-knowledge] Local document/OCR service ready on port '+(process.env.PORT||8085));
    store.warmIvr().catch(error=>console.warn('[ivr-engine] Warm-up failed:',error.message));
  });
}
