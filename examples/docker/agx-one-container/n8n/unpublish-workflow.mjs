import {reportDraft} from '../knowledge/conversation.mjs';
import {promises as fs} from 'node:fs';
import {createRequire} from 'node:module';

// Use n8n's API for startup maintenance so its running webhook registry
// stays synchronized. Temporary scoped keys are removed after each operation.
export async function withN8nApi(scopes,run,{apiUrl='http://127.0.0.1:5678'}={}){
  const require=createRequire('/usr/local/lib/node_modules/n8n/package.json');
  require('reflect-metadata');
  const {Container}=require('@n8n/di');
  const {DbConnection,ApiKeyRepository,UserRepository}=require('@n8n/db');
  const {JwtService}=require('@n8n/backend-services');
  const {PublicApiKeyService}=require('/usr/local/lib/node_modules/n8n/dist/services/public-api-key.service.js');
  const db=Container.get(DbConnection);
  let key,repository;
  try{
    await db.init();
    repository=Container.get(ApiKeyRepository);
    const user=await Container.get(UserRepository).findOne({where:{role:{slug:'global:owner'}},relations:{role:true}});
    if(!user)throw new Error('Cannot manage the IVR workflow without an n8n owner');
    const service=new PublicApiKeyService(repository,Container.get(JwtService),null,console);
    key=await service.createPublicApiKeyForUser(user,{
      label:`Temporary workflow ID migration ${Date.now()}`,
      expiresAt:Math.floor(Date.now()/1000)+120,
      scopes,
    });
    return await run(async (route,body,method) => {
      const response=await fetch(`${apiUrl}/api/v1${route}`,{
        method:method||(body===undefined?'GET':'POST'),headers:{'X-N8N-API-KEY':key.apiKey,'Content-Type':'application/json'},
        ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000),
      });
      if(!response.ok)throw new Error(`n8n API ${route}: HTTP ${response.status}`);
      const raw=await response.text();return raw?JSON.parse(raw):null;
    });
  }finally{
    try{if(key&&repository)await repository.delete({id:key.id});}
    finally{await db.close();}
  }
}

export async function unpublishWorkflow(workflowId,options){
  return withN8nApi(['workflow:deactivate'],api=>api(`/workflows/${encodeURIComponent(workflowId)}/unpublish`,{}),options);
}

export function repairTableRow(row){
 let transcripts=[];try{transcripts=JSON.parse(row.transcripts||'[]');}catch{}
 if(!Array.isArray(transcripts)||transcripts.some(t=>typeof t!=='string'))return {};
 let oldResults={};try{oldResults=JSON.parse(row.results||'{}')||{};}catch{}
 const stamp=row.createdAt?new Date(row.createdAt):new Date();
 const draft=reportDraft(transcripts,Number.isNaN(stamp.getTime())?new Date():stamp);
 const current=name=>String(row[name]??'');
 const fields={
  派工單號:current('reference_number')||draft?.fields.工單編號||oldResults.fields?.派工單號||current('order_id'),
  派工日期:(current('dispatch_date')||draft?.date||oldResults.fields?.派工日期||'').replaceAll('-','/'),
  維修內容:current('maintenance_items')||draft?.fields.維修項目||oldResults.fields?.維修內容||'',
  FAN數量:draft?.fanQuantity?Number(draft.fanQuantity):(oldResults.fields?.FAN數量??''),
  備註:current('notes')||oldResults.fields?.備註||'',
  起機測試:current('test_result')||oldResults.fields?.起機測試||'',
  ...(draft?.fanItems?.length>1?{FAN明細:draft.fanItems}:{}),
 };
 const data={quantity:draft?.fanQuantity||current('quantity'),equipment_number:draft?.fields.設備編號||current('equipment_number'),reference_number:current('reference_number')||draft?.fields.工單編號||'',results:JSON.stringify({transcripts,fields})};
 return Object.fromEntries(Object.entries(data).filter(([key,value])=>String(row[key]??'')!==value));
}
export async function ensureResultsColumn(api,{backupDir='/home/node/.n8n/ivr-workflow-backups'}={}){
 let cursor;
 do{
  const page=await api('/data-tables?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
  for(const table of page.data||[]){
   if(table.name!=='work_orders')continue;
   const root='/data-tables/'+encodeURIComponent(table.id),route=root+'/columns';
   const response=await api(route),columns=response.data||response;
   const rows=[];let rowCursor;
   do{
    const page=await api(root+'/rows?limit=100'+(rowCursor?'&cursor='+encodeURIComponent(rowCursor):''));
    rows.push(...page.data);rowCursor=page.nextCursor;
   }while(rowCursor);
   const pending=rows.some(row=>Object.keys(repairTableRow(row)).length);
   if(pending){
    await fs.mkdir(backupDir,{recursive:true});
    await fs.writeFile(`${backupDir}/work-orders-repair-${table.id}-${Date.now()}.json`,JSON.stringify({table,columns,rows}),{mode:0o600});
   }
   if(!columns.some(c=>c.name==='results'))await api(route,{name:'results',type:'string'});
   for(const row of rows){
    const data=repairTableRow(row);
    if(Object.keys(data).length)await api(root+'/rows/update',{filter:{type:'and',filters:[{columnName:'id',condition:'eq',value:row.id}]},data,returnData:false},'PATCH');
   }
  }
  cursor=page.nextCursor;
 }while(cursor);
}
export const tableUpgradeScopes=['dataTable:list','dataTableColumn:read','dataTableColumn:create','dataTableRow:read','dataTableRow:update'];
export async function upgradeResultsColumn(){
 return withN8nApi(tableUpgradeScopes,ensureResultsColumn);
}
