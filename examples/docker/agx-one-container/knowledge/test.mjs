import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {workOrderSelection,filenames,createKnowledgeStore,readWorkbook,extractPdf,createKnowledgeServer} from './server.mjs';
import {createWorkOrderStore} from './work-orders.mjs';
import {callDecision} from './conversation.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ivr-knowledge-test-'));
try{
 // Generate fixtures locally; production no longer ships scenario documents.
 const fixtureBook=new ExcelJS.Workbook();
 for(const name of ['派工','客戶設備','設備類型','通訊錄']){
  const sheet=fixtureBook.addWorksheet(name);sheet.addRow(['派工單號','派工日期','負責人']);
  for(let i=1;i<=6;i++)sheet.addRow([`TEST-${name}-${i}`,`2026-10-0${i}`,'測試人員']);
 }
 await fixtureBook.xlsx.writeFile(path.join(dir,filenames.excel));
 const docx=new JSZip();
 docx.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 docx.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 docx.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>情境 2：工單回報</w:t></w:r></w:p><w:p><w:r><w:t>Q: 測試聯絡方式？</w:t></w:r></w:p><w:p><w:r><w:t>A: 分機 1234。</w:t></w:r></w:p></w:body></w:document>');
 await fs.writeFile(path.join(dir,filenames.word),await docx.generateAsync({type:'nodebuffer'}));
 await fs.writeFile(path.join(dir,filenames.pdf),'%PDF-1.4\nTest fixture for mocked PDF extraction.');
 const realSheets=await readWorkbook(path.join(dir,filenames.excel));
 const empty=createKnowledgeStore({orders:createWorkOrderStore({root:path.join(dir,'empty-orders')}),scenarioRoot:path.join(dir,'empty-scenarios')});
 assert.deepEqual(await empty.health(),{status:'ok',scenarios:0,files:[]});
 assert.deepEqual(await empty.documents(),{documents:[],format:'qa'});
 assert.equal((await empty.documents('最新工單')).result.selected_count,0);
 assert.equal((await empty.documents('保固多久？')).documents[0].answer,'目前尚未上傳情境文件。');
 const referenceQuery=callDecision(['YCS-16866 的內容']);
 assert.equal(referenceQuery.reference,'YCS-16866');
 assert.equal(callDecision(['查詢 YCS-16866']).reference,'YCS-16866');
 assert.equal(callDecision(['YCS-16862']).reference,'YCS-16862');
 assert.equal(callDecision(['我要新增工單。','YCS-16862']).tool,'add_work_order');
 const nearOrder={id:'near',fields:{派工單號:'YCS-168660'}};
 const exactOrder={id:'exact',fields:{派工單號:'ycs-16866',派工項目:'更換風扇'}};
 const fallback=await empty.documents(referenceQuery.query,[nearOrder]);
 assert.equal(fallback.result.selected_count,0);
 assert.equal(fallback.scenario_reference,'YCS-16866');
 const native=await empty.documents(referenceQuery.query,[nearOrder,exactOrder]);
 assert.equal(native.scenario_reference,undefined);
 assert.equal(native.result.work_orders[0].fields.派工項目,'更換風扇');
 for(const [query,lookup] of [
  ['查尋F20P1廠區',{kind:'site',term:'F20P1'}],
  ['查詢 黃思翰',{kind:'keyword',term:'黃思翰'}],
  ['查詢員工 黃思翰？',{kind:'person',term:'黃思翰'}],
  ['CSD 可以查詢什麼',{kind:'catalog',term:'CSD'}],
  ['查詢 SN 14778788',{kind:'serial',term:'14778788'}],
  ['查 台積電 F20P1',{kind:'customer_site',term:'F20P1',customer:'台積電'}],
  ['查員工編號10100857',{kind:'employee',term:'10100857'}],
  ['查設備類型 EF',{kind:'keyword',term:'EF',sheet:'設備類型'}],
 ]){
  const decision=callDecision(['我要新增工單。',query]);
  assert.equal(decision.intent,'lookup');
  assert.deepEqual((await empty.documents(decision.query)).scenario_lookup,lookup);
 }
 assert.ok((await empty.documents('查詢保固')).documents.length,'document questions keep the Q/A path');
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
 assert.deepEqual(new Set(a.documents.filter(d=>d.source===filenames.excel).map(d=>d.sheet)),new Set(realSheets.map(s=>s.name)));
 const latest=await store.documents('列出最新工單');
 assert.equal(latest.result.selection,'newest');
 const oldest=await store.documents('我要查詢最舊的工單。');
 assert.equal(oldest.result.selection,'oldest');
 assert.notEqual(oldest.result.work_orders[0].fields['派工日期'],latest.result.work_orders[0].fields['派工日期']);
 assert.equal(ocrCalls,1,'fresh structured lookups do not invoke PDF OCR');
 assert.ok(!latest.documents.some(d=>d.source!==filenames.excel));
 const scenarioRoot=path.join(dir,'uploaded-scenarios');
 const scenarioStore=createKnowledgeStore({root:dir,orders,scenarioRoot,pdf:async()=>({text:'測試 PDF 的服務時間為星期三。',extraction:'pdf_text'})});
 const encoded=(name,text)=>({name,data:Buffer.from(text).toString('base64')});
 const upload={name:'LAB-ZETA 服務',files:[encoded('服務.txt','Q: LAB-ZETA 包材何時回收？\nA: LAB-ZETA 每週三回收，聯絡分機 7654。'),encoded('保固.md','# LAB-ZETA 保固\nLAB-ZETA 維修保固為十二個月。')]};
 const scenario=await scenarioStore.addScenario(upload);
 assert.ok(scenario.scenario.qaCount>=2);assert.equal(scenario.duplicate,false);
 assert.deepEqual((await scenarioStore.listScenarios()).map(s=>s.name),['LAB-ZETA 服務']);
 assert.equal((await scenarioStore.addScenario(upload)).duplicate,true);
 await assert.rejects(scenarioStore.addScenario({...upload,files:[encoded('其他.txt','不同內容。')]}),/already exists/);
 await assert.rejects(scenarioStore.addScenario({name:'bad',files:[encoded('../bad.txt','unsafe')]}),/Supported files/);
 await assert.rejects(scenarioStore.addScenario({name:'bad',files:[{name:'bad.txt',data:'invalid-base64'}]}),/Invalid/);
 const loadedAfterRestart=createKnowledgeStore({root:dir,orders,scenarioRoot,pdf:async()=>({text:'測試 PDF 的服務時間為星期三。',extraction:'pdf_text'})});
 assert.equal((await loadedAfterRestart.listScenarios())[0].id,scenario.scenario.id);
 const uploadedKnowledge=await loadedAfterRestart.documents('LAB-ZETA 包材何時回收');
 assert.ok(uploadedKnowledge.documents.some(d=>d.source==='服務.txt'&&d.answer.includes('7654')));
 assert.ok(uploadedKnowledge.documents.some(d=>d.source==='保固.md'&&d.answer.includes('十二個月')));
 for(const extension of ['word','excel']){
  const filename=filenames[extension];
  const added=await scenarioStore.addScenario({name:'Office '+extension,files:[{name:filename,data:(await fs.readFile(path.join(dir,filename))).toString('base64')}]});
  assert.ok(added.scenario.qaCount>0);
 }
 const corruptedOffice=Buffer.from(await fs.readFile(path.join(dir,filenames.word)));
 for(let at=0;at+46<corruptedOffice.length;at++)if(corruptedOffice.readUInt32LE(at)===0x02014b50&&corruptedOffice.readUInt32LE(at+24)>0){corruptedOffice.writeUInt32LE(0,at+24);break;}
 await assert.rejects(scenarioStore.addScenario({name:'Unsafe archive',files:[{name:'bad.docx',data:corruptedOffice.toString('base64')}]}),/Office archive/);
 const csv='\ufeffQuestion,Answer,Code\r\n"CSV 保固多久？","維修保固十二個月，含零件。\n請保留收據與 ""FAN"" 標籤。",00123\r\n';
 await scenarioStore.addScenario({name:'CSV Q/A',files:[encoded('保固.CSV',csv)]});
 await scenarioStore.addScenario({name:'CSV records',files:[encoded('設備.csv','設備編號,數量\n000456,02\n')]});
 await scenarioStore.addScenario({name:'CSV 中文 Q/A',files:[encoded('問題.csv','問題,答案\n服務時間？,星期三下午\n')]});
 const csvDocuments=(await loadedAfterRestart.documents('CSV 保固多久')).documents;
 const csvQa=csvDocuments.find(d=>d.source==='保固.CSV'&&d.question==='CSV 保固多久？');
 assert.ok(csvQa);assert.ok(csvQa.answer.includes('十二個月，含零件。\n請保留收據與 "FAN" 標籤。'));
 assert.ok(csvQa.answer.includes('Code：00123'),'CSV preserves leading zeros and extra columns');
 assert.ok(csvDocuments.some(d=>d.source==='設備.csv'&&d.answer.includes('設備編號：000456；數量：02')));
 assert.ok(csvDocuments.some(d=>d.source==='問題.csv'&&d.question==='服務時間？'&&d.answer.includes('星期三下午')));
 await assert.rejects(scenarioStore.addScenario({name:'Malformed CSV',files:[encoded('broken.csv','Q,A\n"unclosed,answer')]}),/parse|quote/i);
 await assert.rejects(scenarioStore.addScenario({name:'Invalid encoding',files:[{name:'bad.csv',data:Buffer.from([0xff,0xfe,0x41]).toString('base64')}]}),/encod|UTF/i);
 console.log('PASS CSV Q/A and reference rows, UTF-8 BOM, quoted commas/quotes, multiline answers, leading zeros, persistence and malformed-input rejection');
 const pdfScenario=await scenarioStore.addScenario({name:'PDF 文件',files:[{name:'維修.pdf',data:(await fs.readFile(path.join(dir,filenames.pdf))).toString('base64')}]});
 assert.ok(pdfScenario.scenario.qaCount>0);
 // Removing an upload deletes its directory and excludes its Q/A after restart.
 const scenarioIds=(await scenarioStore.listScenarios()).map(item=>item.id);
 await assert.rejects(scenarioStore.removeScenario('../outside'),/Invalid uploaded/);
 await assert.rejects(scenarioStore.removeScenario('maintenance'),/Invalid uploaded/);
 assert.equal((await scenarioStore.removeScenario(scenario.scenario.id)).removed,true);
 await assert.rejects(fs.access(path.join(scenarioRoot,scenario.scenario.id)),{code:'ENOENT'});
 assert.deepEqual((await loadedAfterRestart.listScenarios()).map(item=>item.id),scenarioIds.filter(id=>id!==scenario.scenario.id));
 assert.ok(!(await loadedAfterRestart.documents('LAB-ZETA')).documents.some(document=>document.scenario_id===scenario.scenario.id));
 assert.equal((await scenarioStore.removeScenario(scenario.scenario.id)).alreadyRemoved,true,'removal retries are safe');
 const readd=scenarioStore.addScenario(upload),removeAgain=scenarioStore.removeScenario(scenario.scenario.id);
 assert.equal((await readd).duplicate,false);await removeAgain;
 assert.ok(!(await scenarioStore.listScenarios()).some(item=>item.id===scenario.scenario.id),'add/remove share a queue');
 console.log('PASS uploaded scenario deletion, files/Q/A removal, restart persistence, retry, concurrent add/remove and protection of other sources');
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
 const spaced='spaced-identifier';orders.register({sessionId:spaced,text:'回要回報工單。'});
 const spacedDetails='2026年11月12號 A 一二三四五。';
 assert.equal(orders.register({sessionId:spaced,text:spacedDetails}).tool,'add_work_order');
 const spacedRow=await orders.prepare(spaced);
 assert.equal(spacedRow.reference_number,'A12345');assert.equal(spacedRow.dispatch_date,'2026-11-12');
 assert.equal(JSON.parse(spacedRow.results).fields.派工單號,'A12345');
 const exampleStore=createWorkOrderStore({root:dataRoot,now:()=>new Date('2026-11-12T00:00:00Z')});
 exampleStore.register({sessionId:'sample',text:'我要新增工單。'});
 const example='十一月十二号A一二三五年一维，Fan两个。';
 exampleStore.register({sessionId:'sample',text:example});
 const exampleRow=await exampleStore.prepare('sample');
 assert.equal(exampleRow.reference_number,'A1235');
 assert.deepEqual(JSON.parse(exampleRow.results),{transcripts:['我要新增工單。',example],fields:{派工單號:'A1235',派工日期:'2026/11/12',維修內容:'五年一維',FAN數量:2,備註:'',起機測試:''}});
 const maintenanceSession='equipment-detail-queries';
 const fullReport='我要回報工單，2026年6月2日下午14:00臺積電F15P1/2_ME VFD備品與維修。\nF15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。\nF15P1H4K-GEX-EF-04 五年一維，更換強排FAN 2個、間面FAN 4個。';
 orders.register({sessionId:maintenanceSession,text:fullReport});
 orders.register({sessionId:maintenanceSession,text:'2026年6月2日下午14:00。\nF15P1H4K-GEX-EF-03 五年一維，更換強排FAN 2個、間面FAN 6個。'});
 const equipmentRow=await orders.prepare(maintenanceSession);
 assert.equal(equipmentRow.reference_number,'F15P1/2_ME','never truncate identifiers at / or _');
 assert.ok(equipmentRow.equipment_number.includes('F15P1H4K-GEX-EF-03')&&equipmentRow.equipment_number.includes('F15P1H4K-GEX-EF-04'));
 assert.equal(JSON.parse(equipmentRow.results).fields.FAN數量,14,'deduplicate repeated equipment lines across turns');
 const {fanItems}=await import('./conversation.mjs');
 assert.equal(fanItems(fullReport.replaceAll('\n','')).reduce((sum,item)=>sum+item.數量,0),14,'ASR may omit equipment line breaks');
 const equipmentRecord={id:equipmentRow.order_id,source:'n8n Data Table / work_orders',fields:{...JSON.parse(equipmentRow.results).fields,設備編號:equipmentRow.equipment_number}};
 for(const question of ['最新工單多少','F15P1 呢？','F15P1 工單內容？','可以跟我講F15P1工單內容','最舊工單','FAN幾個','起機測試正常嗎？']){
  const decision=orders.register({sessionId:maintenanceSession,text:question});
  assert.equal(decision.tool,'retrieve_knowledge',question+' must never authorize a save');
  await assert.rejects(orders.prepare(maintenanceSession),/追問/);
  if(question.includes('F15P1')){
   const lookup=await store.documents(decision.query,[equipmentRecord]);
   assert.equal(lookup.result.selection,'details');assert.equal(lookup.result.work_orders.length,1);
   assert.equal(lookup.result.work_orders[0].fields.FAN數量,14);
  }
  if(question==='FAN幾個')assert.equal(decision.view,'fans');
 }
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
   const httpScenario=await store.addScenario({name:'HTTP removal',files:[encoded('http.txt','Q: HTTP topic?\nA: HTTP answer.')]});
   const removed=await fetch(base+'/scenarios/'+httpScenario.scenario.id,{method:'DELETE'});
   assert.equal(removed.status,200);assert.equal((await removed.json()).removed,true);
   assert.ok(!(await store.documents('HTTP topic')).documents.some(document=>document.scenario_id===httpScenario.scenario.id));
   assert.equal((await fetch(base+'/scenarios/not-an-id',{method:'DELETE'})).status,400);

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
 await fs.unlink(path.join(dir,filenames.pdf));assert.ok(!(await store.documents('維修流程')).documents.some(document=>document.source===filenames.pdf));
}finally{await fs.rm(dir,{recursive:true,force:true});}
console.log('PASS source-grounded Q/A with generated document fixtures, fresh newest/oldest selections, single follow-up, deterministic native-table row preparation with optional fields, retry keys, read-only legacy recovery, fixture integrity and HTTP validation');
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
console.log('PASS generated Word and XLSX, empty-store health, formatting, extraction cache, optional missing files and scanned/text PDF branches');

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
