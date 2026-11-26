// A multi-agent n8n flow with shared skills, generated from uploaded SOPs.
//
// Skills (shared workflows; any agent can call them as tools):
//   GeoVision · Skill · Embed   embedding extraction for RAG: an SOP's Q/A and
//                               passages → Default Data Loader → local embeddings
//                               → Qdrant (webhook ivr-skill-embed, run on upload)
//   GeoVision · Skill · RAG     retrieval: Qdrant semantic search + exact keyword
//                               match over one SOP
//   GeoVision · Skill · Runmap  grounding: the next step of a document's opening
//                               and script runmap (only documents that have one)
//
// Agents:
//   GeoVision · SOPs              front desk agent (webhook ivr-sop);
//                                     its skills are the SOP agents
//   GeoVision · SOP · <file>      one agent per uploaded file, following the
//                                     Q/An SOP the LLM wrote; skills: RAG, and
//                                     Runmap when the file has an opening
//
// Every agent uses the same local LLM (LFM2.5 by default). What is spoken is
// grounded: a reply must come from what the skills returned.
export const sopModel = process.env.IVR_SOP_MODEL || 'bartowski/LiquidAI_LFM2.5-1.2B-Instruct-GGUF:Q4_K_M';
export const embeddingModel = process.env.IVR_TEXT_EMBED_MODEL || 'Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0';
// Bump when the generated workflows change, so installed ones are rebuilt.
export const templateVersion = 'sops-v9';
export const routerName = 'GeoVision · SOPs';
export const routerMarker = 'sop-router-input';
export const skillMarkers = {embed: 'skill-embed-input', rag: 'skill-rag-input', runmap: 'skill-runmap-input'};
const credentials = {
  llm: {openAiApi: {id: 'configure-local-llm', name: 'IVR local LLM'}},
  embeddings: {openAiApi: {id: 'configure-local-embeddings', name: 'IVR local embeddings'}},
  qdrant: {qdrantApi: {id: 'configure-local-qdrant', name: 'IVR local Qdrant'}},
};
const edge = (node, type = 'main') => ({node, type, index: 0});
const at = (x, y = 0) => [Math.round(x * 240), Math.round(y * 200)];
const workOrderColumns = ['order_id', 'report_key', 'session_id', 'dispatch_date', 'reference_number', 'title', 'equipment_number',
  'maintenance_items', 'quantity', 'notes', 'test_result', 'transcripts', 'results'];
const ifTrue = (id, name, expression, position) => ({
  id, name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position,
  parameters: {conditions: {options: {caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2},
    conditions: [{id: `${id}-condition`, leftValue: `={{ ${expression} }}`, rightValue: '',
      operator: {type: 'boolean', operation: 'true', singleValue: true}}], combinator: 'and'}, options: {}},
});
const code = (id, name, jsCode, position) => ({id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position, parameters: {jsCode}});
const http = (id, name, url, jsonBody, position, timeout = 60000) => ({
  id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position,
  parameters: {method: 'POST', url, sendBody: true, specifyBody: 'json', jsonBody, options: {timeout}},
});
const workflowTrigger = (id, names, position, notes) => ({
  id, name: 'Skill request', type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1.1, position,
  ...(notes ? {notes, notesInFlow: false} : {}),
  parameters: {inputSource: 'workflowInputs', workflowInputs: {values: names.map(([name, type = 'string']) => ({name, type}))}},
});
const schema = names => names.map(([id, type = 'string']) => ({id, displayName: id, required: false, defaultMatch: false,
  display: true, canBeUsedToMatch: true, type, removed: false}));
