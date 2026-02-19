import { useSyncExternalStore } from 'react';

export interface RecentVisit {
  /** Route path, e.g. /assets/parks/GS-nliigh01 */
  path: string;
  /** Display label, e.g. 名城公園 */
  label: string;
  /** Timestamp of the visit */
  visitedAt: number;
}

const STORAGE_KEY = 'recent-visits';
const MAX_ITEMS = 4;

let listeners: Array<() => void> = [];
function emitChange() {
  for (const l of listeners) l();
}

function getSnapshot(): RecentVisit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

let cachedSnapshot = getSnapshot();
let cachedJson = JSON.stringify(cachedSnapshot);

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshotStable(): RecentVisit[] {
  const current = getSnapshot();
  const json = JSON.stringify(current);
  if (json !== cachedJson) {
    cachedSnapshot = current;
    cachedJson = json;
  }
  return cachedSnapshot;
}

export function recordVisit(path: string, label: string) {
  const visits = getSnapshot().filter((v) => v.path !== path);
  visits.unshift({ path, label, visitedAt: Date.now() });
  const trimmed = visits.slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  cachedSnapshot = trimmed;
  cachedJson = JSON.stringify(trimmed);
  emitChange();
}

export function useRecentVisits(): RecentVisit[] {
  return useSyncExternalStore(subscribe, getSnapshotStable, getSnapshotStable);
}
