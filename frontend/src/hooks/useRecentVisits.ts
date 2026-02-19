import { useEffect, useState } from 'react';

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
const CHANGE_EVENT = 'recent-visits-changed';

function readVisits(): RecentVisit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordVisit(path: string, label: string) {
  const visits = readVisits().filter((v) => v.path !== path);
  visits.unshift({ path, label, visitedAt: Date.now() });
  const trimmed = visits.slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useRecentVisits(): RecentVisit[] {
  const [visits, setVisits] = useState(readVisits);

  useEffect(() => {
    const refresh = () => setVisits(readVisits());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return visits;
}
