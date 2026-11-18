export type KnowledgeScenario = {
  id: string;
  name: string;
  createdAt: string;
  qaCount: number;
  tool?: string;
  tables?: {name: string; sheet: string; rowCount: number}[];
  files: {name: string; size: number; sha256: string}[];
};
export type ScenarioUploadResult = {scenario: KnowledgeScenario; duplicate: boolean; indexed: boolean; index_error?: string};

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response=await fetch(url,init);
  const raw=await response.text();let body: any;
  try { body=JSON.parse(raw); } catch { /* Report the HTTP status below. */ }
  if(!response.ok||!body){
    const hint=response.status===404?' Update and publish GeoVision · Workflow to manage uploaded scenarios.':'';
    throw new Error(`Scenario workflow failed (${response.status}): ${body?.message||body?.error?.message||body?.error||'No JSON response'}${hint}`);
  }
  return body as T;
}
export async function listKnowledgeScenarios(): Promise<KnowledgeScenario[]> {
  const result=await request<{scenarios: KnowledgeScenario[]}>('/n8n/webhook/ivr-scenarios',{cache:'no-store'});
  if(!Array.isArray(result.scenarios))throw new Error('Invalid saved scenario list');
  return result.scenarios;
}
export async function addKnowledgeScenario(name: string, files: File[], signal: AbortSignal): Promise<ScenarioUploadResult> {
  if(!name.trim()||name.trim().length>120)throw new Error('Enter a scenario name of 1–120 characters.');
  const encoded=await encodeScenarioFiles(files,signal);
  const result=await request<ScenarioUploadResult>('/n8n/webhook/ivr-add-scenario',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),files:encoded}),signal});
  if(!result.scenario?.id||!Number.isInteger(result.scenario.qaCount)||typeof result.indexed!=='boolean')throw new Error('Scenario workflow returned an invalid result.');
  return result;
}

async function encodeScenarioFiles(files: File[],signal: AbortSignal) {
  if(!files.length||files.length>8)throw new Error('Choose 1–8 files.');
  if(files.some(file=>!file.size||!/\.(pdf|docx|xlsx|csv|txt|md)$/i.test(file.name)))throw new Error('Choose PDF, DOCX, XLSX, CSV, TXT or Markdown files.');
  if(files.reduce((sum,file)=>sum+file.size,0)>10*1024*1024)throw new Error('Files must total 10 MiB or less.');
  const encoded=[];
  for(const file of files){
    signal.throwIfAborted();
    const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
    for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    encoded.push({name:file.name,data:btoa(binary)});
  }
  signal.throwIfAborted();
  return encoded;
}

export async function importScenarioFiles(files: File[],signal: AbortSignal,onImport: (scenario: KnowledgeScenario)=>void) {
  for(const file of await encodeScenarioFiles(files,signal)){
    const {scenario}=await request<{scenario: KnowledgeScenario}>('/n8n/webhook/ivr-import-scenario',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(file),signal,
    });
    if(!scenario?.id||!scenario.tool||!scenario.tables?.length)throw new Error(`Import did not complete for ${file.name}.`);
    onImport(scenario);
  }
}

export async function removeKnowledgeScenario(id: string): Promise<void> {
  if(!/^[a-f0-9]{24}$/.test(id))throw new Error('Choose an uploaded scenario to remove.');
  const result=await request<{id: string; removed: boolean}>('/n8n/webhook/ivr-delete-scenario',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),
  });
  if(result.id!==id||result.removed!==true)throw new Error('Scenario workflow did not confirm removal.');
}
