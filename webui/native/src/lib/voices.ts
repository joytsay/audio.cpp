import { jsonRequest } from './api';

export interface SavedVoice {
  id: string;
  name: string;
  transcript: string;
  audio: Blob;
  createdAt: number;
}

const databaseName = 'audiocpp-native-studio';
const storeName = 'voices';

export function createLocalId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the voice library.'));
  });
}

function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const tx = database.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    request.onerror = () => reject(request.error || new Error('Voice library operation failed.'));
    tx.oncomplete = () => { database.close(); resolve(request.result); };
    tx.onabort = () => { database.close(); reject(tx.error || new Error('Voice library transaction was aborted.')); };
    tx.onerror = () => {
      database.close();
      reject(tx.error || new Error('Voice library transaction failed.'));
    };
  }));
}

type StoredVoice = Omit<SavedVoice, 'audio'> & { audio: string };

function encodedAudio(audio: Blob): Promise<string> {
  if (audio.size > 16 * 1024 * 1024) throw new Error('Reference voice exceeds the 16 MiB limit.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error || new Error('Could not read reference audio.'));
    reader.readAsDataURL(audio);
  });
}

async function serverVoices(): Promise<StoredVoice[]> {
  return (await jsonRequest<{ voices: StoredVoice[] }>('/v1/ui/voices', { cache: 'no-store' })).voices;
}

let listing: Promise<SavedVoice[]> | undefined;
export function listVoices(): Promise<SavedVoice[]> {
  // Coalesce startup/focus refreshes so legacy recordings import only once.
  if (!listing) listing = loadVoices().finally(() => { listing = undefined; });
  return listing;
}

async function loadVoices(): Promise<SavedVoice[]> {
  let voices = await serverVoices();
  let local: SavedVoice[] = [];
  // IndexedDB may be unavailable in private browsing. The shared library still works.
  try { local = await transaction<SavedVoice[]>('readonly', (store) => store.getAll()); } catch { /* no legacy voices */ }
  let imported = false;
  for (const voice of local) {
    const marker = `audiocpp.shared-voice-imported.${voice.id}`;
    if (localStorage.getItem(marker)) continue;
    if (!voices.some((saved) => saved.id === voice.id)) {
      await saveVoice(voice);
      imported = true;
    }
    // Keep the original as a local backup, but never resurrect a shared deletion.
    localStorage.setItem(marker, '1');
  }
  if (imported) voices = await serverVoices();
  return voices.map((voice) => ({
    ...voice,
    audio: new Blob([Uint8Array.from(atob(voice.audio), (character) => character.charCodeAt(0))], { type: 'audio/wav' })
  })).sort((left, right) => right.createdAt - left.createdAt);
}

export async function saveVoice(voice: SavedVoice): Promise<void> {
  await jsonRequest('/v1/ui/voices', {
    method: 'POST',
    body: JSON.stringify({ ...voice, audio: await encodedAudio(voice.audio) })
  });
}

export async function deleteVoice(id: string): Promise<void> {
  await jsonRequest(`/v1/ui/voices?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
