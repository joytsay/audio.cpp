export type KnowledgeScenario = {
  id: string;
  name: string;
  createdAt: string;
  qaCount: number;
  simulation?: boolean;
  examples?: string[];
  // The caller's side of an HTML call script, for the demo's mock call.
  mockCall?: {opening: string[]; sections: {number: number; title: string; outbound: boolean; lines: string[]}[]};
  tables?: {name: string; sheet: string; rowCount: number}[];
  files: {name: string; size: number; sha256: string}[];
  attachments?: {name: string; size: number; sha256: string}[];
};
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
async function encodeFiles(files: File[],signal: AbortSignal) {
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

export async function removeKnowledgeScenario(id: string): Promise<void> {
  if(!/^[a-f0-9]{24}$/.test(id))throw new Error('Choose an uploaded scenario to remove.');
  const result=await request<{id: string; removed: boolean}>('/n8n/webhook/ivr-delete-scenario',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),
  });
  if(result.id!==id||result.removed!==true)throw new Error('Scenario workflow did not confirm removal.');
}

// ── SOP drafts ──────────────────────────────────────────────────────────────
// Every upload is first tidied by the local LLM into one SOP page (agent
// prompt, hotwords, opening, scenarios, knowledge base). The user opens the
// page, then confirms it: the page, its images and its tables are imported.
export type SopDraft = {
  id: string; status: "writing" | "ready" | "failed"; error?: string; url: string; createdAt?: string;
  uploads: string[]; name?: string; page?: string; scenarios?: string[]; hotwords?: number;
  images?: string[]; tables?: string[]; files?: string[];
};
const draftRoot='/knowledge/sop-drafts';
export const sopDraftExtensions=/\.(?:docx|html?|png|jpe?g|gif|md|markdown|csv|xlsx|pdf)$/i;
async function draftRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response=await fetch(url,{cache:'no-store',...init});
  const body=await response.json().catch(()=>undefined);
  if(!response.ok||!body)throw new Error(`SOP draft failed (${response.status}): ${body?.error||'No JSON response'}`);
  return body as T;
}
export const sopDraftPage=(draft: SopDraft)=>`/knowledge/${draft.url}`;
export async function createSopDraft(files: File[],signal: AbortSignal,onProgress: (draft: SopDraft)=>void): Promise<SopDraft> {
  if(!files.length||files.length>8)throw new Error('Choose 1–8 files.');
  if(files.some(file=>!file.size||!sopDraftExtensions.test(file.name)))throw new Error('Choose DOCX, HTML, PDF, Markdown, CSV, XLSX, PNG, JPEG or GIF files.');
  if(files.reduce((sum,file)=>sum+file.size,0)>10*1024*1024)throw new Error('Files must total 10 MiB or less.');
  const encoded=await encodeFiles(files,signal);
  const draft=await draftRequest<SopDraft>(draftRoot,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:encoded}),signal});
  onProgress(draft);
  return waitSopDraft(draft,signal,onProgress);
}
// The LLM writes the page in the background: a long document takes minutes.
// Also resumes a draft after the page is reloaded.
export async function waitSopDraft(draft: SopDraft,signal: AbortSignal,onProgress: (draft: SopDraft)=>void): Promise<SopDraft> {
  while(draft.status==='writing'){
    await new Promise(resolve=>setTimeout(resolve,3000));
    signal.throwIfAborted();
    draft=await draftRequest<SopDraft>(`${draftRoot}/${draft.id}`,{signal});
    onProgress(draft);
  }
  if(draft.status==='failed')throw new Error(`SOP draft failed: ${draft.error||'unknown error'}`);
  return draft;
}
export async function getSopDraft(id: string): Promise<SopDraft> {
  if(!/^[a-f0-9]{24}$/.test(id))throw new Error('Invalid SOP draft ID.');
  return draftRequest<SopDraft>(`${draftRoot}/${id}`);
}
export async function discardSopDraft(id: string): Promise<void> {
  await draftRequest(`${draftRoot}/${id}`,{method:'DELETE'});
}
// Import a checked draft: the page (with its images) and each table.
export async function confirmSopDraft(draft: SopDraft,signal: AbortSignal,onImport: (scenario: KnowledgeScenario)=>void) {
  const bundle=await draftRequest<{documents: {name: string; data: string; attachments?: {name: string; data: string}[]}[]}>(`${draftRoot}/${draft.id}/bundle`,{signal});
  if(!bundle.documents?.length)throw new Error('The SOP draft has nothing to import.');
  for(const document of bundle.documents){
    const {scenario}=await request<{scenario: KnowledgeScenario}>('/n8n/webhook/ivr-import-scenario',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(document),signal,
    });
    if(!scenario?.id||!Array.isArray(scenario.tables))throw new Error(`Import did not complete for ${document.name}.`);
    onImport(scenario);
  }
}
