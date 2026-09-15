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
    body: rpcBody(Date.now(), 'graph', { op: mode, query, k })
  }, signal);
  if (reply.error) throw new Error(reply.error.message || `GraphRAG error ${reply.error.code ?? ''}`.trim());
  if (!reply.result) throw new Error('GraphRAG returned an invalid response.');
  return reply.result;
}

export function graphContext(result: GraphResult): string {
  const sections: string[] = [];
  if (result.summary?.trim()) sections.push(result.summary.trim());
  for (const [index, hit] of (result.hits || []).entries()) {
    const source = hit.citation?.source || hit.uri || String(hit.id ?? `result-${index + 1}`);
    sections.push(`[${index + 1}] ${source}\n${hit.text}`);
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
