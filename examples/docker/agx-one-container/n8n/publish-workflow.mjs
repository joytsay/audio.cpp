import {withN8nApi} from './unpublish-workflow.mjs';

// Publish through the running server so production webhooks and MCP routes
// become available immediately, including after a versioned template upgrade.
export async function ensureWorkflowPublished(api,workflowId='ivrWorkflow'){
  const route='/workflows/'+encodeURIComponent(workflowId);
  const workflow=await api(route);
  if(workflow.active&&workflow.activeVersionId&&workflow.activeVersionId===workflow.versionId)return false;
  await api(route+'/publish',{});
  const published=await api(route);
  if(!published.active||!published.activeVersionId||published.activeVersionId!==published.versionId)
    throw new Error(`Workflow ${workflowId} did not publish its current version`);
  return true;
}

export async function publishWorkflow(workflowId='ivrWorkflow',options){
  return withN8nApi(['workflow:read','workflow:activate'],api=>ensureWorkflowPublished(api,workflowId),options);
}
