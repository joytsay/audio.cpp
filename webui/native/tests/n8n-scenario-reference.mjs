import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {runInNewContext} from 'node:vm';
import {createScenarioManager,createScenarioServer} from '../../../examples/docker/agx-one-container/n8n/scenario-workflows.mjs';

const base=new URL('../../../examples/docker/agx-one-container/n8n/',import.meta.url);
const workflow=JSON.parse(await readFile(new URL('workflow.json',base)));
const nodes=new Map(workflow.nodes.map(node=>[node.name,node]));
const next=name=>workflow.connections[name].main.map(branch=>branch[0].node);
assert.deepEqual(next('Load knowledge files'),['Search imported tables?']);
assert.deepEqual(next('Search imported tables?'),['Look up scenario records','Prepare guidance']);
assert.deepEqual(next('Look up scenario records'),['Return scenario records']);
assert.deepEqual(next('Prepare agent context'),['Scenario lookup result?']);
assert.deepEqual(next('Scenario lookup result?'),['Prepare IVR output','AI Agent']);

const tables=[
 {name:'CSD資料庫_派工',sheet:'派工',headers:['派工單號','派工項目','負責人','派工日期'],records:[]},
 {name:'CSD資料庫_客戶設備',sheet:'客戶設備',headers:['廠區','設備','客戶名稱','SN'],records:[]},
 {name:'CSD資料庫_設備類型',sheet:'設備類型',headers:['設備','型號'],records:[]},
 {name:'CSD資料庫_通訊錄',sheet:'通訊錄',headers:['工號','姓名','部門名稱','分機/電話'],records:[]},
];
const resource={ready:true,tables:['dispatch-table','equipment-table','types-table','directory-table'].map(id=>({id}))};
let item='更換風扇';
let date='202611/02',dateUpdates=0;
const readRoutes=[];
const manager=createScenarioManager({knowledgeUrl:'http://knowledge.test',withApi:async(scopes,run)=>{
 assert.deepEqual(scopes,scopes.includes('dataTableRow:update')?['dataTableRow:read','dataTableRow:update']:['dataTableRow:read']);
 return run(async (route,body,method)=>{
  if(route==='/data-tables/dispatch-table/rows/update'){
   assert.deepEqual(scopes,['dataTableRow:read','dataTableRow:update']);
   assert.equal(method,'PATCH');
   assert.deepEqual(body,{
    filter:{type:'and',filters:[{columnName:'dispatch_date',condition:'eq',value:'202611/02'}]},
    data:{dispatch_date:'2026/11/02'},returnData:false,
   });
   date=body.data.dispatch_date;
   dateUpdates++;
   return {};
  }
  readRoutes.push(route);
  if(route==='/data-tables/dispatch-table/rows?limit=100'){
   return {data:[{id:1,dispatch_number:'YCS-168660',dispatch_item:'不相符'}],nextCursor:'next/page'};
  }
  if(route==='/data-tables/dispatch-table/rows?limit=100&cursor=next%2Fpage'){
   return {data:[
    {id:2,dispatch_number:'ycs-16866',dispatch_item:item},
    {id:3,assigned_to:'黃思翰',dispatch_date:'202602/30'},
    {id:4,dispatch_number:'YCS-16861',dispatch_date:date,dispatch_item:'備註 202611/02'},
    {id:5,dispatch_number:'YCS-16862',dispatch_item:'五年一維'},
   ]};
  }
  if(route==='/data-tables/equipment-table/rows?limit=100'){
   return {data:[
    {id:1,site:'F20P10',equipment:'錯誤設備',customer_name:'臺積電',SN:'147787880'},
    {id:2,site:'F20P2',equipment:'F20P1 錯誤設備'},
    {id:3,site:'F20P1',equipment:'測試設備',customer_name:'臺積電',SN:'SN:14778788'},
    {id:4,site:'F20P1',equipment:'其他客戶設備',customer_name:'其他客戶'},
   ]};
  }
  if(route==='/data-tables/types-table/rows?limit=100'){
   return {data:[{id:1,equipment:'EF',model:'測試型號'}]};
  }
  assert.equal(route,'/data-tables/directory-table/rows?limit=100');
  return {data:[
   {id:1,employee_number:'101008570',name:'黃思翰明',department_name:'其他部門'},
   {id:2,employee_number:'10100857',name:'黃思翰',department_name:'測試部門',extension_phone:'0123'},
  ]};
 });
}});