const callTool = (id, name, workflowId, description, value, inputs, position) => ({
  id, name, type: '@n8n/n8n-nodes-langchain.toolWorkflow', typeVersion: 2.2, position,
  parameters: {description, source: 'database', workflowId: {__rl: true, mode: 'id', value: workflowId},
    workflowInputs: {mappingMode: 'defineBelow', matchingColumns: [], attemptToConvertTypes: false, convertFieldsToString: false,
      value, schema: schema(inputs)}},
});
const callWorkflow = (id, name, workflowId, value, inputs, position) => ({
  id, name, type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position,
  parameters: {source: 'database', workflowId: {__rl: true, mode: 'id', value: workflowId},
    workflowInputs: {mappingMode: 'defineBelow', matchingColumns: [], attemptToConvertTypes: false, convertFieldsToString: false,
      value, schema: schema(inputs)}, options: {waitForSubWorkflow: true}},
});
const embeddingsNode = (id, name, position, embedUrl) => ({
  id, name, type: '@n8n/n8n-nodes-langchain.embeddingsOpenAi', typeVersion: 1.1, position,
  parameters: {model: embeddingModel, options: {baseURL: embedUrl, batchSize: 16, encodingFormat: 'float'}},
  credentials: credentials.embeddings,
});
const chatModel = (position, maxTokens = 200) => ({
  id: 'agent-llm', name: 'Local LLM', type: '@n8n/n8n-nodes-langchain.lmChatOpenAi', typeVersion: 1.3, position,
  parameters: {model: {__rl: true, value: sopModel, mode: 'id'}, responsesApiEnabled: false,
    options: {temperature: 0, maxTokens, timeout: 180000, maxRetries: 0}},
  credentials: credentials.llm,
});
// A failed agent (e.g. a full context) still produces an item, so the
// grounded step after it runs instead of the call failing. No chat memory:
// replayed tool results overflow a 1.2B model's context and stale answers
// leak into new turns; each turn is grounded in what its skills return.
const agentNode = (name, text, systemMessage, position) => ({
  id: name.toLowerCase().replace(/[^a-z]+/g, '-'), name, type: '@n8n/n8n-nodes-langchain.agent', typeVersion: 3.1, position,
  onError: 'continueRegularOutput',
  parameters: {promptType: 'define', text, options: {systemMessage, maxIterations: 4, returnIntermediateSteps: true}},
});
const aiLinks = (agent, model, tools) => ({
  [model]: {ai_languageModel: [[edge(agent, 'ai_languageModel')]]},
  ...Object.fromEntries(tools.map(tool => [tool, {ai_tool: [[edge(agent, 'ai_tool')]]}])),
});
// Code-node helper: a tool observation as an object (sub-workflow output).
const parseObservation = `const parse=value=>{let data=value;for(let i=0;i<3&&typeof data==='string';i++){try{data=JSON.parse(data);}catch{break;}}
 if(Array.isArray(data))data=data[0];if(data&&typeof data==='object'&&data.response!==undefined&&data.reply===undefined&&data.context===undefined)return parse(data.response);return data;};`;

const ragInputs = [['sopId'], ['collection'], ['query'], ['topK', 'number']];
const runmapInputs = [['sopId'], ['sessionId'], ['text'], ['start', 'boolean'], ['turnId']];
const sopInputs = [['sessionId'], ['text'], ['start', 'boolean'], ['turnId']];

