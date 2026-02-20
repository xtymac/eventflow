import type { Scope, Department } from '@/contexts/AuthContext';
import { scopeToDepartment } from '@/contexts/AuthContext';

export const DEPARTMENTS = [
  { label: '公園管理', value: 'park' as const, route: '/assets/parks' },
  { label: '樹木管理', value: 'tree' as const, route: '/assets/park-trees' },
] as const;

/** Derive current department from URL pathname */
export function detectDepartment(pathname: string): Department {
  const match = pathname.match(/^\/assets\/([^/]+)/);
  if (match) return scopeToDepartment(match[1] as Scope);
  return 'park';
}
