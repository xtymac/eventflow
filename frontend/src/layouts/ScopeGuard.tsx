import { Navigate, useParams } from 'react-router-dom';
import { useAuth, ALL_SCOPES, type Scope } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

interface ScopeGuardProps {
  children: ReactNode;
}

export function ScopeGuard({ children }: ScopeGuardProps) {
  const { scope } = useParams<{ scope: string }>();
  const { canAccessScope } = useAuth();

  if (!scope || !ALL_SCOPES.includes(scope as Scope)) {
    return <Navigate to="/404" replace />;
  }

  if (!canAccessScope(scope as Scope)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