// ── Skills ─────────────────────────────────────────────────────────────────
export function skillWorkflows({knowledgeUrl = 'http://knowledge:8085', embedUrl = 'http://voice-ai:8084/v1', qdrantUrl = 'http://knowledge:6333'} = {}) {
  const embed = {
    name: 'GeoVision · Skill · Embed', settings: {executionOrder: 'v1'},
    nodes: [
      {id: skillMarkers.embed, name: 'Embed request', type: 'n8n-nodes-base.webhook', typeVersion: 2.1, position: at(0),
        webhookId: 'ivr-skill-embed', notes: templateVersion, notesInFlow: false,
        parameters: {httpMethod: 'POST', path: 'ivr-skill-embed', responseMode: 'responseNode', options: {}}},
      {id: 'skill-embed-reset', name: 'Reset collection', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: at(1),
        onError: 'continueRegularOutput',
        parameters: {method: 'DELETE', url: `={{ '${qdrantUrl}/collections/' + $json.body.collection }}`, options: {timeout: 60000}}},
      {id: 'skill-embed-create', name: 'Create collection', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: at(1.5),
        parameters: {method: 'PUT', url: `={{ '${qdrantUrl}/collections/' + $('Embed request').first().json.body.collection }}`,
          sendBody: true, specifyBody: 'json',
          jsonBody: "={{ JSON.stringify({ vectors: { size: $('Embed request').first().json.body.dimensions || 1024, distance: 'Cosine' } }) }}",
          options: {timeout: 60000}}},
      code('skill-embed-documents', 'One item per document', `// Each Q/A pair and source passage becomes one vector.
const {collection,documents=[]}=$('Embed request').first().json.body;
if(!/^sop_[a-f0-9]{24}$/.test(collection??''))throw new Error('An SOP collection is required');
return documents.filter(item=>item?.content).map(item=>({json:{collection,content:String(item.content),
 type:String(item.metadata?.type??''),row:String(item.metadata?.row??''),section:String(item.metadata?.section??''),sop:String(item.metadata?.sop??'')}}));`, at(2)),
      {id: 'skill-embed-store', name: 'Store vectors · Qdrant', type: '@n8n/n8n-nodes-langchain.vectorStoreQdrant', typeVersion: 1.3, position: at(3),
        parameters: {mode: 'insert', qdrantCollection: {__rl: true, mode: 'id', value: "={{ $('One item per document').first().json.collection }}"},
          embeddingBatchSize: 16, options: {}},
        credentials: credentials.qdrant},
      {id: 'skill-embed-loader', name: 'Document loader', type: '@n8n/n8n-nodes-langchain.documentDefaultDataLoader', typeVersion: 1.1, position: at(3, 1.6),
        parameters: {dataType: 'json', jsonMode: 'expressionData', jsonData: '={{ $json.content }}', textSplittingMode: 'custom',
          options: {metadata: {metadataValues: ['sop', 'type', 'row', 'section'].map(name => ({name, value: `={{ $json.${name} }}`}))}}}},
      {id: 'skill-embed-splitter', name: 'Keep passages whole', type: '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter', typeVersion: 1,
        position: at(3, 3), parameters: {chunkSize: 4000, chunkOverlap: 0, options: {}}},
      embeddingsNode('skill-embed-embeddings', 'Local embeddings', at(4, 1.6), embedUrl),
      {id: 'skill-embed-output', name: 'Embed result', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.4, position: at(4),
        parameters: {respondWith: 'json', responseBody: "={{ {collection: $('One item per document').first().json.collection, vectors: $('One item per document').all().length} }}", options: {}}},
    ],
    connections: {
      'Embed request': {main: [[edge('Reset collection')]]}, 'Reset collection': {main: [[edge('Create collection')]]},
      'Create collection': {main: [[edge('One item per document')]]},
      'One item per document': {main: [[edge('Store vectors · Qdrant')]]}, 'Store vectors · Qdrant': {main: [[edge('Embed result')]]},
      'Document loader': {ai_document: [[edge('Store vectors · Qdrant', 'ai_document')]]},
      'Keep passages whole': {ai_textSplitter: [[edge('Document loader', 'ai_textSplitter')]]},
      'Local embeddings': {ai_embedding: [[edge('Store vectors · Qdrant', 'ai_embedding')]]},
    },
  };
  // Embed result must answer once, not per stored vector.
  embed.nodes.find(node => node.name === 'Embed result').executeOnce = true;

  const rag = {
    name: 'GeoVision · Skill · RAG', settings: {executionOrder: 'v1'},
    nodes: [
      workflowTrigger(skillMarkers.rag, ragInputs, at(0), templateVersion),
      {id: 'skill-rag-semantic', name: 'Semantic search · Qdrant', type: '@n8n/n8n-nodes-langchain.vectorStoreQdrant', typeVersion: 1.3, position: at(1),
        alwaysOutputData: true, onError: 'continueRegularOutput',
        parameters: {mode: 'load', qdrantCollection: {__rl: true, mode: 'id', value: "={{ $('Skill request').first().json.collection }}"},
          prompt: "={{ $('Skill request').first().json.query }}", topK: "={{ $('Skill request').first().json.topK || 4 }}",
          includeDocumentMetadata: false, options: {}},
        credentials: credentials.qdrant},
      embeddingsNode('skill-rag-embeddings', 'Local embeddings', at(1, 1.6), embedUrl),
      {...http('skill-rag-keywords', 'Keyword search', `${knowledgeUrl}/skills/lookup`,
        "={{ JSON.stringify({sopId: $('Skill request').first().json.sopId, query: $('Skill request').first().json.query, k: 3}) }}", at(2)),
        alwaysOutputData: true, onError: 'continueRegularOutput', executeOnce: true},
      code('skill-rag-merge', 'Retrieved context', `// Keyword matches (exact names, numbers, codes) first, then semantic matches.
const keyword=($input.first().json.results??[]).map(item=>[item.text,item.source].filter(Boolean).join('\\n'));
const semantic=$('Semantic search · Qdrant').all().map(item=>item.json.document?.pageContent??item.json.pageContent??'');
const passages=[...new Set([...keyword,...semantic].filter(Boolean))].slice(0,6);
return [{json:{context:passages.join('\\n'),passages}}];`, at(3)),
    ],
    connections: {
      'Skill request': {main: [[edge('Semantic search · Qdrant')]]}, 'Semantic search · Qdrant': {main: [[edge('Keyword search')]]},
      'Keyword search': {main: [[edge('Retrieved context')]]},
      'Local embeddings': {ai_embedding: [[edge('Semantic search · Qdrant', 'ai_embedding')]]},
    },
  };

  const runmap = {
    name: 'GeoVision · Skill · Runmap', settings: {executionOrder: 'v1'},
    nodes: [
      workflowTrigger(skillMarkers.runmap, runmapInputs, at(0), templateVersion),
      {id: 'skill-runmap-ensure', name: 'Ensure work_orders', type: 'n8n-nodes-base.dataTable', typeVersion: 1.1, position: at(1),
        parameters: {resource: 'table', operation: 'create', tableName: 'work_orders', columns: {column: workOrderColumns.map(name => ({name, type: 'string'}))},
          options: {createIfNotExists: true}}},
      {id: 'skill-runmap-read', name: 'Read work orders', type: 'n8n-nodes-base.dataTable', typeVersion: 1.1, position: at(2),
        alwaysOutputData: true, executeOnce: true,
        parameters: {resource: 'row', operation: 'get', dataTableId: {__rl: true, mode: 'name', value: 'work_orders'},
          matchType: 'allConditions', filters: {conditions: []}, returnAll: true}},
      code('skill-runmap-request', 'Runmap request', `// The runmap answers saved work-order questions from the newest 20 rows.
const input=$('Skill request').first().json;
const text=value=>String(value??'');
const work_orders=$input.all().map(item=>item.json).filter(row=>row.id&&row.order_id)
 .sort((a,b)=>text(b.createdAt).localeCompare(text(a.createdAt))).slice(0,20)
 .map(row=>({order_id:text(row.order_id),reference_number:text(row.reference_number),dispatch_date:text(row.dispatch_date),
  title:text(row.title),equipment_number:text(row.equipment_number),maintenance_items:text(row.maintenance_items),
  notes:text(row.notes),test_result:text(row.test_result),saved_at:text(row.createdAt)}));
return [{json:{sopId:input.sopId,sessionId:input.sessionId,text:text(input.text),turnId:text(input.turnId),
 start:input.start===true||input.start==='true',work_orders}}];`, at(3)),
      http('skill-runmap-step', 'Grounded step', `${knowledgeUrl}/skills/script`, '={{ JSON.stringify($json) }}', at(4), 240000),
    ],
    connections: {
      'Skill request': {main: [[edge('Ensure work_orders')]]}, 'Ensure work_orders': {main: [[edge('Read work orders')]]},
      'Read work orders': {main: [[edge('Runmap request')]]}, 'Runmap request': {main: [[edge('Grounded step')]]},
    },
  };
  return {embed, rag, runmap};
}

