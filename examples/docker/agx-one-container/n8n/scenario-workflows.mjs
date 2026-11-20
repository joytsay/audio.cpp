import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {withN8nApi} from './unpublish-workflow.mjs';
import {ensureWorkflowPublished} from './publish-workflow.mjs';
import {knowledgeToolsId,scenarioToolPosition} from './workflow-layout.mjs';
import {lookupScenario} from './scenario-lookup.mjs';
import {dispatchDate} from '../knowledge/conversation.mjs';

const workflowRoute='/workflows/'+knowledgeToolsId;
const importRoute=id=>`/scenario-imports/${id}`;
const tableRoute=id=>`/data-tables/${encodeURIComponent(id)}`;
const toolId=id=>`scenario-file-${id}`;
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

const scopes=[
  'workflow:list','workflow:read','workflow:create','workflow:update','workflow:activate','workflow:deactivate','workflow:delete',
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

const names=['query','sheet'];
const inputSchema=names.map(name=>({
  id:name,displayName:name,type:'string',required:false,defaultMatch:false,display:true,canBeUsedToMatch:true,
}));
const edge=(node,type='main')=>({node,type,index:0});

export function compileScenarioWorkflow(record,tables){
  const start='Scenario request';
  const nodes=[{
    id:toolId(record.id),name:start,type:'n8n-nodes-base.executeWorkflowTrigger',typeVersion:1.1,position:[0,0],
    parameters:{inputSource:'workflowInputs',workflowInputs:{values:names.map(name=>({name,type:'string'}))}},
  }];
  for(const [index,table] of tables.entries()){
    nodes.push({
      id:`read-table-${index+1}`,name:`Read ${table.name}`,type:'n8n-nodes-base.dataTable',typeVersion:1.1,
      position:[220*(index+1),0],alwaysOutputData:true,executeOnce:true,
      parameters:{
        resource:'row',operation:'get',dataTableId:{__rl:true,mode:'id',value:table.id},
        matchType:'allConditions',filters:{conditions:[]},returnAll:true,
      },
    });
  }
  const readers=nodes.slice(1).map(node=>node.name);
  const script=`const input=$(${JSON.stringify(start)}).first().json;
const tables=${JSON.stringify(tables)};
const rows=[${readers.map(name=>`$(${JSON.stringify(name)}).all().map(item=>item.json)`).join(',')}];
tables.forEach((table,index)=>{table.rows=rows[index]});
return [{json:(${lookupScenario.toString()})(input,tables,${JSON.stringify(record.dataset.template)},${JSON.stringify(record.files[0].name)})}];`;
  nodes.push({
    id:'scenario-result',name:'Return scenario guidance and matches',type:'n8n-nodes-base.code',typeVersion:2,
    position:[220*nodes.length,0],parameters:{jsCode:script},
  });
  const connections=Object.fromEntries(nodes.slice(0,-1).map((node,index)=>[node.name,{main:[[edge(nodes[index+1].name)]]}]));
  return {name:record.name,nodes,connections,settings:{executionOrder:'v1'}};
}

function toolNode(record,tables,workflowId,name,position){
  const headings=tables.map(table=>`${table.name} (${table.columns.map(column=>column.header).join('、')})`).join('；');
  const topics=record.dataset.template.map(section=>section.title).join('、');
  return {
    id:toolId(record.id),name,type:'@n8n/n8n-nodes-langchain.toolWorkflow',typeVersion:2.1,position,
    notes:record.name,notesInFlow:name!==record.name,
    parameters:{
      name,source:'database',workflowId:{__rl:true,mode:'id',value:workflowId},
      description:`${record.name} · 查詢已上傳檔案的最新資料。資料表：${headings.slice(0,600)}。${topics?`語音對話情境：${topics.slice(0,400)}。`:''} 請提供關鍵字、姓名、編號或情境名稱。`,
      workflowInputs:{
        mappingMode:'defineBelow',schema:inputSchema,matchingColumns:[],attemptToConvertTypes:false,convertFieldsToString:false,
        value:{
          query:"={{ $fromAI('query','Keywords or intent from the current caller turn','string','') }}",
          sheet:"={{ $fromAI('sheet','Exact worksheet name if specified, otherwise empty','string','') }}",
        },
      },
    },
  };
}
function workflowBody({name,nodes,connections,settings}){return {name,nodes,connections,settings};}

export function refreshScenarioLookup(workflow) {
  const node=workflow.nodes.find(item=>item.id==='scenario-result'&&item.type==='n8n-nodes-base.code');
  const script=node?.parameters.jsCode;
  if(typeof script!=='string')return false;
  const marker='\nreturn [{json:(';
  const start=script.indexOf(marker);
  const end=script.indexOf(')(input,tables,',start+marker.length);
  if(start<0||end<=start||!script.startsWith(marker+'function lookupScenario(',start))return false;
  const next=script.slice(0,start+marker.length)+lookupScenario.toString()+script.slice(end);
  if(next===script)return false;
  node.parameters.jsCode=next;
  return true;
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

async function registerTool(api,record,tables,state){
  const parent=await api(workflowRoute);
  const trigger=parent.nodes.find(node=>node.id==='maintenance-mcp-trigger');
  if(!trigger)throw new Error('Scenario MCP Server is missing from Knowledge Tools');
  const id=toolId(record.id);
  const existing=parent.nodes.find(node=>node.id===id);
  const count=parent.nodes.filter(node=>node.id.startsWith('scenario-file-')).length;
  const isWireName=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(record.name);
  const name=existing?.name||state.toolName||(isWireName&&!parent.nodes.some(node=>node.name===record.name)?record.name:`scenario_${record.id}`);
  const node=toolNode(record,tables,state.workflowId,name,existing?.position??scenarioToolPosition(count));
  const connection={ai_tool:[[edge(trigger.name,'ai_tool')]]};
  if(!isDeepStrictEqual(existing,node)||!isDeepStrictEqual(parent.connections[name],connection)){
    parent.nodes=parent.nodes.filter(node=>node.id!==id);
    parent.nodes.push(node);
    parent.connections[name]=connection;
    await api(workflowRoute,workflowBody(parent),'PUT');
  }
  await ensureWorkflowPublished(api,knowledgeToolsId);
  return name;
}

export function createScenarioManager({withApi=withN8nApi,knowledgeUrl='http://knowledge:8085'}={}){
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
    const imports=scenarios.filter(scenario=>scenario.tool&&scenario.tables?.length);
    const tables=[];
    for(const {id,name} of imports){
      const record=await missing(knowledge(importRoute(id)));
      if(!record?.resources?.ready)continue;
      record.dataset.tables.forEach((table,index)=>{
        const id=record.resources.tables[index]?.id;
        if(!id)return;
        tables.push({
          id,workflowId:record.resources.workflowId,scenario:name,name:table.name,sheet:table.sheet,columns:tableColumns(table.headers),
          ocr:table.records.some(row=>row.extraction==='ocr'),
        });
      });
    }
    return tables;
  };
  return {
    async refreshDirectoryWorkflows(){
      const tables=await registeredTables();
      const ids=new Set(tables.filter(({columns})=>
        columns.some(({header})=>/姓名|中文名|聯絡人|^(?:chinese[ _]|employee[ _]|full[ _])?name$/i.test(header))&&
        columns.some(({header})=>/分[機机]|部門|\bext(?:ension)?\b|department/i.test(header))
      ).map(table=>table.workflowId).filter(Boolean));
      if(!ids.size)return;
      return withApi(['workflow:read','workflow:update','workflow:activate'],async api=>{
        for(const id of ids){
          const route=`/workflows/${encodeURIComponent(id)}`;
          const workflow=await missing(api(route));
          if(!workflow||!refreshScenarioLookup(workflow))continue;
          await api(route,workflowBody(workflow),'PUT');
          if(workflow.active)await ensureWorkflowPublished(api,id);
        }
      },{expiresIn:600});
    },
    async repairDispatchDates(){
      const tables=(await registeredTables()).filter(table=>table.columns.some(isDispatchDate));
      if(!tables.length)return;
      return withApi(['dataTableRow:read','dataTableRow:update'],async api=>{
        for(const table of tables)await repairTableDates(api,table);
      },{expiresIn:600});
    },
    async lookupRecords({reference,lookup}={}){
      const valid=reference
        ? typeof reference==='string'&&reference.length<=100&&/^[A-Za-z]{1,6}-?\d[A-Za-z0-9_/-]*$/.test(reference)
        : ['site','person','keyword','employee','serial','model','customer_site','catalog'].includes(lookup?.kind)&&
          typeof lookup.term==='string'&&lookup.term.trim()&&lookup.term.length<=(lookup.kind==='catalog'?128:100)&&
          (lookup.sheet===undefined||typeof lookup.sheet==='string')&&
          (lookup.kind!=='customer_site'||(typeof lookup.customer==='string'&&lookup.customer.trim()));
      if(!valid){
        throw Object.assign(new Error('Invalid scenario lookup'),{status:400});
      }
      const tables=(await registeredTables()).filter(table=>!lookup?.sheet||lookup.sheet===table.sheet||lookup.sheet===table.name);
      if(lookup?.kind==='catalog'){
        const dataset=value=>String(value??'').normalize('NFKC').trim().toLowerCase().replace(/資料庫$/,'');
        const matching=lookup.sheet?tables:tables.filter(table=>dataset(table.scenario)===dataset(lookup.term));
        return {records:[],matched_rows:0,tables:matching.map(({name,sheet,columns})=>({name,sheet,headers:columns.map(({header})=>header)}))};
      }
      if(!tables.length)return {records:[],matched_rows:0};
      return withApi(['dataTableRow:read'],async api=>{
        for(const table of tables){
          table.rows=await list(api,tableRoute(table.id)+'/rows');
          for(const {id} of table.columns.filter(isDispatchDate)){
            for(const row of table.rows)row[id]=formatDispatchDate(row[id]);
          }
        }
        const {records,matched_rows}=lookupScenario({reference,lookup},tables,[]);
        return {records,matched_rows};
      });
    },
    import(file){
      return enqueue(async()=>{
        const {attachments,...document}=file;
        const added=await knowledge('/scenarios','POST',{files:[document],attachments,fileMode:true});
        const record=await knowledge(importRoute(added.scenario.id));
        const state=record.resources||{tables:[]};
        const save=()=>knowledge(importRoute(record.id),'PUT',state);
        const scenario=await withApi(scopes,async api=>{
          const tables=[];
          for(const [index,table] of record.dataset.tables.entries()){
            const entry=state.tables[index]??={};
            tables.push(await ensureTable(api,table,entry,save));
          }
          const compiled=compileScenarioWorkflow(record,tables);
          const workflowId=state.workflowId||record.workflow?.workflowId;
          let workflow=workflowId&&await missing(api(`/workflows/${encodeURIComponent(workflowId)}`));
          if(!workflow){
            const previous=await list(api,'/workflows');
            workflow=previous.find(item=>item.nodes?.some(node=>node.id===toolId(record.id)));
          }
          if(!workflow)workflow=await api('/workflows',compiled);
          else if(workflow.id===record.workflow?.workflowId&&!workflow.nodes.some(node=>node.id===toolId(record.id))){
            await api(`/workflows/${workflow.id}`,{...compiled,settings:{...compiled.settings,...workflow.settings}},'PUT');
          }
          else if(tables.some((table,index)=>workflow.nodes.some(node=>node.id===`read-table-${index+1}`&&node.parameters.dataTableId?.value!==table.id))){
            // Reconnect a recreated table without replacing edits to the rest of the workflow.
            for(const [index,table] of tables.entries()){
              const node=workflow.nodes.find(node=>node.id===`read-table-${index+1}`);
              if(node?.parameters.dataTableId)node.parameters.dataTableId.value=table.id;
            }
            await api(`/workflows/${workflow.id}`,workflowBody(workflow),'PUT');
          }
          state.workflowId=workflow.id;
          await save();
          await ensureWorkflowPublished(api,workflow.id);
          state.toolName=await registerTool(api,record,tables,state);
          state.ready=true;
          return save();
        },{expiresIn:600});
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
          await withApi(scopes,async api=>{
            const parent=await api(workflowRoute);
            const node=parent.nodes.find(node=>node.id===toolId(id));
            if(node){
              parent.nodes=parent.nodes.filter(item=>item.id!==node.id);
              delete parent.connections[node.name];
              await api(workflowRoute,workflowBody(parent),'PUT');
            }
            await ensureWorkflowPublished(api,knowledgeToolsId);
            if(state.workflowId)await deleteScenarioWorkflow(api,state.workflowId);
            for(const row of state.tables){
              if(row.id)await missing(api(tableRoute(row.id),undefined,'DELETE'));
            }
          },{expiresIn:600});
        }
        return knowledge(route,'DELETE');
      });
    },
  };
}

export function createScenarioServer(manager=createScenarioManager()){
  return createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');
    try{
      if(req.method==='GET'&&req.url==='/health')return res.end('{"status":"ok"}');
      if(req.method==='POST'&&['/imports','/lookup-reference','/lookup-records'].includes(req.url)){
        const importing=req.url==='/imports';
        const limit=importing?14*1024*1024:1024;
        let raw='';
        req.setEncoding('utf8');
        for await(const chunk of req){
          raw+=chunk;
          if(raw.length>limit)throw Object.assign(new Error(importing?'Scenario upload is too large':'Scenario lookup is too large'),{status:413});
        }
        let body;
        try{body=JSON.parse(raw);}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}
        const result=importing?await manager.import(body):await manager.lookupRecords(body||{});
        return res.end(JSON.stringify(result));
      }
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
