import {createRequire} from 'node:module';

// Run only during an ID migration. Use n8n's API so its running webhook
// registry is updated too; CLI-only unpublishing leaves cached routes alive.
export async function unpublishWorkflow(workflowId,{apiUrl='http://127.0.0.1:5678'}={}){
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
    if(!user)throw new Error('Cannot retire the legacy workflow without an n8n owner');
    const service=new PublicApiKeyService(repository,Container.get(JwtService),null,console);
    key=await service.createPublicApiKeyForUser(user,{
      label:`Temporary workflow ID migration ${Date.now()}`,
      expiresAt:Math.floor(Date.now()/1000)+120,
      scopes:['workflow:deactivate'],
    });
    const response=await fetch(`${apiUrl}/api/v1/workflows/${encodeURIComponent(workflowId)}/unpublish`,{
      method:'POST',headers:{'X-N8N-API-KEY':key.apiKey,'Content-Type':'application/json'},
      body:'{}',signal:AbortSignal.timeout(30000),
    });
    if(!response.ok)throw new Error(`Cannot unpublish legacy workflow ${workflowId}: HTTP ${response.status}`);
  }finally{
    try{if(key&&repository)await repository.delete({id:key.id});}
    finally{await db.close();}
  }
}