export const sopWorkflowName = sop => `GeoVision · SOP · ${sop.name}`.slice(0, 128);
export const sopMarker = id => `sop-${id}`;
export const sopSkillName = sop => `sop_${sop.id.slice(0, 8)}`;
const short = id => id.slice(0, 8);

// The SOP as the LLM wrote it, shown in the editor.
const sopNote = (sop, position) => ({
  id: 'sop-note', name: 'SOP', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position,
  parameters: {width: 640, height: 560, color: 5, content: [
    `## ${sop.name}`, `**File:** ${sop.file} · **Q/A:** ${sop.qaCount} · written by ${sop.model}`,
    `**Skills:** RAG (Qdrant \`${sop.collection}\`)${sop.kind === 'script' ? ' · Runmap (opening and script)' : ''}`,
    `**Purpose:** ${sop.purpose}`, `**Instructions:** ${sop.instructions}`,
    ...(sop.templates ? ['**Question templates:**', ...sop.templates.map(item => `- ${item.question} → ${item.answer}`)] : []),
    ...(sop.sections ? ['**Sections:** ' + sop.sections.map(item => `${item.number} ${item.title}`).join('；')] : []),
    '**Sample Q/A:**', ...(sop.qaSample ?? []).slice(0, 8).map(item => `- Q：${item.question}\n  A：${item.answer}`),
  ].join('\n')},
});

