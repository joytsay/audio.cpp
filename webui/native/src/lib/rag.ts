import { endpointJson } from './openai';

export type GraphMode = 'local' | 'global';

export interface RagCitation {
  source: string;
  startLine?: number;
  endLine?: number;
}

export interface RagHit {
  id?: string | number;
  score?: number;
  text: string;
  uri?: string;
  citation?: RagCitation;
}

export interface GraphResult {
  hits?: RagHit[];
  summary?: string;
  communities?: Array<{ id?: string | number; title?: string; size?: number; summary?: string }>;
}

interface GraphReply {
  result?: GraphResult;
  error?: { code?: number; message?: string };
}

interface InitializeReply {
  result?: {
    protocolVersion?: number;
    server?: { name?: string; version?: string };
    capabilities?: Record<string, unknown>;
  };
  error?: { code?: number; message?: string };
}

interface IndexReply {
  result?: { ids?: Array<string | number>; chunks?: number };
  error?: { code?: number; message?: string };
}

function rpcBody(id: number, method: string, params: Record<string, unknown>): string {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params });
}

async function initialize(baseUrl: string, signal?: AbortSignal): Promise<void> {
  const reply = await endpointJson<InitializeReply>(baseUrl, 'rag/initialize', {
    method: 'POST',
    body: rpcBody(Date.now(), 'initialize', {
      protocolVersion: 1,
      client: { name: 'audio.cpp-webui', version: '1.0' },
      capabilities: {}
    })
  }, signal);

  if (!reply.error) return;

  // rag-cpp keeps one RCP session for the lifetime of its HTTP server. Calling
  // initialize again is required by this client flow but is rejected after the
  // first successful handshake, so an already-initialized response is safe.
  if (reply.error.message?.includes('already initialized')) return;
  throw new Error(reply.error.message || `GraphRAG initialization error ${reply.error.code ?? ''}`.trim());
}

export async function graphSearch(
  baseUrl: string,
  query: string,
  mode: GraphMode,
  k: number,
  signal?: AbortSignal
): Promise<GraphResult> {
  await initialize(baseUrl, signal);

  const reply = await endpointJson<GraphReply>(baseUrl, 'rag/graph', {
    method: 'POST',
    body: rpcBody(Date.now(), 'graph', { op: mode, query, k: Math.min(100, k + 4) })
  }, signal);
  if (reply.error) throw new Error(reply.error.message || `GraphRAG error ${reply.error.code ?? ''}`.trim());
  if (!reply.result) throw new Error('GraphRAG returned an invalid response.');
  const hits = (reply.result.hits || [])
    .filter((hit) => {
      const source = hit.citation?.source || hit.uri || '';
      return !/(^|[\\/])system-prompt\.md$/i.test(source);
    })
    .slice(0, k);
  return { ...reply.result, hits };
}

export async function indexKnowledgeDocument(
  baseUrl: string,
  document: { uri: string; title: string; text: string },
  signal?: AbortSignal
): Promise<void> {
  await initialize(baseUrl, signal);
  const reply = await endpointJson<IndexReply>(baseUrl, 'rag/index/add', {
    method: 'POST',
    body: rpcBody(Date.now(), 'index/add', {
      documents: [{ id: document.uri, uri: document.uri, title: document.title, text: document.text }]
    })
  }, signal);
  if (reply.error) throw new Error(reply.error.message || `GraphRAG indexing error ${reply.error.code ?? ''}`.trim());
}

export function graphContext(result: GraphResult): string {
  const sections: string[] = [];
  const hits = result.hits || [];
  const maxScore = hits.reduce((maximum, hit) =>
    typeof hit.score === 'number' && Number.isFinite(hit.score)
      ? Math.max(maximum, hit.score)
      : maximum, 0);
  if (result.summary?.trim()) sections.push(result.summary.trim());
  for (const [index, hit] of hits.entries()) {
    const source = hit.citation?.source || hit.uri || String(hit.id ?? `result-${index + 1}`);
    const displaySource = source.split(/[\\/]/).filter(Boolean).pop() || source;
    const score = typeof hit.score === 'number' && Number.isFinite(hit.score) ? hit.score : null;
    const relative = score !== null && maxScore > 0
      ? Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)))
      : null;
    const scoreLine = score === null
      ? ''
      : `\nRelevance: ${score.toFixed(3)}${relative === null ? '' : ` · Relative match: ${relative}%`}`;
    sections.push(`[${index + 1}] ${displaySource}${scoreLine}\n${hit.text}`);
  }
  for (const community of result.communities || []) {
    const text = community.summary || community.title;
    if (text) sections.push(`[Community ${community.id ?? ''}] ${text}`);
  }
  return sections.join('\n\n');
}

export function graphCitations(result: GraphResult): string[] {
  return (result.hits || []).map((hit, index) => {
    const citation = hit.citation;
    const source = citation?.source || hit.uri || String(hit.id ?? `result-${index + 1}`);
    if (!citation?.startLine) return source;
    const end = citation.endLine && citation.endLine !== citation.startLine ? `–${citation.endLine}` : '';
    return `${source}:${citation.startLine}${end}`;
  });
}

const traditionalVariants: Record<string, string> = {
  '们': '們', '关': '關', '这': '這', '机': '機', '个': '個', '现': '現',
  '帮': '幫', '边': '邊', '发': '發', '台': '台'
};

function comparableSpeech(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[们关这机个现帮边发台]/g, (character) => traditionalVariants[character] || character)
    .replace(/[啊嗯呃喔哦]/g, '')
    .replace(/[\p{P}\p{S}\s]/gu, '');
}

function bigramSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const counts = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index += 1) {
    const token = left.slice(index, index + 2);
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  let overlap = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const token = right.slice(index, index + 2);
    const remaining = counts.get(token) || 0;
    if (remaining > 0) {
      overlap += 1;
      counts.set(token, remaining - 1);
    }
  }
  return (2 * overlap) / (left.length + right.length - 2);
}

export function matchedExampleOutput(result: GraphResult, input: string): string {
  const normalizedInput = comparableSpeech(input);
  let bestOutput = '';
  let bestSimilarity = 0;
  for (const hit of result.hits || []) {
    const match = hit.text.match(/輸入[：:]\s*([\s\S]*?)\s*輸出[：:]\s*([\s\S]*?)(?:\s*範例只用來|$)/);
    if (!match) continue;
    const similarity = bigramSimilarity(normalizedInput, comparableSpeech(match[1]));
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestOutput = match[2].trim();
    }
  }
  return bestSimilarity >= 0.70 ? bestOutput : '';
}
