import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

interface SectionGuardProps {
  section: string;
  children: ReactNode;
}

export function SectionGuard({ section, children }: SectionGuardProps) {
  const { canAccessSection } = useAuth();

  if (!canAccessSection(section)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
