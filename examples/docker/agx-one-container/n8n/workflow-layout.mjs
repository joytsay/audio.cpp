export const ivrWorkflowId = 'ivrWorkflow';
export const knowledgeToolsId = 'ivrKnowledgeTools';
export const scenarioAdminId = 'ivrScenarioAdmin';

const sections = [
  { id: ivrWorkflowId, anchors: ['ivr-input', 'scenario-report-input', 'workflow-group-1'] },
  {
    id: knowledgeToolsId, name: 'GeoVision · Knowledge Tools',
    anchors: ['maintenance-mcp-trigger', 'rag-tool-input', 'manual-rag-test', 'workflow-group-2', 'workflow-group-3'],
  },
  {
    id: scenarioAdminId, name: 'GeoVision · Scenario Admin', offset: 1990,
    anchors: ['scenario-list-webhook', 'delete-scenario-webhook', 'scenario-file-import-webhook'],
  },
  { id: 'ivrDocumentRag', name: 'GeoVision · Document RAG', offset: 2580, anchors: ['document-rag-input'] },
];

// Publish the main draft first so n8n releases the production paths that moved.
export const managedWorkflowIds = sections.map(section => section.id);
export const workflowLayoutRevision = 25;
export const scenarioToolPosition = index => [630 + 260 * index, 370];
const scenarioAdminRevision = 26;

export function removeLegacyScenarioUpload(workflow) {
  const uploadIds = new Set(['scenario-upload-webhook', 'prepare-scenario-upload', 'create-scenario-qa',
    'index-scenario-qa', 'scenario-upload-response']);
  const names = new Set(workflow.nodes.filter(node => uploadIds.has(node.id)).map(node => node.name));
  if (!names.size) return null;

  const next = structuredClone(workflow);
  next.nodes = next.nodes.filter(node => !names.has(node.name));
  for (const name of names) {
    delete next.connections[name];
    if (next.pinData) delete next.pinData[name];
  }
  for (const outputs of Object.values(next.connections)) {
    for (const [type, groups] of Object.entries(outputs)) {
      outputs[type] = groups.map(edges => edges?.filter(edge => !names.has(edge.node)) ?? []);
    }
  }
  next.meta = { ...next.meta, ivrWorkflowRevision: Math.max(next.meta?.ivrWorkflowRevision || 0, scenarioAdminRevision) };
  return next;
}

function configureDocumentEndpoints(workflow) {
  const prepare = workflow.nodes.find(node => node.id === 'document-rag-prepare');
  const end = 'return [{json:{...input,ids:input.documents.map(d=>d.id)}}];';
  if (!prepare?.parameters.jsCode?.includes(end)) return;
  const qdrantCollections = 'http://knowledge:6333/collections/';
  const embeddingUrl = 'http://voice-ai:8088/embedding';
  const endpoints = `const collectionUrl=${JSON.stringify(qdrantCollections)}+input.collection;
const embeddingUrl=${JSON.stringify(embeddingUrl)};
return [{json:{...input,collectionUrl,embeddingUrl,ids:input.documents.map(d=>d.id)}}];`;
  prepare.parameters.jsCode = prepare.parameters.jsCode.replace(end, endpoints);
  const prepared = '$(' + JSON.stringify(prepare.name) + ').first().json.';
  for (const node of workflow.nodes) {
    const url = node.parameters?.url;
    if (url === embeddingUrl) node.parameters.url = '={{ ' + prepared + 'embeddingUrl }}';
    else if (typeof url === 'string' && url.startsWith(`={{ '${qdrantCollections}'`)) {
      const suffix = url.match(/\.collection \+ '([^']*)' }}$/)?.[1];
      if (suffix !== undefined)
        node.parameters.url = '={{ ' + prepared + 'collectionUrl' + (suffix ? ' + ' + JSON.stringify(suffix) : '') + ' }}';
    }
  }
}

function layoutKnowledge(workflow) {
  const positions = {
    'maintenance-mcp-trigger': [220, 150],
    'lookup-maintenance-guidance': [70, 370],
    'add-work-order': [350, 370],
    'workflow-group-2': [0, 0],
    'workflow-group-3': [0, 550],
  };
  let scenarioTools = 0;
  for (const node of workflow.nodes) {
    if (positions[node.id]) node.position = positions[node.id];
    else if (node.id.startsWith('scenario-file-')) node.position = scenarioToolPosition(scenarioTools++);
    else node.position[1] -= 320;
    if (node.id === 'workflow-group-2') Object.assign(node.parameters, {
      width: 590, height: 510, content: '## Scenario MCP\nCall tools and tools registered by scenario imports.',
    });
    if (node.id === 'workflow-group-3') Object.assign(node.parameters, {
      width: 2190, height: 780, content: '## Knowledge and work orders\nRead or save native Data Table rows and retrieve source evidence.',
    });
  }
}

export function splitManagedWorkflow(workflow) {
  workflow = removeLegacyScenarioUpload(workflow) ?? workflow;
  const byName = new Map(workflow.nodes.map(node => [node.name, node]));
  const neighbors = new Map(workflow.nodes.map(node => [node.name, new Set()]));
  for (const [from, outputs] of Object.entries(workflow.connections)) {
    for (const groups of Object.values(outputs)) for (const edges of groups) for (const { node: to } of edges) {
      neighbors.get(from)?.add(to);
      neighbors.get(to)?.add(from);
    }
  }
  const owners = new Map();
  for (const section of sections) {
    const visit = workflow.nodes.filter(node => section.anchors.includes(node.id)).map(node => node.name);
    for (const name of visit) {
      const owner = owners.get(name);
      if (owner === section.id || !byName.has(name)) continue;
      if (owner) throw new Error(`Cannot move node "${name}" because a local connection links two workflow sections`);
      owners.set(name, section.id);
      visit.push(...neighbors.get(name));
    }
  }

  return sections.map(section => {
    const belongs = name => (owners.get(name) ?? ivrWorkflowId) === section.id;
    const main = section.id === ivrWorkflowId;
    const next = {
      ...(main ? structuredClone(workflow) : {}),
      id: main ? workflow.id : section.id,
      name: section.name ?? workflow.name,
      active: main && workflow.active,
      nodes: workflow.nodes.filter(node => belongs(node.name)).map(node => structuredClone(node)),
      connections: structuredClone(Object.fromEntries(Object.entries(workflow.connections).filter(([name]) => belongs(name)))),
      settings: structuredClone(workflow.settings),
      pinData: structuredClone(Object.fromEntries(Object.entries(workflow.pinData ?? {}).filter(([name]) => belongs(name)))),
      meta: { ...(main ? workflow.meta : {}),
        ivrWorkflowRevision: section.id === scenarioAdminId ? scenarioAdminRevision : workflowLayoutRevision },
    };
    if (section.offset) for (const node of next.nodes) node.position[1] -= section.offset;
    if (section.id === knowledgeToolsId) {
      for (const node of next.nodes) {
        const target = node.parameters?.workflowId;
        if (target?.value === workflow.id) target.value = knowledgeToolsId;
        else if (target === workflow.id) node.parameters.workflowId = knowledgeToolsId;
      }
      layoutKnowledge(next);
    }
    if (section.id === 'ivrDocumentRag') configureDocumentEndpoints(next);
    return next;
  });
}
