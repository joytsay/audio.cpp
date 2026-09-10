export interface OpenAIModel {
  id: string;
  family?: string;
  task?: string;
  loaded?: boolean;
}

export function apiEndpoint(base: string, path: string): string {
  const trimmed = base.trim();
  const root = trimmed || new URL('v1/', document.baseURI).toString();
  return `${root.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export function siblingWorkerEndpoint(port: number, path = 'v1'): string {
  const url = new URL(document.baseURI);
  // Preserve the address used to open the WebUI. This automatically supports
  // an AGX IP address, mDNS/DNS hostname, or localhost without container-side
  // knowledge of the host network interface.
  url.port = String(port);
  url.pathname = `/${path.replace(/^\/+|\/+$/g, '')}/`;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

async function responseError(response: Response): Promise<Error> {
  const fallback = `${response.status} ${response.statusText}`;
  const text = await response.text();
  if (!text) return new Error(fallback);
  try {
    const body = JSON.parse(text);
    return new Error(body?.error?.message || body?.message || text);
  } catch {
    return new Error(text);
  }
}

export async function endpointJson<T>(
  base: string,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(apiEndpoint(base, path), { ...init, headers, signal });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}

export async function endpointBlob(
  base: string,
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<Blob> {
  const response = await fetch(apiEndpoint(base, path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) throw await responseError(response);
  return response.blob();
}

export async function endpointModels(base: string, signal?: AbortSignal): Promise<OpenAIModel[]> {
  const response = await endpointJson<{ data?: OpenAIModel[] }>(base, 'models', {}, signal);
  return Array.isArray(response.data) ? response.data : [];
}

export function routerEndpoint(base: string, path = 'models'): string {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/\/v1\/?$/, '/');
  url.search = '';
  url.hash = '';
  return new URL(path, url).toString();
}

export async function endpointRouterModels(base: string, signal?: AbortSignal): Promise<OpenAIModel[]> {
  const response = await fetch(routerEndpoint(base), { signal });
  if (!response.ok) throw await responseError(response);
  const body = await response.json() as { data?: OpenAIModel[] };
  return Array.isArray(body.data) ? body.data : [];
}

export function chatText(response: any): string {
  const content = response?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('The LLM returned an invalid chat-completions response.');
  const text = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!text) throw new Error('The LLM returned an empty response.');
  return text;
}