const fetchBefore=globalThis.fetch;
globalThis.fetch=async url=>{
 if(url==='http://knowledge.test/scenarios'){
  return Response.json({scenarios:[{id:'dispatch',name:'CSD資料庫',tool:'scenario_dispatch',tables},{id:'legacy'}]});
 }
 assert.equal(url,'http://knowledge.test/scenario-imports/dispatch');
 return Response.json({dataset:{tables},resources:resource});
};
const server=createScenarioServer(manager);
const lookup=payload=>new Promise((resolve,reject)=>{
 const request=Readable.from([JSON.stringify(payload)]);
 Object.assign(request,{method:'POST',url:'/lookup-records'});
 const response={
  setHeader(){},
  writeHead(status){reject(new Error(`Lookup returned HTTP ${status}`));return this;},
  end(body){resolve(JSON.parse(body));},
 };
 server.emit('request',request,response);
});
try{
 const result=await lookup({reference:'YCS-16866'});
 assert.equal(result.matched_rows,1);
 assert.equal(result.records[0].fields.派工項目,'更換風扇');
 item='檢查電源';
 assert.equal((await lookup({reference:'YCS-16866'})).records[0].fields.派工項目,item);
 const miss=await lookup({reference:'YCS-99999'});
 assert.equal(miss.matched_rows,0);
 await assert.rejects(manager.lookupRecords({reference:'全部'}),/Invalid scenario lookup/);

 const run=(name,input,context)=>runInNewContext(`(function(){${nodes.get(name).parameters.jsCode}})()`,{
  $input:{first:()=>({json:input})},$:node=>({first:()=>({json:context[node]})}),
 })[0].json;
 const reply=(loaded,matches,decision={})=>{
  const facts=run('Return scenario records',matches,{'Load knowledge files':loaded});
  const context=run('Prepare agent context',{content:[{text:JSON.stringify(facts)}]},{
   'Prepare IVR input':{text:'查詢測試'},
   'Register caller turn':{tool:'retrieve_knowledge',...decision},
  });
  return run('Prepare IVR output',context,{
   'Prepare agent context':context,
  }).reply;
 };
 const workOrderReply=(reference,matches)=>{
  const decision={selection:'details',view:'details',reference};
  return reply({result:{...decision,work_orders:[]}},matches,decision);
 };
 assert.equal(workOrderReply('YCS-16866',result),'YCS-16866（CSD資料庫_派工）：派工項目 更換風扇。');
 assert.equal(workOrderReply('YCS-99999',miss),'沒有查到 YCS-99999 的工單。');
 const compactDate=await lookup({reference:'YCS-16861'});
 assert.equal(compactDate.records[0].fields.派工日期,'2026/11/02');
 assert.equal(compactDate.records[0].fields.派工項目,'備註 202611/02');
 assert.match(workOrderReply('YCS-16861',compactDate),/派工日期 2026\/11\/02/);
 assert.equal(date,'202611/02','lookup leaves stored rows unchanged');
 await manager.repairDispatchDates();
 await manager.repairDispatchDates();
 assert.equal(dateUpdates,1,'date repair is idempotent');
 assert.equal(date,'2026/11/02');

 const site={kind:'site',term:'F20P1'};
 const foundSite=await lookup({lookup:site});
 assert.equal(foundSite.matched_rows,2);
 assert.match(reply({scenario_lookup:site},foundSite),/F20P1.*測試設備.*臺積電/);
 const person={kind:'keyword',term:'黃思翰'};
 const foundPerson=await lookup({lookup:person});
 assert.equal(foundPerson.records[0].fields.姓名,'黃思翰');
 assert.equal(foundPerson.records[1].fields.派工日期,'202602/30','invalid dates are preserved');
 assert.equal(foundPerson.matched_rows,2);
 assert.match(reply({scenario_lookup:person},foundPerson),/黃思翰.*通訊錄.*測試部門.*0123/);
 assert.equal((await lookup({lookup:{...person,kind:'person'}})).matched_rows,1);
 const unknown={kind:'site',term:'F90P9'};
 assert.equal(reply({scenario_lookup:unknown},await lookup({lookup:unknown})),'沒有查到 F90P9 的資料。');

 const decisions=[
  [{kind:'serial',term:'14778788'},/SN 14778788.*客戶設備.*測試設備/],
  [{kind:'customer_site',term:'F20P1',customer:'台積電'},/台積電 F20P1.*客戶設備.*測試設備/],
  [{kind:'employee',term:'10100857'},/員工編號 10100857.*通訊錄.*黃思翰/],
  [{kind:'keyword',term:'EF',sheet:'設備類型'},/EF.*設備類型.*測試型號/],
 ];
 for(const [query,answer] of decisions){
  const matches=await lookup({lookup:query});
  assert.equal(matches.matched_rows,1);
  assert.match(reply({scenario_lookup:query},matches),answer);
 }
 assert.match(workOrderReply('YCS-16862',await lookup({reference:'YCS-16862'})),/YCS-16862.*五年一維/);
 const catalog={kind:'catalog',term:'CSD'};
 const readsBefore=readRoutes.length;
 const available=await lookup({lookup:catalog});
 assert.equal(readRoutes.length,readsBefore,'catalog reads workbook metadata');
 assert.match(reply({scenario_lookup:catalog},available),/CSD 可查詢.*派工.*客戶設備.*設備類型.*通訊錄/);
 const generic=run('Prepare IVR output',{output:'<信息>'},{
  'Prepare agent context':{facts:{passages:[]},executed_tool:'retrieve_knowledge'},
 });
 assert.equal(generic.reply,'目前沒有足夠的資料回答這個問題。');
}finally{
 globalThis.fetch=fetchBefore;
}
console.log('PASS direct work-order, site and employee lookups using imported tables');