// ── An SOP agent ────────────────────────────────────────────────────────
// skills: the ids of the installed skill workflows {rag, runmap}.
export function sopWorkflow(sop, skills) {
  const runmap = sop.kind === 'script';  // documents with an opening/script runmap
  const ragTool = `rag_${short(sop.id)}`;
  const runmapTool = `runmap_${short(sop.id)}`;
  const request = "$('SOP request').first().json";
  const trigger = {
    id: sopMarker(sop.id), name: 'SOP request', type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1.1,
    position: at(0), notes: `${sop.purpose}\nSOP written ${sop.writtenAt} · ${templateVersion}`, notesInFlow: false,
    parameters: {inputSource: 'workflowInputs', workflowInputs: {values: sopInputs.map(([name, type = 'string']) => ({name, type}))}},
  };
  const rag = callTool('sop-rag-skill', ragTool, skills.rag,
    `RAG skill over the "${sop.name}" SOP (its Q/A and the uploaded file). Input: what to look up. Returns {context}. Use it for: ${sop.purpose}`,
    {sopId: sop.id, collection: sop.collection, query: "={{ $fromAI('query', 'What to look up, in the caller\\'s words', 'string') }}", topK: 4},
    ragInputs, at(2, 1.6));
  const nodes = [trigger, rag, chatModel(at(1, 1.6)), sopNote(sop, at(-3, -1.2))];
  const connections = {};
  if (!runmap) {
    // Retrieve, augment, answer: the RAG skill runs first on the caller's
    // words; the agent answers from it and may call the skill again.
    nodes.push(
      callWorkflow('sop-retrieve', 'Retrieve · RAG skill', skills.rag,
        {sopId: sop.id, collection: sop.collection, query: `={{ ${request}.text }}`, topK: 4}, ragInputs, at(1)),
      agentNode('SOP agent', `={{ '參考資料（只能根據這些回答）：\\n' + $json.context + '\\n\\n來電者：' + ${request}.text }}`,
        `你是電話語音客服，使用「${sop.name}」SOP。\n用途：${sop.purpose}\n作答規則：${sop.instructions}\n` +
        `根據提示中的參考資料回答；不夠時再呼叫 ${ragTool}。只根據資料回答，不可編造名稱、數字或代碼；查不到就請來電者換個說法。只用繁體中文，一到兩句，直接回答，不要條列、不要重複問題。`,
        at(2)),
      code('sop-reply', 'Grounded reply', `// Grounding: every number or code in the reply must appear in one retrieved
// passage together with what the caller asked about (the words the caller's
// question and the reply share, e.g. a name); otherwise the caller is asked
// to rephrase. A number from someone else's row is not accepted.
${parseObservation}
const steps=$input.first().json.intermediateSteps??[];
const nfkc=text=>String(text??'').normalize('NFKC');
const passages=[...($('Retrieve · RAG skill').first().json.passages??[]),
 ...steps.flatMap(step=>{const data=parse(step.observation);return data?.passages??[JSON.stringify(data??'')];})].map(nfkc);
let reply=String($input.first().json.output??'').replace(/[*#>\`_]/g,'').replace(/\\s*\\n+\\s*/g,' ').replace(/(?:^|\\s)(?:答|A)[：:]\\s*/g,' ').trim();
const asked=nfkc($('SOP request').first().json.text), said=nfkc(reply);
// Subjects: the caller's words without question words and fillers, kept
// when the reply repeats them (e.g. 「那蘇世豪的分機呢」 → 蘇世豪).
const generic=/分機|電話|是什麼|什麼|請問|我要|我想|查詢|幫我|轉接|找|的|呢|嗎|是誰|多少|號碼|那|一下|在嗎|[，。？！?!,.、：:]/g;
const subjects=asked.replace(generic,'|').split('|').map(part=>part.trim()).filter(part=>part.length>=2&&said.includes(part));
const facts=said.match(/[A-Za-z]*\\d[A-Za-z0-9-]*/g)??[];
const grounded=fact=>passages.some(text=>text.includes(fact)&&subjects.every(subject=>text.includes(subject)));
if(!reply||facts.some(fact=>!grounded(fact)))reply='不好意思，我沒有查到，請換個方式再說一次。';
return [{json:{reply,kind:'table',sopId:${JSON.stringify(sop.id)}}}];`, at(3)));
    Object.assign(connections, {
      'SOP request': {main: [[edge('Retrieve · RAG skill')]]}, 'Retrieve · RAG skill': {main: [[edge('SOP agent')]]},
      'SOP agent': {main: [[edge('Grounded reply')]]}, ...aiLinks('SOP agent', 'Local LLM', [ragTool]),
    });
    return {name: sopWorkflowName(sop), nodes, connections, settings: {executionOrder: 'v1'}};
  }
  // A document with an opening: the Runmap skill grounds every turn (the
  // opening checks, then the script's sections); RAG answers fact questions.
  const runmapValue = {sopId: sop.id, sessionId: `={{ ${request}.sessionId }}`, text: `={{ ${request}.text }}`,
    start: `={{ ${request}.start === true }}`, turnId: `={{ ${request}.turnId }}`};
  nodes.push(
    callTool('sop-runmap-skill', runmapTool, skills.runmap,
      `Runmap skill: run the next step of the "${sop.name}" opening and call script with the caller's words. Call it once every turn. Returns {reply}: the line to say.`,
      runmapValue, runmapInputs, at(3, 1.6)),
    ifTrue('sop-opening', 'Opening?', `${request}.start === true`, at(1)),
    callWorkflow('sop-open', 'Open · Runmap skill', skills.runmap, runmapValue, runmapInputs, at(2, -1)),
    agentNode('SOP agent', `={{ ${request}.text }}`,
      `你是電話語音客服，使用「${sop.name}」SOP。\n用途：${sop.purpose}\n作答規則：${sop.instructions}\n` +
      `每一輪都必須先呼叫 ${runmapTool}，它依開場與通話腳本決定下一句話；來電者詢問腳本或圖表中的事實時，可以呼叫 ${ragTool}。最後只輸出 ${runmapTool} 回傳的 reply，一字不改。`,
      at(2, 0.6)),
    code('sop-reply', 'Grounded reply', `// A runmap reply is always the Runmap skill's step: the agent's own
// wording is not spoken. If the agent did not run the skill, it runs here.
${parseObservation}
const request=${request};
const steps=$input.first().json.intermediateSteps??[];
let result;
for(const step of [...steps].reverse()){
  if(step.action?.tool!==${JSON.stringify(runmapTool)})continue;
  result=parse(step.observation);
  if(result?.reply)break;
}
if(!result?.reply)result=await this.helpers.httpRequest({method:'POST',url:'http://knowledge:8085/skills/script',json:true,timeout:240000,
 body:{sopId:${JSON.stringify(sop.id)},sessionId:request.sessionId,text:request.text,turnId:request.turnId,start:false}});
return [{json:{...result,kind:'script',sopId:${JSON.stringify(sop.id)},agent:String($input.first().json.output??'')}}];`, at(3, 0.6)),
    code('sop-opening-reply', 'Opening reply', `return [{json:{...$input.first().json,kind:'script',sopId:${JSON.stringify(sop.id)}}}];`, at(3, -1)));
  Object.assign(connections, {
    'SOP request': {main: [[edge('Opening?')]]},
    'Opening?': {main: [[edge('Open · Runmap skill')], [edge('SOP agent')]]},
    'Open · Runmap skill': {main: [[edge('Opening reply')]]}, 'SOP agent': {main: [[edge('Grounded reply')]]},
    ...aiLinks('SOP agent', 'Local LLM', [runmapTool, ragTool]),
  });
  return {name: sopWorkflowName(sop), nodes, connections, settings: {executionOrder: 'v1'}};
}

