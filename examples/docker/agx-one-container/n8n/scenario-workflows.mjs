import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {withN8nApi} from './unpublish-workflow.mjs';
import {ensureWorkflowPublished} from './publish-workflow.mjs';
import {routerMarker,routerSignature,routerWorkflow,sopMarker,sopWorkflow,skillMarkers,skillWorkflows,templateVersion} from './sop-workflows.mjs';

// Normalize spreadsheet dispatch dates (2026/6/2, 202606/02, 20260602) for display.
export function dispatchDate(value){
  const text=String(value??'').normalize('NFKC').trim();
  const match=text.match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})(?:日|號)?$/)||
    text.match(/^(\d{4})(\d{2})\/(\d{1,2})$/)||text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(!match)return '';
  const date=`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
  return !Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date?date:'';
}

const importRoute=id=>`/scenario-imports/${id}`;
const tableRoute=id=>`/data-tables/${encodeURIComponent(id)}`;
const legacyMetadataColumns=['source_key','source_row','source_section','source_extraction'];
const headerAliases=new Map(Object.entries({
  派工單號:'dispatch_number',派工日期:'dispatch_date',負責人:'assigned_to',客戶名稱:'customer_name',
  廠區:'site',分組:'group_name',設備:'equipment',編號:'reference_number',派工項目:'dispatch_item',
  型號:'model',工號:'employee_number',姓名:'name',英文姓名:'english_name',地區:'region',
  部門代碼:'department_code',部門名稱:'department_name',直屬主管:'manager',公司電話:'office_phone',
  公務手機:'work_mobile','公司/據點':'company_site','頁籤/地點':'location','部門/團隊':'department_team',
  '分機/電話':'extension_phone',英文名:'english_name',職稱:'job_title',公司信箱:'work_email',
  公司別:'company',料件編號:'part_number',品名:'item_name',規格:'specification',廠牌:'brand',
  預計停產:'planned_discontinuation','採購安全期(天)':'purchase_lead_days',
  各地區數量:'regional_quantity',押案量:'reserved_quantity',實際可用量:'available_quantity',安全庫存量:'safety_stock',
}));
const isDispatchDate=({header})=>/^(?:派工日期|dispatch[ _]date)(?: \(\d+\))?$/i.test(header.normalize('NFKC').trim());
const formatDispatchDate=value=>dispatchDate(value).replaceAll('-','/')||value;

export function tableColumns(headers){
  // Keep the same column IDs for workbooks imported before metadata removal.
  const used=new Set([...legacyMetadataColumns,'id','createdat','updatedat','dryrunstate']);
  return headers.map((header,i)=>{
    const ascii=header.normalize('NFKC').replace(/[^A-Za-z0-9_]+/g,'_').replace(/^_+|_+$/g,'');
    const base=headerAliases.get(header)||(/^[A-Za-z]/.test(ascii)&&!/[\p{Script=Han}]/u.test(header)?ascii.slice(0,50):`field_${i+1}`);
    let id=base,suffix=1;
    while(used.has(id.toLowerCase()))id=`${base}_${++suffix}`;
    used.add(id.toLowerCase());
    return {header,id};
  });
}

const tableScopes=[
  'dataTable:list','dataTable:create','dataTable:delete','dataTableColumn:delete','dataTableRow:read','dataTableRow:create',
];
const missing=async promise=>{
  try{return await promise;}
  catch(error){if(error.status===404)return null;throw error;}
};
const conflict=message=>Object.assign(new Error(message),{status:409});
async function list(api,route){
  const rows=[];
  let cursor;
  do{
    const page=await api(`${route}?limit=100${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`);
    rows.push(...page.data);
    cursor=page.nextCursor;
  }while(cursor);
  return rows;
}

async function ensureTable(api,table,state,save){
  const columns=tableColumns(table.headers);
  const columnIds=columns.map(column=>column.id);
  const available=await list(api,'/data-tables');
  let current=available.find(item=>item.id===state.id);
  if(!current){
    const sameName=available.find(item=>item.name===table.name);
    if(sameName){
      const names=sameName.columns?.map(column=>column.name).filter(name=>!legacyMetadataColumns.includes(name));
      if(!state.creating||!names||!isDeepStrictEqual(names.sort(),[...columnIds].sort())){
        throw conflict(`An unrelated n8n table is already named ${table.name}`);
      }
    }
    if(!state.creating){
      state.creating=true;
      await save();
    }
    current=sameName||await api('/data-tables',{name:table.name,columns:columnIds.map(name=>({name,type:'string'}))});
    state.id=current.id;
    state.creating=false;
    state.complete=false;
    await save();
  }
  const route=tableRoute(state.id);
  if(!state.complete){
    const rowsRoute=route+'/rows';
    const persisted=await list(api,rowsRoute);
    const oldKeys=new Set(persisted.map(row=>row.source_key).filter(Boolean));
    // Track occurrences so identical rows in the source all survive a retry.
    const dateIds=new Set(columns.filter(isDispatchDate).map(({id})=>id));
    const fingerprint=row=>JSON.stringify(columnIds.map(id=>String((dateIds.has(id)?formatDispatchDate(row[id]):row[id])??'')));
    const counts=new Map();
    for(const row of persisted){
      if(row.source_key)continue;
      const key=fingerprint(row);
      counts.set(key,(counts.get(key)||0)+1);
    }
    const rows=[];
    for(const [index,record] of table.records.entries()){
      if(oldKeys.has(String(index+1)))continue;
      const row=Object.fromEntries(columns.map(({header,id})=>[id,Object.hasOwn(record.fields,header)?record.fields[header]:'']));
      for(const id of dateIds)row[id]=formatDispatchDate(row[id]);
      const key=fingerprint(row),count=counts.get(key)||0;
      if(count)counts.set(key,count-1);
      else rows.push(row);
    }
    for(let i=0;i<rows.length;i+=100)await api(rowsRoute,{data:rows.slice(i,i+100)});
    state.complete=true;
    await save();
  }
  for(const column of current.columns||[]){
    if(legacyMetadataColumns.includes(column.name)){
      await missing(api(`${route}/columns/${encodeURIComponent(column.id)}`,undefined,'DELETE'));
    }
  }
  const ocr=table.records.some(record=>record.extraction==='ocr');
  return {name:table.name,sheet:table.sheet,id:state.id,columns,ocr};
}

async function repairTableDates(api,table){
  const rowsRoute=tableRoute(table.id)+'/rows';
  const rows=await missing(list(api,rowsRoute));
  if(!rows)return;
  for(const {id} of table.columns.filter(isDispatchDate)){
    for(const original of new Set(rows.map(row=>row[id]))){
      const date=formatDispatchDate(original);
      if(date===original)continue;
      await missing(api(rowsRoute+'/update',{
        filter:{type:'and',filters:[{columnName:id,condition:'eq',value:original}]},
        data:{[id]:date},returnData:false,
      },'PATCH'));
    }
  }
}

async function deleteScenarioWorkflow(api,workflowId){
  const route=`/workflows/${encodeURIComponent(workflowId)}`;
  const workflow=await missing(api(route));
  if(!workflow)return;
  if(workflow.activeVersionId||workflow.active)await missing(api(route+'/unpublish',{}));
  // Unpublish is asynchronous in n8n. Its public API returns 409 until the
  // worker releases the published version, even after the draft is inactive.
  for(let attempt=0;;attempt++){
    try{
      await missing(api(route,undefined,'DELETE'));
      return;
    }catch(error){
      if(error.status!==409||attempt===20)throw error;
    }
    await delay(1000);
  }
}

const workflowScopes=['workflow:list','workflow:read','workflow:create','workflow:update','workflow:activate','workflow:deactivate','workflow:delete'];
const hasNode=(workflow,id)=>workflow.nodes?.some(node=>node.id===id);

export function createScenarioManager({withApi=withN8nApi,knowledgeUrl='http://knowledge:8085',log=console.log}={}){
  const knowledge=async(route,method='GET',body)=>{
    const response=await fetch(knowledgeUrl+route,{
      method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),
      signal:AbortSignal.timeout(540000),
    });
    const result=await response.json();
    if(!response.ok)throw Object.assign(new Error(result.error||`Knowledge service HTTP ${response.status}`),{status:response.status});
    return result;
  };
  let pending=Promise.resolve();
  const enqueue=operation=>{
    const result=pending.then(operation);
    pending=result.catch(()=>{});
    return result;
  };
  const registeredTables=async()=>{
    const {scenarios}=await knowledge('/scenarios');
    const imports=scenarios.filter(scenario=>scenario.tables?.length);
    const tables=[];
    for(const {id,name} of imports){
      const record=await missing(knowledge(importRoute(id)));
      if(!record?.resources?.ready)continue;
      record.dataset.tables.forEach((table,index)=>{
        const id=record.resources.tables[index]?.id;
        if(!id)return;
        tables.push({
          id,scenario:name,name:table.name,sheet:table.sheet,columns:tableColumns(table.headers),
          ocr:table.records.some(row=>row.extraction==='ocr'),
        });
      });
    }
    return tables;
  };
  // The multi-agent flow: the shared skills, one agent per SOP (its
  // vectors made by the Embed skill), and the front desk agent. Workflows are
  // rebuilt only when their template or SOP changed.
  const syncSopsNow=async()=>{
    const {sops}=await knowledge('/sops');
    const created=[];
    const put=async(api,workflow,next)=>api(`/workflows/${encodeURIComponent(workflow.id)}`,
      {name:next.name,nodes:next.nodes,connections:next.connections,settings:next.settings},'PUT');
    const skills=await withApi(workflowScopes,async api=>{
      const workflows=await list(api,'/workflows');
      const ids={};
      for(const [key,next] of Object.entries(skillWorkflows({knowledgeUrl}))){
        let workflow=workflows.find(item=>hasNode(item,skillMarkers[key]));
        if(!workflow){workflow=await api('/workflows',next);created.push(next.name);}
        else if(!workflow.nodes.some(node=>node.id===skillMarkers[key]&&node.notes===templateVersion)){workflow=await put(api,workflow,next);created.push(`${next.name} (updated)`);}
        await ensureWorkflowPublished(api,workflow.id);
        ids[key]=workflow.id;
      }
      return ids;
    },{expiresIn:600});
    // Embedding extraction through the Embed skill, once per written sop.
    for(const sop of sops.filter(item=>item.ready)){
      const record=await missing(knowledge(importRoute(sop.id)));
      if(!record)continue;
      const state=record.resources||{tables:[]};
      // Keyed by collection too: SOPs once lived in runbook_<id> collections.
      const embedded=`${sop.collection}@${sop.writtenAt}`;
      if(state.embedded===embedded)continue;
      const documents=await knowledge(`/sops/${sop.id}/documents`);
      const response=await fetch('http://127.0.0.1:5678/webhook/ivr-skill-embed',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(documents),signal:AbortSignal.timeout(600000)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(`Embed skill failed for ${sop.name}: HTTP ${response.status} ${JSON.stringify(result).slice(0,200)}`);
      delete state.embeddedAt;state.embedded=embedded;
      await knowledge(importRoute(sop.id),'PUT',state);
      log(`[ivr-n8n] Embed skill: ${sop.name} → ${result.collection} (${result.vectors} vectors)`);
    }
    return withApi(workflowScopes,async api=>{
      const workflows=await list(api,'/workflows');
      for(const sop of sops.filter(item=>item.ready)){
        const record=await missing(knowledge(importRoute(sop.id)));
        if(!record)continue;
        const state=record.resources||{tables:[]};
        let workflow=workflows.find(item=>item.id===state.workflowId)||workflows.find(item=>hasNode(item,sopMarker(sop.id)));
        const next=sopWorkflow(sop,skills);
        if(!workflow){workflow=await api('/workflows',next);created.push(next.name);}
        else if(!workflow.nodes?.some(node=>node.id===sopMarker(sop.id)&&String(node.notes??'').includes(`${sop.writtenAt} · ${templateVersion}`))){
          workflow=await put(api,workflow,next);created.push(`${next.name} (updated)`);
        }
        await ensureWorkflowPublished(api,workflow.id);
        if(state.workflowId!==workflow.id){
          state.workflowId=workflow.id;
          await knowledge(importRoute(sop.id),'PUT',state);
        }
      }
      // The front desk agent's skills are the SOP agents: rebuild it when they change.
      const current=(await knowledge('/sops')).sops;
      const next=routerWorkflow(current,{knowledgeUrl});
      const signature=routerSignature(current);
      // Also adopt the router installed before SOPs were called runbooks.
      let router=workflows.find(item=>hasNode(item,routerMarker))||workflows.find(item=>hasNode(item,'runbook-router-input'));
      if(!router){router=await api('/workflows',next);created.push(router.name);}
      else if(!router.nodes?.some(node=>node.id===routerMarker&&node.notes===signature)){router=await put(api,router,next);created.push(`${router.name} (updated)`);}
      await ensureWorkflowPublished(api,router.id);
      if(created.length)log(`[ivr-n8n] Created ${created.join(', ')}.`);
      return {sops:sops.length,created,router:router.id,skills};
    },{expiresIn:600});
  };
  return {
    syncSops:()=>enqueue(syncSopsNow),
    async repairDispatchDates(){
      const tables=(await registeredTables()).filter(table=>table.columns.some(isDispatchDate));
      if(!tables.length)return;
      return withApi(['dataTableRow:read','dataTableRow:update'],async api=>{
        for(const table of tables)await repairTableDates(api,table);
      },{expiresIn:600});
    },
    import(file){
      return enqueue(async()=>{
        const {attachments,title,...document}=file;
        const added=await knowledge('/scenarios','POST',{files:[document],attachments,fileMode:true,...(title?{title}:{})});
        const record=await knowledge(importRoute(added.scenario.id));
        const state=record.resources||{tables:[]};
        state.tables??=[];
        const save=()=>knowledge(importRoute(record.id),'PUT',state);
        if (record.dataset.tables.length) {
          await withApi(tableScopes,async api=>{
            for(const [index,table] of record.dataset.tables.entries()){
              const entry=state.tables[index]??={};
              await ensureTable(api,table,entry,save);
            }
          },{expiresIn:600});
        }
        state.ready=true;
        const scenario=await save();
        // An SOP page's hotwords reach hotwords.csv now, before its SOP is written.
        await knowledge('/sops/hotwords','POST',{}).catch(error=>console.error('[ivr-n8n] hotwords.csv not updated:',error.message));
        if(/\.(?:csv|html?)$/i.test(document.name)){
          // A sop: the LLM writes its Q/A (minutes for a long script), then
          // it gets its n8n workflow. Runs after the upload has answered.
          void knowledge('/sops/index','POST',{id:scenario.id})
            .then(()=>enqueue(syncSopsNow))
            .then(result=>log(`[ivr-n8n] SOP ready: ${document.name}`,result?.created??''))
            .catch(error=>console.error(`[ivr-n8n] SOP for ${document.name} not ready:`,error.message));
        }
        if (process.env.IVR_RAG_INDEX_UPLOADS === 'true' && !/\.(?:csv|xlsx)$/i.test(document.name)) {
          // Allow the first query to retry indexing if the inference workers are still warming up.
          void knowledge('/rag/index','POST',{id:scenario.id}).catch(error=>{
            console.error('Scenario indexing deferred:',error.message);
          });
        }
        return {scenario,duplicate:added.duplicate};
      });
    },
    remove(id){
      return enqueue(async()=>{
        const route=`/scenarios/${id}`;
        const record=await missing(knowledge(importRoute(id)));
        if(record?.dataset&&record.resources){
          const state=record.resources;
          const scopes = ['dataTable:delete'];
          if (state.workflowId) scopes.push('workflow:read','workflow:deactivate','workflow:delete');
          if (state.workflowId || state.tables.some(row=>row.id)) await withApi(scopes,async api=>{
            if(state.workflowId)await deleteScenarioWorkflow(api,state.workflowId);
            for(const row of state.tables){
              if(row.id)await missing(api(tableRoute(row.id),undefined,'DELETE'));
            }
          },{expiresIn:600});
        }
        const removed=await knowledge(route,'DELETE');
        // The front desk agent loses that SOP's skill.
        await syncSopsNow().catch(error=>console.error('[ivr-n8n] SOP router not updated:',error.message));
        return removed;
      });
    },
  };
}

// call_sessions holds one row per IVR call. Its opening-answer columns come
// from the call script, so the columns each row needs are added on first use.
export const callSessionsTable='call_sessions';
const columnName=/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/;
export function createCallSessionColumns({withApi=withN8nApi,now=Date.now,ttlMs=60000}={}){
  // Columns seen recently skip the API; the expiry recovers from a table
  // that was deleted or edited by hand.
  const known=new Map();
  const isKnown=name=>now()-(known.get(name)??-Infinity)<ttlMs;
  let pending=Promise.resolve();
  const ensure=columns=>withApi(['dataTable:list','dataTable:create','dataTableColumn:read','dataTableColumn:create'],async api=>{
    const table=(await list(api,'/data-tables')).find(item=>item.name===callSessionsTable);
    if(!table){
      await api('/data-tables',{name:callSessionsTable,columns:columns.map(name=>({name,type:'string'}))});
    }else{
      const route=`${tableRoute(table.id)}/columns`;
      const response=await api(route),existing=new Set((response.data||response).map(column=>column.name));
      for(const name of columns)if(!existing.has(name))await api(route,{name,type:'string'});
    }
    for(const name of columns)known.set(name,now());
  });
  return columns=>{
    if(!Array.isArray(columns)||!columns.length||columns.some(name=>typeof name!=='string'||!columnName.test(name)))
      throw Object.assign(new Error('Invalid call_sessions columns'),{status:400});
    const result=pending.then(()=>columns.every(isKnown)?undefined:ensure(columns));
    pending=result.catch(()=>{});
    return result;
  };
}

export function createScenarioServer(manager=createScenarioManager(),callColumns=createCallSessionColumns()){
  return createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');
    try{
      if(req.method==='GET'&&req.url==='/health')return res.end('{"status":"ok"}');
      if(req.method==='POST'&&req.url==='/imports'){
        const limit=14*1024*1024;
        let raw='';
        req.setEncoding('utf8');
        for await(const chunk of req){
          raw+=chunk;
          if(raw.length>limit)throw Object.assign(new Error('Scenario upload is too large'),{status:413});
        }
        let body;
        try{body=JSON.parse(raw);}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}
        const result=await manager.import(body);
        return res.end(JSON.stringify(result));
      }
      if(req.method==='POST'&&req.url==='/call-sessions'){
        // Body: the IVR engine's {rows, columns}; replies with the rows once
        // call_sessions has every column they use.
        let raw='';
        req.setEncoding('utf8');
        for await(const chunk of req){
          raw+=chunk;
          if(raw.length>2*1024*1024)throw Object.assign(new Error('Call session is too large'),{status:413});
        }
        let body;
        try{body=JSON.parse(raw);}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}
        const rows=Array.isArray(body?.rows)?body.rows:[];
        if(rows.length)await callColumns(body.columns);
        return res.end(JSON.stringify(rows));
      }
      if(req.method==='POST'&&req.url==='/sops/sync')return res.end(JSON.stringify(await manager.syncSops()));
      const id=/^\/scenarios\/([a-f0-9]{24})$/.exec(req.url)?.[1];
      if(req.method==='DELETE'&&id)return res.end(JSON.stringify(await manager.remove(id)));
      res.writeHead(404).end('{"error":"Unknown scenario endpoint"}');
    }catch(error){
      res.writeHead(error.status||500).end(JSON.stringify({error:error.message}));
    }
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  createScenarioServer().listen(8087,'127.0.0.1');
}
