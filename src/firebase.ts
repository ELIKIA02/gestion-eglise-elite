const DB_PREFIX = 'church_';
const DB_KEY = 'church_db_data';

interface DocSnapshot {
  id: string;
  data(): Record<string, any>;
  exists: boolean;
}

interface Snapshot {
  forEach(cb: (doc: DocSnapshot) => void): void;
  docChanges(): Array<{ type: string; doc: DocSnapshot }>;
  size: number;
  empty: boolean;
}

type RefType = 'collection' | 'document';
interface CollectionRef { _type: 'collection'; path: string }
interface DocumentRef { _type: 'document'; path: string; collectionPath: string; id: string }
type DbRef = CollectionRef | DocumentRef;

function getApiBase(): string {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  return '';
}

let syncTimer: any = null;
function syncToServer(data: Record<string, any[]>) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch(`${getApiBase()}/api/data/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {});
  }, 500);
}

export async function loadFromServer(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/api/data/load`);
    const json = await res.json();
    if (json.success && json.data) {
      localStorage.setItem(DB_KEY, JSON.stringify(json.data));
      return true;
    }
  } catch {}
  return false;
}

function loadAll(): Record<string, any[]> {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveAll(data: Record<string, any[]>) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
  syncToServer(data);
}

function getCollectionData(name: string): any[] {
  return loadAll()[name] || [];
}

function saveToCollection(name: string, docs: any[]) {
  const all = loadAll();
  all[name] = docs;
  saveAll(all);
}

function genId(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const listeners = new Set<() => void>();
let notifyTimer: any = null;
function notifyListeners() {
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    listeners.forEach(fn => { try { fn(); } catch {} });
  }, 10);
}

export function collection(_db: any, path: string): CollectionRef {
  return { _type: 'collection', path };
}

export function doc(ref: any, pathOrId: string, maybeId?: string): DocumentRef {
  if (maybeId) {
    const collectionPath = pathOrId;
    return { _type: 'document', path: `${collectionPath}/${maybeId}`, collectionPath, id: maybeId };
  }
  const parts = pathOrId.split('/');
  const id = parts.pop() || '';
  const collectionPath = parts.join('/');
  return { _type: 'document', path: `${collectionPath}/${id}`, collectionPath, id };
}

export function query(ref: CollectionRef): CollectionRef {
  return ref;
}

export async function addDoc(ref: CollectionRef, data: any): Promise<{ id: string }> {
  const id = data.id || genId();
  const docData = { ...data, id };
  const docs = getCollectionData(ref.path);
  docs.push(docData);
  saveToCollection(ref.path, docs);
  notifyListeners();
  return { id };
}

export async function updateDoc(ref: DocumentRef, data: any): Promise<void> {
  const docs = getCollectionData(ref.collectionPath);
  const idx = docs.findIndex((d: any) => d.id === ref.id);
  if (idx !== -1) {
    docs[idx] = { ...docs[idx], ...data };
    saveToCollection(ref.collectionPath, docs);
    notifyListeners();
  }
}

export async function setDoc(ref: DocumentRef, data: any): Promise<void> {
  const docs = getCollectionData(ref.collectionPath);
  const idx = docs.findIndex((d: any) => d.id === ref.id);
  if (idx !== -1) {
    docs[idx] = { ...docs[idx], ...data };
  } else {
    docs.push({ id: ref.id, ...data });
  }
  saveToCollection(ref.collectionPath, docs);
  notifyListeners();
}

export async function deleteDoc(ref: DocumentRef): Promise<void> {
  const docs = getCollectionData(ref.collectionPath);
  const filtered = docs.filter((d: any) => d.id !== ref.id);
  saveToCollection(ref.collectionPath, filtered);
  notifyListeners();
}

export function onSnapshot(
  ref: CollectionRef | DocumentRef,
  onNext: (snapshot: Snapshot) => void,
  onError?: (err: any) => void
): () => void {
  const read = () => {
    try {
      if (ref._type === 'collection') {
        const docs = getCollectionData(ref.path);
        const snap: Snapshot = {
          size: docs.length,
          empty: docs.length === 0,
          forEach(cb) { docs.forEach(d => cb({ id: d.id, data: () => ({ ...d }), exists: true })); },
          docChanges() { return docs.map(d => ({ type: 'modified', doc: { id: d.id, data: () => ({ ...d }), exists: true } })); }
        };
        onNext(snap);
      } else {
        const docs = getCollectionData(ref.collectionPath);
        const found = docs.find((d: any) => d.id === ref.id);
        const snap: Snapshot = {
          size: found ? 1 : 0,
          empty: !found,
          forEach(cb) { if (found) cb({ id: found.id, data: () => ({ ...found }), exists: true }); },
          docChanges() { return found ? [{ type: 'modified', doc: { id: found.id, data: () => ({ ...found }), exists: true } }] : []; }
        };
        onNext(snap);
      }
    } catch (err) {
      onError?.(err);
    }
  };

  read();
  const handler = () => read();
  listeners.add(handler);
  return () => { listeners.delete(handler); };
}

export function getDoc(ref: DocumentRef): Promise<{ exists: boolean; data(): Record<string, any> | undefined; id: string }> {
  const docs = getCollectionData(ref.collectionPath);
  const found = docs.find((d: any) => d.id === ref.id);
  return Promise.resolve({
    exists: !!found,
    id: ref.id,
    data: () => found ? { ...found } : undefined
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`[DB Error] ${operationType} on ${path}:`, error);
  throw error;
}

export const db = {};
export const auth = {
  currentUser: null,
  onAuthStateChanged: (cb: any) => { setTimeout(() => cb(null), 0); return () => {}; }
};
