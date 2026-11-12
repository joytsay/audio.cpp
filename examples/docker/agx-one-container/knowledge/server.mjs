import {createServer} from 'node:http';
import {promises as fs,constants} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFile as execFileCallback} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import {createHash} from 'node:crypto';
import {sourceQa,workbookQa} from './qa.mjs';
import {lookupIntent} from './conversation.mjs';
import {createWorkOrderStore} from './work-orders.mjs';
const execFile=promisify(execFileCallback);
export const filenames={prompt:'prompt.csv',word:'情境模擬_20261105.docx',excel:'CSD資料庫.xlsx',pdf:'(備品維修)PY252-0059-工單-20260602-2工-CL、JC.pdf'};
function cellText(cell){const v=cell.result??cell.value;if(v instanceof Date)return v.toISOString().slice(0,10);if(typeof v==='number'&&/^0+$/.test(cell.numFmt||''))return String(v).padStart(cell.numFmt.length,'0');return cell.text?.trim()||'';}
export async function readWorkbook(file){
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);const sheets=[];
  for(const sheet of workbook.worksheets){let headers;const rows=[];sheet.eachRow((row,rowNumber)=>{
    if(!headers){headers=Array.from({length:sheet.columnCount},(_,i)=>cellText(row.getCell(i+1))||`欄位${i+1}`);return;}
    const fields={};headers.forEach((name,i)=>fields[name]=cellText(row.getCell(i+1)));if(Object.values(fields).some(Boolean))rows.push({row:rowNumber,fields});
  });sheets.push({name:sheet.name,rows});}return sheets;
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
export function createKnowledgeStore({root=process.env.KNOWLEDGE_ROOT||'/files',pdf=extractPdf,orders=createWorkOrderStore()}={}){
  // File-only cache; concurrent requests share OCR. User queries are never cached.
  const cache=new Map();
  async function read(kind,extract){
    const file=path.join(root,filenames[kind]);const stat=await fs.stat(file);
    if(!stat.isFile()||stat.size>25*1024*1024)throw new Error(`${filenames[kind]} must be a regular file under 25 MiB`);
    const key=`${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
    if(cache.get(kind)?.key===key)return cache.get(kind).promise;
    const promise=extract(file).then(result=>({source:filenames[kind],modified:stat.mtime.toISOString(),...result}));
    cache.set(kind,{key,promise});
    try{return await promise;}catch(e){cache.delete(kind);throw e;}
  }
  const workbook=()=>read('excel',async file=>({sheets:await readWorkbook(file)}));
  return {
    registerTurn:input=>orders.register(input),
    prepareWorkOrder:sessionId=>orders.prepare(sessionId),
    listWorkOrders:()=>orders.list(),
    async health(){for(const name of Object.values(filenames)){const file=path.join(root,name);await fs.access(file,constants.R_OK);if(!(await fs.stat(file)).isFile())throw new Error(`${name} must be a readable file`);}return {status:'ok',files:Object.values(filenames)};},
    async documents(query='',tableRecords=[]){
      // Work-order questions need actual dispatch records, not reporting rules.
      const excel=await workbook();
      if(!Array.isArray(tableRecords)||tableRecords.some(r=>!r||typeof r.id!=='string'||!r.fields||typeof r.fields!=='object'))throw Object.assign(Error('Invalid Data Table records'),{status:400});
      const local=[...new Map([...(await orders.list()),...tableRecords].map(r=>[r.id,r])).values()];
      const sheets=excel.sheets.map(sheet=>sheet.name==='派工'?{...sheet,rows:[...sheet.rows,...local.map((record,index)=>({row:100000+index,source:record.source,fields:record.fields}))]}:sheet);
      const result=workOrderSelection(query,sheets);
      if(result){
        if(local.length)result.source='CSD資料庫.xlsx + '+[...new Set(local.map(r=>r.source||'舊版 JSON 工單'))].join(' + ');
        const document=workbookDocument(excel,{name:'派工',rows:result.work_orders});
        const documents=result.work_orders.length?result.work_orders.flatMap(row=>workbookQa({...document,source:row.source||excel.source},[row])):workbookQa(document,[]);
        return {documents,result,format:'qa'};
      }
      const word=await read('word',async file=>{const r=await mammoth.extractRawText({path:file});return {text:r.value,kind:'scenario_examples',extraction:'docx',warnings:r.messages.map(m=>m.message)};});
      const pdfDoc=await read('pdf',async file=>({...await pdf(file),kind:'work_order_document',sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')}));
      const documents=[...sourceQa(word),...excel.sheets.flatMap(sheet=>workbookQa(workbookDocument(excel,sheet),sheet.rows)),...local.flatMap((record,index)=>workbookQa({source:record.source,sheet:'派工',kind:'workbook_records',extraction:record.source?.includes('n8n Data Table')?'n8n_data_table':'legacy_json'},[{row:100000+index,fields:record.fields}])),...sourceQa(pdfDoc)];
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
      if(req.method==='POST'&&['/call-turn','/work-order-draft','/documents'].includes(url.pathname)){
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>256*1024)throw Object.assign(Error('Request too large'),{status:413});}
        let body;try{body=JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}
        data=url.pathname==='/call-turn'?await store.registerTurn(body):url.pathname==='/work-order-draft'?await store.prepareWorkOrder(body.sessionId):await store.documents(body.query||'',body.records??[]);
      }
      else if(req.method!=='GET'){res.writeHead(405);res.end(JSON.stringify({error:'Method not allowed'}));return;}
      else if(url.pathname==='/health')data=await store.health();
      else if(url.pathname==='/documents')data=await store.documents(url.searchParams.get('query')||'');
      else if(url.pathname==='/work-orders')data={work_orders:await store.listWorkOrders()};
      else{res.writeHead(404);res.end(JSON.stringify({error:'Unknown knowledge endpoint'}));return;}
      res.end(JSON.stringify(data));
    }catch(e){res.writeHead(e.status||500);res.end(JSON.stringify({error:e.message}));}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)createKnowledgeServer().listen(Number(process.env.PORT||8085),'0.0.0.0',()=>console.log('[ivr-knowledge] Local document/OCR service ready on port '+(process.env.PORT||8085)));
