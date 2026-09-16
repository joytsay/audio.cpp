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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Voice library operation failed.'));
    tx.oncomplete = () => database.close();
    tx.onerror = () => {
      database.close();
      reject(tx.error || new Error('Voice library transaction failed.'));
    };
  }));
}

export async function listVoices(): Promise<SavedVoice[]> {
  const voices = await transaction<SavedVoice[]>('readonly', (store) => store.getAll());
  return voices.sort((left, right) => right.createdAt - left.createdAt);
}

export function saveVoice(voice: SavedVoice): Promise<IDBValidKey> {
  return transaction<IDBValidKey>('readwrite', (store) => store.put(voice));
}

export function deleteVoice(id: string): Promise<undefined> {
  return transaction<undefined>('readwrite', (store) => store.delete(id));
}
