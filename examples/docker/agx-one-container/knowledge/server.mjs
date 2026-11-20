import {createScenarioStore} from './scenarios.mjs';
import {htmlScenarioText,uniqueHeaders} from './scenario-files.mjs';
import {chooseSimulationSection,simulationGuidance,simulationSections} from './scenario-simulation.mjs';
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
import {createHash} from 'node:crypto';
import {sourceQa,workbookQa,qaDocument} from './qa.mjs';
import {dispatchDate,identifiers,lookupIntent,scenarioLookupIntent} from './conversation.mjs';
import {createWorkOrderStore} from './work-orders.mjs';
import {belongsToSection,extractRagAssets,ragItems} from './rag-assets.mjs';
const execFile=promisify(execFileCallback);
export const filenames={prompt:'prompt.csv',word:'情境模擬_20261105.docx',excel:'CSD資料庫.xlsx',pdf:'(備品維修)PY252-0059-工單-20260602-2工-CL、JC.pdf'};
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
export {dispatchDate};
export function workOrderSelection(query,sheets,{now=new Date()}={}){
  const intent=lookupIntent(query,null,now);if(!intent)return;
  const sheet=sheets.find(s=>s.name==='派工');if(!sheet)throw new Error('CSD資料庫.xlsx is missing 派工');
  const {selection:mode,period}=intent;
  const normalized=sheet.rows.map(row=>{const original=row.fields['派工日期'],date=dispatchDate(original);return date&&date!==original?{...row,original_dispatch_date:original,fields:{...row.fields,派工日期:date}}:row;});
  const reference=intent.reference?.toUpperCase();
  const exactReference=reference&&/^[A-Z]+-\d/.test(reference);
  const matches=value=>exactReference?identifiers(String(value??'')).some(code=>code.toUpperCase()===reference)
    :String(value??'').toUpperCase().includes(reference);
  const matching=reference?normalized.filter(row=>[row.fields.派工單號,row.fields.工單編號].some(matches)):[];
  const scoped=reference?(matching.length?matching:normalized.filter(row=>Object.values(row.fields).some(matches))):normalized;
  const candidates=intent.invalidPeriod?[]:period?scoped.filter(r=>String(r.fields['派工日期']||'').startsWith(period+'-')):scoped;
  const dated=candidates.filter(row=>{const d=row.fields['派工日期'];return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;}).sort((a,b)=>a.fields['派工日期'].localeCompare(b.fields['派工日期'])||a.row-b.row);
  const date=mode==='oldest'?dated[0]?.fields['派工日期']:dated.at(-1)?.fields['派工日期'];
  const rows=mode==='all'||mode==='details'?candidates:dated.filter(row=>row.fields['派工日期']===date);
  return {source:filenames.excel,sheet:'派工',selection:mode,period,reference:intent.reference,view:intent.view,total_count:candidates.length,selected_count:rows.length,undated_count:candidates.length-dated.length,work_orders:rows};
}
function workbookDocument(excel,sheet){return {source:excel.source,sheet:sheet.name,modified:excel.modified,kind:'workbook_records',extraction:'xlsx',rowCount:sheet.rows.length,text:sheet.rows.length?sheet.rows.map(row=>`來源：${excel.source}；工作表：${sheet.name}；列：${row.row}\n${JSON.stringify(row.fields)}`).join('\n\n'):'此資料表目前沒有記錄。'};}
export function createKnowledgeStore({root=process.env.KNOWLEDGE_ROOT,pdf=extractPdf,ocrImage=readScenarioImage,orders=createWorkOrderStore(),scenarioRoot,
  ragUrl=process.env.IVR_RAG_URL||'http://rag:8086',fetchImpl=fetch}={}){
  const scenarios=createScenarioStore({root:scenarioRoot,extract:async(file,upload)=>{
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
  // File-only cache; concurrent requests share OCR. User queries are never cached.
  const cache=new Map();
  const assetCache=new Map();
  const visualAssets=async(records,section,includeRoot=true)=>{
    const assets=[];
    const rootFiles=includeRoot&&!section&&root?[{name:filenames.pdf,path:path.join(root,filenames.pdf)},{name:filenames.word,path:path.join(root,filenames.word)}]:[];
    for(const {files,attachments} of [...records,{files:rootFiles,attachments:[]}]){
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
  const callRag=async(endpoint,body)=>{
    const response=await fetchImpl(ragUrl+endpoint,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(240000),
    });
    const data=await response.json();
    if(!response.ok)throw Object.assign(Error(data.error||'Multimodal RAG unavailable'),{status:502});
    return data;
  };
  async function read(kind,extract){
    if(!root)return;
    const file=path.join(root,filenames[kind]);
    let stat;try{stat=await fs.stat(file);}catch(error){if(error.code==='ENOENT')return;throw error;}
    if(!stat.isFile()||stat.size>25*1024*1024)throw new Error(`${filenames[kind]} must be a regular file under 25 MiB`);
    const key=`${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
    if(cache.get(kind)?.key===key)return cache.get(kind).promise;
    const promise=extract(file).then(result=>({source:filenames[kind],modified:stat.mtime.toISOString(),...result}));
    cache.set(kind,{key,promise});
    try{return await promise;}catch(e){cache.delete(kind);throw e;}
  }
  const workbook=async()=>await read('excel',async file=>({sheets:await readWorkbook(file)}))||{source:'已儲存工單',sheets:[{name:'派工',rows:[]}]};
  const store = {
    addScenario:input=>scenarios.add(input),
    async simulation({id,text,number,language,previous=''}={}){
      if(typeof text!=='string'||!text.trim()||text.length>20000)throw Object.assign(Error('Invalid simulation request'),{status:400});
      const record=await scenarios.get(id);
      const sections=simulationSections(record.files,record.dataset);
      if(!record.resources?.ready||!sections.length)throw Object.assign(Error('Scenario simulation not found'),{status:404});
      if(number!==undefined){
        if(![4,5,7].includes(number)||!sections.some(section=>section.number===number)||!['zh','en'].includes(language)||
          typeof previous!=='string'||previous.length>1000||text.length>8000)
          throw Object.assign(Error('Invalid scenario lookup'),{status:400});
        const records=await scenarios.corpus(id);
        const docs=record.documents.filter(document=>belongsToSection(document.section,number));
        return callRag('/answer',{query:text,previous,language,items:ragItems(docs,await visualAssets(records,number))});
      }
      const section=chooseSimulationSection(sections,text);
      return {scenario:section?simulationGuidance(section):null};
    },
    readScenario:id=>scenarios.get(id),
    saveScenarioImport:(id,state)=>scenarios.saveImport(id,state),
    listScenarios:()=>scenarios.list(),
    removeScenario:id=>scenarios.remove(id),
    registerTurn:input=>orders.register(input),
    prepareWorkOrder:sessionId=>orders.prepare(sessionId),
    listWorkOrders:()=>orders.list(),
    async retrieve({query,records=[]}={}){
      if(typeof query!=='string'||!query.trim()||query.length>10000)throw Object.assign(Error('Invalid RAG query'),{status:400});
      const {documents,result}=await store.documents(query,records);
      if(result)return {...result,sources:[...new Set(documents.map(document=>document.source))].map(source=>({source}))};
      const uploads=await scenarios.corpus();
      const imported=uploads.flatMap(upload=>upload.documents.filter(document=>!document.sheet));
      const docs=[...new Map([...documents,...imported].map(document=>[JSON.stringify([document.source,document.text]),document])).values()];
      const language=/\p{Script=Han}/u.test(query)?'zh':'en';
      return callRag('/answer',{query,language,items:ragItems(docs,await visualAssets(uploads))});
    },
    async indexScenario(id){
      if(typeof id!=='string')throw Object.assign(Error('A scenario ID is required'),{status:400});
      const uploads=await scenarios.corpus(id);
      return callRag('/index',{items:ragItems(uploads.flatMap(upload=>upload.documents),await visualAssets(uploads,undefined,false))});
    },
    async health(){const saved=await scenarios.list();return {status:'ok',scenarios:saved.length,files:saved.flatMap(scenario=>scenario.files.map(file=>file.name))};},
    async documents(query='',tableRecords=[],routeOnly=false){
      if(!Array.isArray(tableRecords)||tableRecords.some(r=>!r||typeof r.id!=='string'||!r.fields||typeof r.fields!=='object'))throw Object.assign(Error('Invalid Data Table records'),{status:400});
      const scenarioLookup=scenarioLookupIntent(query);
      if(scenarioLookup&&!scenarioLookup.fallback&&!lookupIntent(query))return {documents:[],format:'qa',scenario_lookup:scenarioLookup};
      // Work-order questions need actual dispatch records, not reporting rules.
      const excel=await workbook();
      const local=[...new Map([...(await orders.list()),...tableRecords].map(r=>[r.id,r])).values()];
      const uploaded=await scenarios.documents();
      const sheets=excel.sheets.map(sheet=>sheet.name==='派工'?{...sheet,rows:[...sheet.rows,...local.map((record,index)=>({row:100000+index,source:record.source,fields:record.fields}))]}:sheet);
      const result=workOrderSelection(query,sheets);
      if(result&&(result.reference||sheets.some(sheet=>sheet.rows.length)||!uploaded.length)){
        result.source=[...(excel.source==='已儲存工單'?[]:[excel.source]),...new Set(local.map(r=>r.source||'舊版 JSON 工單'))].join(' + ')||'已儲存工單';
        const scenarioReference=result.selection==='details'&&result.view==='details'&&!result.period&&!result.selected_count
          ?result.reference:null;
        const route={result,format:'qa',...(scenarioReference?{scenario_reference:scenarioReference}:{})};
        if(routeOnly)return route;
        const document=workbookDocument(excel,{name:'派工',rows:result.work_orders});
        const documents=result.work_orders.length?result.work_orders.flatMap(row=>workbookQa({...document,source:row.source||excel.source},[row])):workbookQa(document,[]);
        return {...route,documents};
      }
      if(routeOnly)return scenarioLookup?.fallback?{scenario_lookup:scenarioLookup}:{};
      const word=await read('word',async file=>{const r=await mammoth.extractRawText({path:file});return {text:r.value,kind:'scenario_examples',extraction:'docx',warnings:r.messages.map(m=>m.message)};});
      const pdfDoc=await read('pdf',async file=>({...await pdf(file),kind:'work_order_document',sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')}));
      const documents=[...(word?sourceQa(word):[]),...excel.sheets.filter(sheet=>sheet.rows.length).flatMap(sheet=>workbookQa(workbookDocument(excel,sheet),sheet.rows)),...local.flatMap((record,index)=>workbookQa({source:record.source,sheet:'派工',kind:'workbook_records',extraction:record.source?.includes('n8n Data Table')?'n8n_data_table':'legacy_json'},[{row:100000+index,fields:record.fields}])),...(pdfDoc?sourceQa(pdfDoc):[]),...uploaded];
      if(!documents.length&&query.trim())documents.push(qaDocument({source:'知識庫狀態'},'目前有可查詢的情境文件嗎？','目前尚未上傳情境文件。'));
      for(const d of documents){if(!d.text.trim())throw new Error(`No text extracted from ${d.source}${d.sheet?' / '+d.sheet:''}`);if(d.text.length>500000)throw new Error(`Extracted text too large: ${d.source}`);}
      return {documents,format:'qa',...(scenarioLookup?.fallback?{scenario_lookup:scenarioLookup}:{})};
    },

  };
  return store;
}
export function createKnowledgeServer(store=createKnowledgeStore()){
  return createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    try{
      const url=new URL(req.url,'http://localhost');let data;
      const importId=/^\/scenario-imports\/([a-f0-9]{24})$/.exec(url.pathname)?.[1];
      if(req.method==='PUT'&&importId){
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>256*1024)throw Object.assign(Error('Request too large'),{status:413});}
        data=await store.saveScenarioImport(importId,JSON.parse(raw));
      }
      else if(req.method==='POST'&&['/call-turn','/work-order-draft','/documents','/scenarios','/ivr-simulation','/rag','/rag/index'].includes(url.pathname)){
        req.setEncoding('utf8');
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>(url.pathname==='/scenarios'?16*1024*1024:256*1024))throw Object.assign(Error('Request too large'),{status:413});}
        let body;try{body=JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}
        if(url.pathname==='/rag')data=await store.retrieve(body||{});
        else if(url.pathname==='/rag/index')data=await store.indexScenario(body?.id);
        else data=url.pathname==='/scenarios'?await store.addScenario(body):url.pathname==='/call-turn'?await store.registerTurn(body):url.pathname==='/work-order-draft'?await store.prepareWorkOrder(body.sessionId):url.pathname==='/ivr-simulation'?await store.simulation(body||{}):await store.documents(body.query||'',body.records??[],body.routeOnly===true);
      }
      else if(req.method==='DELETE'&&url.pathname.startsWith('/scenarios/'))data=await store.removeScenario(url.pathname.slice('/scenarios/'.length));
      else if(req.method!=='GET'){res.writeHead(405);res.end(JSON.stringify({error:'Method not allowed'}));return;}
      else if(url.pathname==='/health')data=await store.health();
      else if(url.pathname==='/documents')data=await store.documents(url.searchParams.get('query')||'');
      else if(url.pathname==='/scenarios')data={scenarios:await store.listScenarios()};
      else if(importId)data=await store.readScenario(importId);
      else if(url.pathname==='/work-orders')data={work_orders:await store.listWorkOrders()};
      else{res.writeHead(404);res.end(JSON.stringify({error:'Unknown knowledge endpoint'}));return;}
      res.end(JSON.stringify(data));
    }catch(e){res.writeHead(e.status||500);res.end(JSON.stringify({error:e.message}));}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)createKnowledgeServer().listen(Number(process.env.PORT||8085),'0.0.0.0',()=>console.log('[ivr-knowledge] Local document/OCR service ready on port '+(process.env.PORT||8085)));
