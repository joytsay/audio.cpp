export type KnowledgeScenario = {
  id: string;
  name: string;
  createdAt: string;
  qaCount: number;
  simulation?: boolean;
  opening?: SimulationOpening;
  examples?: string[];
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
const companionImage = /\.(?:png|jpe?g|gif|webp)$/i;
async function encodeScenarioFiles(files: File[],signal: AbortSignal) {
  if(!files.length||files.length>8)throw new Error('Choose 1–8 files.');
  if(files.some(file=>!file.size||(!/\.(pdf|docx|xlsx|csv|txt|md|html?)$/i.test(file.name)&&!companionImage.test(file.name))))throw new Error('Choose PDF, DOCX, XLSX, CSV, TXT, Markdown or HTML files.');
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
  const encoded=await encodeScenarioFiles(files,signal);
  const attachments=encoded.filter(file=>companionImage.test(file.name));
  const documents=encoded.filter(file=>!companionImage.test(file.name));
  const html=documents.filter(file=>/\.html?$/i.test(file.name));
  if(attachments.length&&html.length!==1)throw new Error('Select exactly one HTML document when attaching companion images.');
  for(const file of documents){
    const input=attachments.length&&file===html[0]?{...file,attachments}:file;
    const {scenario}=await request<{scenario: KnowledgeScenario}>('/n8n/webhook/ivr-import-scenario',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal,
    });
    if(!scenario?.id||!Array.isArray(scenario.tables))throw new Error(`Import did not complete for ${file.name}.`);
    onImport(scenario);
  }
}

export type SimulationScenario = {
  number: number;
  title: string;
  steps?: string;
  custom?: boolean;
  retrieval?: boolean;
  dispatchReminder?: string;
};
export type SimulationOpening = {prompts: string[]; language: "zh" | "en"};
export type SimulationTurn = {role: "user" | "assistant"; content: string};

export async function matchSimulation(id: string,text: string,signal: AbortSignal,language: "zh" | "en" = "zh") {
  const result = await request<{scenario: SimulationScenario | null}>('/ivr-simulation', {
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,text,language}),signal,
  });
  return result.scenario;
}

export async function answerSimulationRag(
  id: string, number: number, language: "zh" | "en", text: string, previous: string, signal: AbortSignal,
  history?: SimulationTurn[],
) {
  const result = await request<{answer: string}>('/ivr-simulation',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,number,language,text,previous,history}),signal,
  });
  if(typeof result.answer!=='string'||!result.answer.trim())throw new Error('Multimodal RAG returned no answer.');
  return result.answer.trim();
}

export async function removeKnowledgeScenario(id: string): Promise<void> {
  if(!/^[a-f0-9]{24}$/.test(id))throw new Error('Choose an uploaded scenario to remove.');
  const result=await request<{id: string; removed: boolean}>('/n8n/webhook/ivr-delete-scenario',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),
  });
  if(result.id!==id||result.removed!==true)throw new Error('Scenario workflow did not confirm removal.');
}
