import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {workOrderSelection,filenames,createKnowledgeStore,readWorkbook,extractPdf,createKnowledgeServer} from './server.mjs';
import {createWorkOrderStore} from './work-orders.mjs';
const root=process.env.KNOWLEDGE_TEST_ROOT||new URL('../../../../',import.meta.url).pathname;
const realSheets=await readWorkbook(path.join(root,'CSD資料庫.xlsx'));
assert.deepEqual(realSheets.map(s=>s.name),['派工','客戶設備','設備類型','通訊錄']);
assert.ok(realSheets.every(s=>s.rows.length>0));
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-knowledge-test-'));
try{
 for(const name of Object.values(filenames))await fs.copyFile(path.join(root,name),path.join(dir,name));
 const original=await fs.readFile(path.join(dir,filenames.excel));
 const dataRoot=path.join(dir,'data'),orders=createWorkOrderStore({root:dataRoot});
 let ocrCalls=0;
 const store=createKnowledgeStore({root:dir,orders,pdf:async()=>{ocrCalls++;return {text:'PDF 工單 PY252-0059；OCR 值需核對',extraction:'ocr'};}});
 const [a,b]=await Promise.all([store.documents(),store.documents()]);
 assert.equal(ocrCalls,1);assert.deepEqual(a,b);
 assert.equal(a.format,'qa');assert.ok(a.documents.length>20);
 for(const d of a.documents){assert.equal(d.format,'qa');assert.ok(d.question);assert.ok(d.answer);assert.ok(d.text.startsWith('Q: '));assert.ok(d.text.includes('\nA: '));assert.ok(d.text.includes(d.source));}
 assert.deepEqual(new Set(a.documents.map(d=>d.source)),new Set([filenames.word,filenames.excel,filenames.pdf]));
 assert.ok(a.documents.some(d=>d.section==='情境 2：工單回報'&&d.answer.includes('SN')));
 assert.ok(a.documents.some(d=>d.source===filenames.pdf&&d.review==='visually_verified'));
 assert.deepEqual(new Set(a.documents.filter(d=>d.source===filenames.excel).map(d=>d.sheet)),new Set(realSheets.map(s=>s.name)));
 const latest=await store.documents('列出最新工單');
 assert.equal(latest.result.selection,'newest');
 const oldest=await store.documents('我要查詢最舊的工單。');
 assert.equal(oldest.result.selection,'oldest');
 assert.notEqual(oldest.result.work_orders[0].fields['派工日期'],latest.result.work_orders[0].fields['派工日期']);
 assert.equal(ocrCalls,1,'fresh structured lookups do not invoke PDF OCR');
 assert.ok(!latest.documents.some(d=>d.source!==filenames.excel));
 const sessionId='single-followup';
 const opener=orders.register({sessionId,text:'我增加工单。'});
 assert.equal(opener.tool,'retrieve_knowledge');assert.equal(opener.report_reply.match(/？/g).length,1);
 assert.ok(opener.report_reply.includes('日期')&&opener.report_reply.includes('編號')&&opener.report_reply.includes('數量'));
 await assert.rejects(orders.prepare(sessionId),/追問/);
 const details='二零二六年十一月十二号，名称是台积电，工单名称，呃设备编号是一二三四，维修项目五六七八，数量八个。';
 assert.equal(orders.register({sessionId,text:details}).tool,'add_work_order');
 const row=await orders.prepare(sessionId);
 assert.equal(row.dispatch_date,'2026-11-12');assert.equal(row.equipment_number,'1234');assert.equal(row.maintenance_items,'5678');assert.equal(row.quantity,'8個');
 assert.equal(row.test_result,'');assert.deepEqual(JSON.parse(row.transcripts),['我增加工单。',details]);
 assert.equal((await orders.prepare(sessionId)).report_key,row.report_key,'retries produce the same Data Table upsert key');
 await assert.rejects(fs.access(path.join(dataRoot,'work-orders.json')),/ENOENT/);
 assert.deepEqual(await fs.readFile(path.join(dir,filenames.excel)),original);
 const incomplete='partial';orders.register({sessionId:incomplete,text:'我增加工单。'});
 assert.equal(orders.register({sessionId:incomplete,text:'不知道。'}).tool,'add_work_order');
 const partial=await orders.prepare(incomplete);
 assert.equal(partial.dispatch_date,'');assert.equal(partial.equipment_number,'');assert.equal(partial.quantity,'');assert.equal(partial.maintenance_items,'');
 const repeatedPrefix='prefix';orders.register({sessionId:repeatedPrefix,text:'我要回報工單。'});
 assert.equal(orders.register({sessionId:repeatedPrefix,text:'我要回報工單，2026年11月12日設備XYZ維修。'}).tool,'add_work_order');
 const prefixRow=await orders.prepare(repeatedPrefix);assert.equal(prefixRow.dispatch_date,'2026-11-12');
 const numberOnly='number-only';orders.register({sessionId:numberOnly,text:'我增加工单。'});
 assert.equal(orders.register({sessionId:numberOnly,text:'编号是零零一二三四。'}).tool,'add_work_order');
 const numbered=await orders.prepare(numberOnly);assert.equal(numbered.reference_number,'001234');assert.equal(numbered.dispatch_date,'');
 const cancelled='cancel';orders.register({sessionId:cancelled,text:'我增加工单。'});orders.register({sessionId:cancelled,text:'取消回報。'});
 await assert.rejects(orders.prepare(cancelled),/取消/);
 const record={id:row.order_id,source:'n8n Data Table / work_orders',fields:{派工單號:row.order_id,派工日期:row.dispatch_date,設備編號:row.equipment_number}};
 const stored=await store.documents('最新工單 2026年11月',[record]);
 assert.equal(stored.result.work_orders[0].fields.派工單號,row.order_id);
 const savedDecision=orders.register({sessionId,text:'可以列出最旧的工单吗？'});assert.equal(savedDecision.selection,'oldest');
 assert.equal(orders.register({sessionId,text:'最新的工单，帮我列出来。'}).selection,'newest');
 const followup=orders.register({sessionId,text:'二零二六年十一月的。'});assert.equal(followup.period,'2026-11');assert.equal(followup.selection,'newest');
 await assert.rejects(orders.prepare(sessionId),/追問/,'a lookup must never authorize a save');
 if(process.env.TEST_HTTP==='1'){
  const server=createKnowledgeServer(store);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const post=(url,data)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  try{
   assert.equal((await fetch(base+'/health')).status,200);
   assert.deepEqual((await (await fetch(base+'/work-orders')).json()).work_orders,[]);
   assert.equal((await post('/work-orders',{sessionId})).status,405,'JSON writes are retired');
   assert.equal((await post('/work-order-draft',{sessionId:'missing'})).status,400);
   assert.equal((await post('/work-order-draft',{sessionId:incomplete})).status,200);
   const docs=await (await post('/documents',{query:'最新工單 2026年11月',records:[record]})).json();
   assert.equal(docs.result.work_orders[0].fields.派工單號,row.order_id);
   assert.equal((await post('/documents',{query:'最新工單',records:[{}]})).status,400);
   for(const method of ['PATCH','PUT','DELETE'])assert.equal((await fetch(base+'/work-orders',{method})).status,405);
   assert.equal((await fetch(base+'/etc/passwd')).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
 }
 // Old JSON remains a read-only source; native Data Table rows override matching IDs.
 await fs.mkdir(dataRoot);const legacy=[{id:'LEGACY-1',source:'本機新增工單',fields:{派工單號:'LEGACY-1',派工日期:'2026-11-01'}}];
 await fs.writeFile(path.join(dataRoot,'work-orders.json'),JSON.stringify(legacy));
 assert.equal((await store.documents('全部工單')).result.work_orders.some(r=>r.fields.派工單號==='LEGACY-1'),true);
 const override={...legacy[0],source:'n8n Data Table / work_orders',fields:{派工單號:'LEGACY-1',派工日期:'2026-11-15'}};
 const merged=await store.documents('最新工單 2026年11月',[override]);assert.equal(merged.result.work_orders[0].fields.派工日期,'2026-11-15');
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataRoot,'work-orders.json'),'utf8')),legacy);
 const fixture=new ExcelJS.Workbook();const sheet=fixture.addWorksheet('派工');sheet.addRow(['代碼','日期']);sheet.addRow([123,new Date('2026-06-02T00:00:00Z')]);sheet.getCell('A2').numFmt='000000';
 const file=path.join(dir,'formatted.xlsx');await fixture.xlsx.writeFile(file);const parsed=await readWorkbook(file);
 assert.equal(parsed[0].rows[0].fields['代碼'],'000123');assert.equal(parsed[0].rows[0].fields['日期'],'2026-06-02');
 await fs.unlink(path.join(dir,filenames.pdf));await assert.rejects(store.documents('維修流程'),/ENOENT/);
}finally{await fs.rm(dir,{recursive:true,force:true});}
console.log('PASS source-grounded Q/A for three original documents, fresh newest/oldest selections, single follow-up, deterministic native-table row preparation with optional fields, retry keys, read-only legacy recovery, original-file integrity and HTTP validation');
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
console.log('PASS actual Word and all four tables from the original XLSX, prompt refresh, formatting, extraction cache, missing-file errors and scanned/text PDF branches');

