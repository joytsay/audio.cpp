import {createServer} from 'node:http';
import {promises as fs,constants} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFile as execFileCallback} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
const execFile=promisify(execFileCallback);
export const filenames={prompt:'prompt.csv',word:'情境模擬_20261105.docx',excel:'CSD資料庫.xlsx',pdf:'(備品維修)PY252-0059-工單-20260602-2工-CL、JC.pdf'};
function cellText(cell) {
  const value=cell.result??cell.value;
  if(value instanceof Date)return value.toISOString().slice(0,10);
  if(typeof value==='number'&&/^0+$/.test(cell.numFmt||''))return String(value).padStart(cell.numFmt.length,'0');
  return cell.text?.trim()||'';
}
export async function readWorkbook(file) {
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file);
  const sheets=[];
  for(const sheet of workbook.worksheets){
    let headers;const rows=[];
    sheet.eachRow((row,rowNumber)=>{
      if(!headers){headers=Array.from({length:sheet.columnCount},(_,i)=>cellText(row.getCell(i+1))||`欄位${i+1}`);return;}
      const fields={};headers.forEach((h,i)=>{fields[h]=cellText(row.getCell(i+1));});
      if(Object.values(fields).some(Boolean))rows.push({row:rowNumber,fields});
    });sheets.push({name:sheet.name,rows});
  }return sheets;
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
export function createKnowledgeStore({root=process.env.KNOWLEDGE_ROOT||'/files',pdf=extractPdf}={}){
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
    async health(){for(const name of Object.values(filenames)){const file=path.join(root,name);await fs.access(file,constants.R_OK);if(!(await fs.stat(file)).isFile())throw new Error(`${name} must be a readable file`);}return {status:'ok',files:Object.values(filenames)};},
    async documents(){
      const prompt=await read('prompt',async file=>({text:await fs.readFile(file,'utf8'),kind:'rules',extraction:'utf8'}));
      const word=await read('word',async file=>{const r=await mammoth.extractRawText({path:file});return {text:r.value,kind:'scenario_examples',extraction:'docx',warnings:r.messages.map(m=>m.message)};});
      const excel=await workbook();
      const pdfDoc=await read('pdf',async file=>({...await pdf(file),kind:'work_order_document'}));
      const documents=[prompt,word,...excel.sheets.map(sheet=>({source:excel.source,sheet:sheet.name,modified:excel.modified,kind:'workbook_records',extraction:'xlsx',rowCount:sheet.rows.length,text:sheet.rows.map(row=>`來源：${excel.source}；工作表：${sheet.name}；列：${row.row}\n${JSON.stringify(row.fields)}`).join('\n\n')})),pdfDoc];
      for(const d of documents){if(!d.text.trim())throw new Error(`No text extracted from ${d.source}${d.sheet?' / '+d.sheet:''}`);if(d.text.length>500000)throw new Error(`Extracted text too large: ${d.source}`);}
      return {documents};
    },
    async workOrders(){const excel=await workbook();const sheet=excel.sheets.find(s=>s.name==='派工');if(!sheet)throw new Error('CSD資料庫.xlsx is missing the 派工 worksheet');return {source:excel.source,sheet:sheet.name,modified:excel.modified,scope:'all populated rows in the supplied 派工 worksheet',count:sheet.rows.length,work_orders:sheet.rows};}
  };
}
export function createKnowledgeServer(store=createKnowledgeStore()){
  return createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    try{
      if(req.method!=='GET'){res.writeHead(405);res.end(JSON.stringify({error:'GET only'}));return;}
      const url=new URL(req.url,'http://localhost');let data;
      if(url.pathname==='/health')data=await store.health();
      else if(url.pathname==='/documents')data=await store.documents();
      else if(url.pathname==='/work-orders')data=await store.workOrders();
      else{res.writeHead(404);res.end(JSON.stringify({error:'Unknown knowledge endpoint'}));return;}
      res.end(JSON.stringify(data));
    }catch(e){res.writeHead(500);res.end(JSON.stringify({error:e.message}));}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)createKnowledgeServer().listen(Number(process.env.PORT||8085),'0.0.0.0',()=>console.log('[ivr-knowledge] Local document/OCR service ready on port '+(process.env.PORT||8085)));
