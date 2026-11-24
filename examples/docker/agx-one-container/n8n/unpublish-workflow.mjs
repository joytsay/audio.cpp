import {createRequire} from 'node:module';

// Use n8n's API for startup maintenance so its running webhook registry
// stays synchronized. Temporary scoped keys are removed after each operation.
export async function withN8nApi(scopes,run,{apiUrl='http://127.0.0.1:5678',expiresIn=120}={}){
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
      expiresAt:Math.floor(Date.now()/1000)+expiresIn,
      scopes,
    });
    return await run(async (route,body,method) => {
      const response=await fetch(`${apiUrl}/api/v1${route}`,{
        method:method||(body===undefined?'GET':'POST'),headers:{'X-N8N-API-KEY':key.apiKey,'Content-Type':'application/json'},
        ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000),
      });
      if(!response.ok)throw Object.assign(new Error(`n8n API ${route}: HTTP ${response.status}`),{status:response.status});
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

// Older work_orders tables predate the results column. Rows are never
// rewritten: the IVR engine stores its structured record in results itself.
export async function ensureResultsColumn(api){
 let cursor;
 do{
  const page=await api('/data-tables?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
  for(const table of page.data||[]){
   if(table.name!=='work_orders')continue;
   const route='/data-tables/'+encodeURIComponent(table.id)+'/columns';
   const response=await api(route),columns=response.data||response;
   if(!columns.some(c=>c.name==='results'))await api(route,{name:'results',type:'string'});
  }
  cursor=page.nextCursor;
 }while(cursor);
}
export const tableUpgradeScopes=['dataTable:list','dataTableColumn:read','dataTableColumn:create'];
export async function upgradeResultsColumn(){
 return withN8nApi(tableUpgradeScopes,ensureResultsColumn);
}
