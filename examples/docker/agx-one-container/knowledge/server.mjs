import {createScenarioStore} from './scenarios.mjs';
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
import {lookupIntent} from './conversation.mjs';
import {createWorkOrderStore} from './work-orders.mjs';
const execFile=promisify(execFileCallback);
export const filenames={prompt:'prompt.csv',word:'情境模擬_20261105.docx',excel:'CSD資料庫.xlsx',pdf:'(備品維修)PY252-0059-工單-20260602-2工-CL、JC.pdf'};
function cellText(cell){const v=cell.result??cell.value;if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='number'&&/^0+$/.test(cell.numFmt||''))return String(v).padStart(cell.numFmt.length,'0');return cell.text?.trim()||'';}
function worksheetRows(sheet){
  let headers;const rows=[];sheet.eachRow((row,rowNumber)=>{
    if(!headers){headers=Array.from({length:sheet.columnCount},(_,i)=>cellText(row.getCell(i+1))||`欄位${i+1}`);return;}
    const fields={};headers.forEach((name,i)=>fields[name]=cellText(row.getCell(i+1)));if(Object.values(fields).some(Boolean))rows.push({row:rowNumber,fields});
  });return {name:sheet.name,rows};
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
      if(!stdout.trim())throw new Error(`OCR found no text on PDF page ${page}`);
      chunks.push(`【第 ${page} 頁；OCR 辨識，代碼及數值需核對原件】\n${stdout.trim()}`);
    }return {text:chunks.join('\n\n'),extraction:'ocr',pages,languages,notice:'OCR output is not authoritative; verify codes, quantities and dates against the PDF image.'};
  }finally{await fs.rm(dir,{recursive:true,force:true});}
}
export function dispatchDate(value){
  const text=String(value??'').trim();
  const m=text.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})(?:日|號)?$/)||text.match(/^(\d{4})(\d{2})\/(\d{1,2})$/)||text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(!m)return '';
  const date=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  return !Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date?date:'';
}
export function workOrderSelection(query,sheets,{now=new Date()}={}){
  const intent=lookupIntent(query,null,now);if(!intent)return;
  const sheet=sheets.find(s=>s.name==='派工');if(!sheet)throw new Error('CSD資料庫.xlsx is missing 派工');
  const {selection:mode,period}=intent;
  const normalized=sheet.rows.map(row=>{const original=row.fields['派工日期'],date=dispatchDate(original);return date&&date!==original?{...row,original_dispatch_date:original,fields:{...row.fields,派工日期:date}}:row;});
  const matching=intent.reference?normalized.filter(row=>[row.fields.派工單號,row.fields.工單編號].some(value=>String(value||'').toUpperCase().includes(intent.reference.toUpperCase()))):[];
  const scoped=intent.reference?(matching.length?matching:normalized.filter(row=>JSON.stringify(row.fields).toUpperCase().includes(intent.reference.toUpperCase()))):normalized;
  const candidates=intent.invalidPeriod?[]:period?scoped.filter(r=>String(r.fields['派工日期']||'').startsWith(period+'-')):scoped;
  const dated=candidates.filter(row=>{const d=row.fields['派工日期'];return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;}).sort((a,b)=>a.fields['派工日期'].localeCompare(b.fields['派工日期'])||a.row-b.row);
  const date=mode==='oldest'?dated[0]?.fields['派工日期']:dated.at(-1)?.fields['派工日期'];
  const rows=mode==='all'||mode==='details'?candidates:dated.filter(row=>row.fields['派工日期']===date);
  return {source:filenames.excel,sheet:'派工',selection:mode,period,reference:intent.reference,view:intent.view,total_count:candidates.length,selected_count:rows.length,undated_count:candidates.length-dated.length,work_orders:rows};
}
function workbookDocument(excel,sheet){return {source:excel.source,sheet:sheet.name,modified:excel.modified,kind:'workbook_records',extraction:'xlsx',rowCount:sheet.rows.length,text:sheet.rows.length?sheet.rows.map(row=>`來源：${excel.source}；工作表：${sheet.name}；列：${row.row}\n${JSON.stringify(row.fields)}`).join('\n\n'):'此資料表目前沒有記錄。'};}
export function createKnowledgeStore({root=process.env.KNOWLEDGE_ROOT,pdf=extractPdf,orders=createWorkOrderStore(),scenarioRoot}={}){
  const scenarios=createScenarioStore({root:scenarioRoot,extract:async(file,upload)=>{
    if(upload.extension==='.pdf')return [{...await pdf(file)}];
    if(upload.extension==='.docx'){const result=await mammoth.extractRawText({path:file});return [{text:result.value,extraction:'docx',kind:/情境\s*\d/.test(result.value)?'scenario_examples':'uploaded_reference'}];}
    if(upload.extension==='.csv'){const sheet=await readCsv(file);return sheet.rows.map(row=>({text:referenceRow(row),row:row.row,topic:`第 ${row.row} 列`,extraction:'csv'}));}
    if(upload.extension==='.xlsx')return (await readWorkbook(file)).flatMap(sheet=>sheet.rows.map(row=>({text:Object.entries(row.fields).filter(([,value])=>value).map(([key,value])=>`${key}：${value}`).join('；'),sheet:sheet.name,row:row.row,topic:`${sheet.name} 第 ${row.row} 列`,extraction:'xlsx'})));
    const bytes=await fs.readFile(file);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);return [{text,extraction:'text'}];
  }});
  // File-only cache; concurrent requests share OCR. User queries are never cached.
  const cache=new Map();
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
  return {
    addScenario:input=>scenarios.add(input),
    listScenarios:()=>scenarios.list(),
    removeScenario:id=>scenarios.remove(id),
    registerTurn:input=>orders.register(input),
    prepareWorkOrder:sessionId=>orders.prepare(sessionId),
    listWorkOrders:()=>orders.list(),
    async health(){const saved=await scenarios.list();return {status:'ok',scenarios:saved.length,files:saved.flatMap(scenario=>scenario.files.map(file=>file.name))};},
    async documents(query='',tableRecords=[]){
      // Work-order questions need actual dispatch records, not reporting rules.
      const excel=await workbook();
      if(!Array.isArray(tableRecords)||tableRecords.some(r=>!r||typeof r.id!=='string'||!r.fields||typeof r.fields!=='object'))throw Object.assign(Error('Invalid Data Table records'),{status:400});
      const local=[...new Map([...(await orders.list()),...tableRecords].map(r=>[r.id,r])).values()];
      const uploaded=await scenarios.documents();
      const sheets=excel.sheets.map(sheet=>sheet.name==='派工'?{...sheet,rows:[...sheet.rows,...local.map((record,index)=>({row:100000+index,source:record.source,fields:record.fields}))]}:sheet);
      const result=workOrderSelection(query,sheets);
      if(result&&(sheets.some(sheet=>sheet.rows.length)||!uploaded.length)){
        result.source=[...(excel.source==='已儲存工單'?[]:[excel.source]),...new Set(local.map(r=>r.source||'舊版 JSON 工單'))].join(' + ')||'已儲存工單';
        const document=workbookDocument(excel,{name:'派工',rows:result.work_orders});
        const documents=result.work_orders.length?result.work_orders.flatMap(row=>workbookQa({...document,source:row.source||excel.source},[row])):workbookQa(document,[]);
        return {documents,result,format:'qa'};
      }
      const word=await read('word',async file=>{const r=await mammoth.extractRawText({path:file});return {text:r.value,kind:'scenario_examples',extraction:'docx',warnings:r.messages.map(m=>m.message)};});
      const pdfDoc=await read('pdf',async file=>({...await pdf(file),kind:'work_order_document',sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')}));
      const documents=[...(word?sourceQa(word):[]),...excel.sheets.filter(sheet=>sheet.rows.length).flatMap(sheet=>workbookQa(workbookDocument(excel,sheet),sheet.rows)),...local.flatMap((record,index)=>workbookQa({source:record.source,sheet:'派工',kind:'workbook_records',extraction:record.source?.includes('n8n Data Table')?'n8n_data_table':'legacy_json'},[{row:100000+index,fields:record.fields}])),...(pdfDoc?sourceQa(pdfDoc):[]),...uploaded];
      if(!documents.length&&query.trim())documents.push(qaDocument({source:'知識庫狀態'},'目前有可查詢的情境文件嗎？','目前尚未上傳情境文件。'));
      for(const d of documents){if(!d.text.trim())throw new Error(`No text extracted from ${d.source}${d.sheet?' / '+d.sheet:''}`);if(d.text.length>500000)throw new Error(`Extracted text too large: ${d.source}`);}
      return {documents,format:'qa'};
    },

  };
}
export function createKnowledgeServer(store=createKnowledgeStore()){
  return createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    try{
      const url=new URL(req.url,'http://localhost');let data;
      if(req.method==='POST'&&['/call-turn','/work-order-draft','/documents','/scenarios'].includes(url.pathname)){
        req.setEncoding('utf8');
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>(url.pathname==='/scenarios'?16*1024*1024:256*1024))throw Object.assign(Error('Request too large'),{status:413});}
        let body;try{body=JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}
        data=url.pathname==='/scenarios'?await store.addScenario(body):url.pathname==='/call-turn'?await store.registerTurn(body):url.pathname==='/work-order-draft'?await store.prepareWorkOrder(body.sessionId):await store.documents(body.query||'',body.records??[]);
      }
      else if(req.method==='DELETE'&&url.pathname.startsWith('/scenarios/'))data=await store.removeScenario(url.pathname.slice('/scenarios/'.length));
      else if(req.method!=='GET'){res.writeHead(405);res.end(JSON.stringify({error:'Method not allowed'}));return;}
      else if(url.pathname==='/health')data=await store.health();
      else if(url.pathname==='/documents')data=await store.documents(url.searchParams.get('query')||'');
      else if(url.pathname==='/scenarios')data={scenarios:await store.listScenarios()};
      else if(url.pathname==='/work-orders')data={work_orders:await store.listWorkOrders()};
      else{res.writeHead(404);res.end(JSON.stringify({error:'Unknown knowledge endpoint'}));return;}
      res.end(JSON.stringify(data));
    }catch(e){res.writeHead(e.status||500);res.end(JSON.stringify({error:e.message}));}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)createKnowledgeServer().listen(Number(process.env.PORT||8085),'0.0.0.0',()=>console.log('[ivr-knowledge] Local document/OCR service ready on port '+(process.env.PORT||8085)));