const synthetic=[{name:'派工',rows:[{row:2,fields:{派工單號:'TEST-A',派工日期:'2026-11-02'}},{row:3,fields:{派工單號:'TEST-B',派工日期:'2026-10-01'}},{row:4,fields:{派工單號:'TEST-C',派工日期:'2026-11-02'}},{row:5,fields:{派工單號:'TEST-D',派工日期:'2026-02-30'}}]}];
assert.deepEqual(workOrderSelection('列出最新工單',synthetic).work_orders.map(r=>r.fields.派工單號),['TEST-A','TEST-C']);
assert.deepEqual(workOrderSelection('最舊的呢',synthetic).work_orders.map(r=>r.fields.派工單號),['TEST-B']);
assert.equal(workOrderSelection('列出所有工單',synthetic).selected_count,4);
assert.equal(workOrderSelection('工單回報流程是什麼？',synthetic),undefined);
console.log('PASS read-only RAG work-order facts: date selection, ties, invalid dates, all rows and no reporting-rule contamination');

const periods=[{name:'派工',rows:[{row:1,fields:{派工單號:'OCT',派工日期:'2026-10-30'}},{row:2,fields:{派工單號:'NOV-FIRST',派工日期:'2026-11-02'}},{row:3,fields:{派工單號:'NOV-LAST',派工日期:'2026-11-12'}},{row:4,fields:{派工單號:'UNKNOWN',派工日期:''}}]}];
assert.equal(workOrderSelection('可以列出最旧的工单吗？',periods).work_orders[0].fields.派工單號,'OCT');
assert.equal(workOrderSelection('直接找出這個月最舊的工單',periods,{now:new Date('2026-11-12T04:00:00Z')}).work_orders[0].fields.派工單號,'NOV-FIRST');
assert.equal(workOrderSelection('最新的工单，帮我列出来。二零二六年十一月',periods).work_orders[0].fields.派工單號,'NOV-LAST');
console.log('PASS split spoken-number reports, one-question intake without further confirmation, simplified Chinese lookups, real month filtering and date-only follow-ups');

const compactDates=[{name:'派工',rows:[{row:1,fields:{派工單號:'ISO',派工日期:'2026-11-04'}},{row:2,fields:{派工單號:'COMPACT',派工日期:'202611/06'}}]}];
const compactLatest=workOrderSelection('最新工單',compactDates);
assert.equal(compactLatest.work_orders[0].fields.派工單號,'COMPACT');
assert.equal(compactLatest.work_orders[0].fields.派工日期,'2026-11-06');
assert.equal(compactLatest.work_orders[0].original_dispatch_date,'202611/06');
assert.equal(compactDates[0].rows[1].fields.派工日期,'202611/06','sorting does not mutate source data');
console.log('PASS compact spreadsheet date normalization with preserved original values');