// ── The front desk agent: its skills are the SOP agents ────────────────
export const routerSignature = sops => [templateVersion, ...sops.filter(item => item.ready && item.workflowId)
  .map(item => `${item.id}@${item.workflowId}@${item.writtenAt}`).sort()].join('|');
export function routerWorkflow(sops = [], {knowledgeUrl = 'http://knowledge:8085', scenarioUrl = 'http://127.0.0.1:8087'} = {}) {
  const usable = sops.filter(item => item.ready && item.workflowId);
  const offers = [...new Set(usable.map(item => item.offer || item.name))];
  const greeting = `您好，請問您要${offers.join('，還是')}？`;
  const turn = "$('Turn').first().json";
  const skills = usable.map((sop, index) => callTool(`router-skill-${sop.id}`, sopSkillName(sop), sop.workflowId,
    `SOP agent · ${sop.offer || sop.name}: ${sop.purpose} Pass the caller's turn; returns the SOP's reply.`,
    {sessionId: `={{ ${turn}.sessionId }}`, text: `={{ ${turn}.text }}`, turnId: `={{ ${turn}.turnId }}`,
      start: `={{ !(${turn}.visited ?? []).includes(${JSON.stringify(sop.id)}) }}`}, sopInputs, at(4 + index, 1.6)));
  const skillList = usable.map(item => `- ${sopSkillName(item)}：${item.offer || item.name}。${item.purpose}`).join('\n');
  const system = `你是電話總機。每一輪都必須呼叫一個技能（工具）處理來電者這句話，然後只輸出該技能回傳的 reply，一字不改。
可用技能：
${skillList}
來電者如果是在回答目前技能上一句的問題（數字、是或否、選項、補充說明），就繼續用目前技能。
知識庫檢索列出每個技能最相符的內容與分數；分數明顯最高、且內容與來電者的話相符的技能，就是來電者要找的技能。`;
  const skillOf = JSON.stringify(Object.fromEntries(usable.map(item => [item.id, sopSkillName(item)])));
  const prompt = `={{ '目前技能：' + (${turn}.activeSkill || '無') + (${turn}.lastReply ? '（上一句 AI：' + ${turn}.lastReply + '）' : '') +
    '\\n知識庫檢索（分數越高越相關）：' + ($('RAG routing evidence').first().json.ranking || []).map(item => (${skillOf}[item.id] || item.id) + ' ' + item.score + '「' + item.match + '」').join('；') +
    '\\n來電者：' + ${turn}.text }}`;
  const table = Object.fromEntries(usable.map(item => [sopSkillName(item), {id: item.id, workflowId: item.workflowId, name: item.name, kind: item.kind}]));
  const nodes = [
    {id: routerMarker, name: 'SOP Input', type: 'n8n-nodes-base.webhook', typeVersion: 2.1, position: at(0),
      webhookId: 'ivr-sop', notes: routerSignature(usable), notesInFlow: false,
      parameters: {httpMethod: 'POST', path: 'ivr-sop', responseMode: 'responseNode', options: {}}},
    http('router-context', 'SOP context', `${knowledgeUrl}/sops/context`,
      "={{ JSON.stringify({sessionId: $('SOP Input').first().json.body.sessionId}) }}", at(1), 30000),
    code('router-turn', 'Turn', `// What this turn needs: a greeting, an SOP directly, or the front desk agent.
const body=$('SOP Input').first().json.body??{};
const {active}=$input.first().json;
const skills=${JSON.stringify(table)};
const bySkill=Object.entries(skills);
const sessionId=String(body.sessionId??'');
if(!sessionId)throw new Error('sessionId is required');
const fresh=body.start===true;
const activeSkill=fresh?'':bySkill.find(([,item])=>item.id===active?.sopId)?.[0]??'';
const visited=fresh?[]:active?.visited??[];
const base={sessionId,text:String(body.text??'').trim(),turnId:String(Date.now())+Math.random().toString(36).slice(2,8),
 visited,activeSkill,lastReply:fresh?'':active?.reply??''};
if(!bySkill.length)return [{json:{...base,action:'reply',reply:'目前沒有可用的服務，請稍後再撥。'}}];
if(fresh)return [{json:bySkill.length===1
 ?{...base,action:'run',sop:bySkill[0][1],start:true}
 :{...base,action:'reply',clear:true,reply:${JSON.stringify(greeting)}}}];
if(bySkill.length===1)return [{json:{...base,action:'run',sop:bySkill[0][1],start:!visited.includes(bySkill[0][1].id)}}];
return [{json:{...base,action:'agent'}}];`, at(2)),
    ifTrue('router-agent-needed', 'Front desk agent?', "$json.action === 'agent'", at(3)),
    http('router-rank', 'RAG routing evidence', `${knowledgeUrl}/sops/rank`, `={{ JSON.stringify({text: ${turn}.text}) }}`, at(3.4, -0.8), 60000),
    code('router-decisive', 'Decisive match?', `// An exact match of the caller's words in one SOP's file (a name, a
// code: score above 1) that clearly beats every other SOP routes there
// directly; anything less clear is the front desk agent's choice.
const turn=${turn};
const skills=${JSON.stringify(table)};
const [best,next]=$input.first().json.ranking??[];
const sop=best&&Object.values(skills).find(item=>item.id===best.id);
if(sop&&best.score>=1&&best.score-(next?.score??0)>=0.5)
  return [{json:{action:'run',sop,start:!(turn.visited??[]).includes(sop.id),decided:'rag'}}];
return [{json:{action:'agent'}}];`, at(3.7, -0.8)),
    ifTrue('router-decisive-if', 'Ask the agent?', "$json.action === 'agent'", at(3.9, -0.8)),
    agentNode('Front desk agent', prompt, system, at(4.2, -0.8)),
    {...chatModel(at(3, 1.6), 300), id: 'router-llm'},
    code('router-agent-result', 'Skill result', `// The reply the chosen SOP agent returned. Without one, the current
// SOP answers this turn (or, if there is none, the options are repeated).
${parseObservation}
const turn=${turn};
const skills=${JSON.stringify(table)};
const steps=$input.first().json.intermediateSteps??[];
for(const step of [...steps].reverse()){
  const result=parse(step.observation);
  if(result?.reply&&skills[step.action?.tool])return [{json:{...result,action:'done',skill:step.action.tool}}];
}
const current=skills[turn.activeSkill];
if(current)return [{json:{action:'run',sop:current,start:false}}];
return [{json:{action:'reply',reply:${JSON.stringify(greeting)}}}];`, at(5, -0.8)),
    ifTrue('router-run-needed', 'Run an SOP?', "$json.action === 'run'", at(6)),
    callWorkflow('router-execute', 'Run SOP agent', '={{ $json.sop.workflowId }}',
      {sessionId: `={{ ${turn}.sessionId }}`, text: `={{ ${turn}.text }}`, start: '={{ $json.start === true }}', turnId: `={{ ${turn}.turnId }}`},
      sopInputs, at(7, -0.8)),
    code('router-reply', 'Prepare reply', `const turn=${turn};
const result=$input.first().json;
const reply=String(result.reply??'').trim()||'不好意思，請再說一次。';
const skills=${JSON.stringify(table)};
const sopId=$('Turn').first().json.clear?null:(result.sopId??skills[turn.activeSkill]?.id??null);
return [{json:{...result,reply,sessionId:turn.sessionId,remember:{sessionId:turn.sessionId,sopId,reply}}}];`, at(8)),
    http('router-remember', 'Remember SOP', `${knowledgeUrl}/sops/session`, '={{ JSON.stringify($json.remember) }}', at(9), 30000),
    {id: 'router-output', name: 'SOP Output', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.4, position: at(10),
      parameters: {respondWith: 'json', responseBody: "={{ $('Prepare reply').first().json }}", options: {}}},
    // After the reply: a runmap call's call session and work orders.
    ifTrue('router-script-turn', 'Runmap turn?', "$('Prepare reply').first().json.kind === 'script'", at(11)),
    ifTrue('router-work-order', 'Work order to save?', "$('Prepare reply').first().json.work_order?.pending === true", at(12, -0.8)),
    http('router-extract', 'Extract work orders', `${knowledgeUrl}/ivr`,
      "={{ JSON.stringify({records: true, sessionId: $('Prepare reply').first().json.sessionId}) }}", at(13, -0.8), 240000),
    code('router-rows', 'One row per work order',
      "const records=$input.first().json.records;\nif(!Array.isArray(records))throw new Error('IVR engine returned no work orders');\nreturn records.map(record=>({json:record}));", at(14, -0.8)),
    {id: 'router-save-work-order', name: 'Save work order · Data Table', type: 'n8n-nodes-base.dataTable', typeVersion: 1.1, position: at(15, -0.8),
      parameters: {resource: 'row', operation: 'upsert', dataTableId: {__rl: true, mode: 'name', value: 'work_orders'},
        matchType: 'allConditions', filters: {conditions: [{keyName: 'report_key', condition: 'eq', keyValue: '={{ $json.report_key }}'}]},
        columns: {mappingMode: 'defineBelow', matchingColumns: [], schema: [], value: Object.fromEntries(workOrderColumns.map(name => [name, `={{ $json.${name} }}`]))},
        options: {}}},
    http('router-call-record', 'Call session record', `${knowledgeUrl}/ivr`,
      "={{ JSON.stringify({call: true, sessionId: $('Prepare reply').first().json.sessionId}) }}", at(12, 0.8)),
    http('router-call-columns', 'Ensure call_sessions columns', `${scenarioUrl}/call-sessions`, '={{ JSON.stringify($json) }}', at(13, 0.8), 120000),
    {id: 'router-save-call', name: 'Save call session · Data Table', type: 'n8n-nodes-base.dataTable', typeVersion: 1.1, position: at(14, 0.8),
      parameters: {resource: 'row', operation: 'upsert', dataTableId: {__rl: true, mode: 'name', value: 'call_sessions'},
        matchType: 'allConditions', filters: {conditions: [{keyName: 'session_id', condition: 'eq', keyValue: '={{ $json.session_id }}'}]},
        columns: {mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: []}, options: {}}},
    ...skills,
  ];
  return {
    name: routerName, nodes, settings: {executionOrder: 'v1'},
    connections: {
      'SOP Input': {main: [[edge('SOP context')]]}, 'SOP context': {main: [[edge('Turn')]]},
      'Turn': {main: [[edge('Front desk agent?')]]},
      'Front desk agent?': {main: [[edge('RAG routing evidence')], [edge('Run an SOP?')]]},
      'RAG routing evidence': {main: [[edge('Decisive match?')]]}, 'Decisive match?': {main: [[edge('Ask the agent?')]]},
      'Ask the agent?': {main: [[edge('Front desk agent')], [edge('Run an SOP?')]]},
      'Front desk agent': {main: [[edge('Skill result')]]}, 'Skill result': {main: [[edge('Run an SOP?')]]},
      'Run an SOP?': {main: [[edge('Run SOP agent')], [edge('Prepare reply')]]},
      'Run SOP agent': {main: [[edge('Prepare reply')]]}, 'Prepare reply': {main: [[edge('Remember SOP')]]},
      'Remember SOP': {main: [[edge('SOP Output')]]}, 'SOP Output': {main: [[edge('Runmap turn?')]]},
      'Runmap turn?': {main: [[edge('Work order to save?'), edge('Call session record')], []]},
      'Work order to save?': {main: [[edge('Extract work orders')], []]},
      'Extract work orders': {main: [[edge('One row per work order')]]}, 'One row per work order': {main: [[edge('Save work order · Data Table')]]},
      'Call session record': {main: [[edge('Ensure call_sessions columns')]]},
      'Ensure call_sessions columns': {main: [[edge('Save call session · Data Table')]]},
      ...aiLinks('Front desk agent', 'Local LLM', skills.map(skill => skill.name)),
    },
  };
}
