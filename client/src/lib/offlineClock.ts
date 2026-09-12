export type OfflineClockPayload = {
  entryType: "clock_in" | "clock_out";
  selfieBase64: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters?: number;
};

const DB_NAME = "fieldface-offline";
const STORE = "clock-queue";
const STATUS_KEY = "fieldface-last-status";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueClock(payload: OfflineClockPayload) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ payload, queuedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncQueuedClocks(send: (payload: OfflineClockPayload) => Promise<unknown>) {
  const db = await openDb();
  const items = await new Promise<Array<{ id: number; payload: OfflineClockPayload }>>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  for (const item of items) {
    await send(item.payload);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(item.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  return items.length;
}

export function cacheEmployeeStatus(status: unknown) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(status));
}

export function getCachedEmployeeStatus<T>() {
  try {
    const value = localStorage.getItem(STATUS_KEY);
    return value ? JSON.parse(value) as T : undefined;
  } catch {
    return undefined;
  }
}

export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}
