import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {filenames,createKnowledgeStore,readWorkbook,extractPdf,createKnowledgeServer} from './server.mjs';
const root=new URL('../../../../',import.meta.url).pathname;
const realSheets=await readWorkbook(path.join(root,filenames.excel));
assert.deepEqual(realSheets.map(s=>s.name),['派工','客戶設備','設備類型','通訊錄']);
assert.ok(realSheets.every(s=>s.rows.length>0));
assert.equal(realSheets[0].rows[0].fields['派工單號'],'YCS-16860');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-knowledge-test-'));
try{
  for(const name of Object.values(filenames))await fs.copyFile(path.join(root,name),path.join(dir,name));
  let ocrCalls=0;
  const store=createKnowledgeStore({root:dir,pdf:async()=>{ocrCalls++;return {text:'PDF 工單 PY252-0059；OCR 值需核對',extraction:'ocr'};}});
  const [a,b]=await Promise.all([store.documents(),store.documents()]);
  assert.equal(ocrCalls,1,'concurrent requests should share the cached extraction');
  assert.equal(a.documents.length,7);
  assert.deepEqual(a,b);
  assert.equal(a.documents.find(d=>d.source===filenames.prompt).text,await fs.readFile(path.join(root,filenames.prompt),'utf8'));
  assert.ok(a.documents.find(d=>d.source===filenames.word).text.includes('工單回報'));
  assert.equal(a.documents.find(d=>d.source===filenames.word).kind,'scenario_examples');
  assert.equal(a.documents.find(d=>d.source===filenames.pdf).extraction,'ocr');
  assert.deepEqual(a.documents.filter(d=>d.source===filenames.excel).map(d=>d.sheet),realSheets.map(s=>s.name));
  const orders=await store.workOrders();
  assert.equal(orders.count,realSheets[0].rows.length);
  assert.equal(orders.work_orders[0].fields['派工單號'],'YCS-16860');
  await fs.writeFile(path.join(dir,filenames.prompt),'修改後的維修 SOP\n保留 SN：00123456');
  const refreshed=await store.documents();
  assert.equal(refreshed.documents[0].text,'修改後的維修 SOP\n保留 SN：00123456');
  assert.equal(ocrCalls,1);
  await fs.unlink(path.join(dir,filenames.pdf));
  await assert.rejects(store.documents(),/ENOENT/);
  const fixture=new ExcelJS.Workbook();const sheet=fixture.addWorksheet('派工');
  sheet.addRow(['代碼','日期']);sheet.addRow([123,new Date('2026-06-02T00:00:00Z')]);sheet.getCell('A2').numFmt='000000';
  const file=path.join(dir,'formatted.xlsx');await fixture.xlsx.writeFile(file);
  const parsed=await readWorkbook(file);
  assert.equal(parsed[0].rows[0].fields['代碼'],'000123');assert.equal(parsed[0].rows[0].fields['日期'],'2026-06-02');
}finally{await fs.rm(dir,{recursive:true,force:true});}
const calls=[];
const pdf=await extractPdf('/fake/scanned.pdf',{run:async(command,args)=>{
  calls.push([command,args]);
  if(command==='pdftotext'){await fs.writeFile(args.at(-1),'\f');return {stdout:''};}
  if(command==='pdfinfo')return {stdout:'Pages: 1\n'};
  if(command==='tesseract')return {stdout:'工單 PY252-0059 設備 SN 00123456'};
  return {stdout:''};
}});
assert.equal(pdf.extraction,'ocr');assert.ok(pdf.text.includes('需核對原件'));
assert.equal(calls.find(([c])=>c==='tesseract')[1][3],'chi_tra+eng');
const textPdf=await extractPdf('/fake/text.pdf',{run:async(command,args)=>{assert.equal(command,'pdftotext');await fs.writeFile(args.at(-1),'已有文字層的 PDF 工單文件，保留 SN：00123456。');return {stdout:''};}});
assert.equal(textPdf.extraction,'pdf_text');
console.log('PASS actual Word and all four Excel sheets, prompt refresh, full work-order listing, formatting, extraction cache, missing-file errors and scanned/text PDF branches');

if(process.env.TEST_HTTP==='1'){
  const server=createKnowledgeServer({health:async()=>({status:'ok'}),documents:async()=>({documents:[{source:'prompt.csv',text:'維修 SOP'}]}),workOrders:async()=>({source:'CSD資料庫.xlsx',count:1,work_orders:[{row:2,fields:{'派工單號':'YCS-16860'}}]})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    assert.equal((await (await fetch(base+'/health')).json()).status,'ok');
    assert.equal((await (await fetch(base+'/documents')).json()).documents[0].text,'維修 SOP');
    assert.equal((await (await fetch(base+'/work-orders')).json()).work_orders[0].fields['派工單號'],'YCS-16860');
    assert.equal((await fetch(base+'/etc/passwd')).status,404);
    assert.equal((await fetch(base+'/documents',{method:'POST'})).status,405);
  }finally{await new Promise(resolve=>server.close(resolve));}
  console.log('PASS internal HTTP health/documents/work-order endpoints and unsupported paths/methods');
}
