import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type UserRole = 'admin' | 'park_manager' | 'tree_manager' | 'user';

interface AuthUser {
  name: string;
  role: UserRole;
  roleLabel: string;
  department: string;
  allowedSections: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, role: UserRole) => void;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  canAccessSection: (section: string) => boolean;
}

const ROLE_CONFIG: Record<UserRole, { roleLabel: string; department: string; allowedSections: string[] }> = {
  admin: {
    roleLabel: '管理者',
    department: '技術指導課',
    allowedSections: ['all'],
  },
  park_manager: {
    roleLabel: '公園管理担当',
    department: '公園緑地管理科',
    allowedSections: ['park-mgmt', 'cases', 'map'],
  },
  tree_manager: {
    roleLabel: '樹木管理担当',
    department: '樹木管理科',
    allowedSections: ['tree-mgmt', 'cases', 'map'],
  },
  user: {
    roleLabel: '利用者',
    department: '緑地部・公園緑地課',
    allowedSections: ['map', 'cases'],
  },
};

const AUTH_STORAGE_KEY = 'eventflow-auth';

// Mock authentication: Login accepts any username with the selected role
// In production, user database would be managed by backend API

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser);

  const login = useCallback((username: string, _password: string, role: UserRole) => {
    // Mock authentication - in production, this would call backend API
    // Password is intentionally unused (prefixed with _) - will be validated by backend in production
    // Use the provided role directly
    const u: AuthUser = { name: username, role, ...ROLE_CONFIG[role] };
    setUser(u);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const hasRole = useCallback((roles: UserRole[]) => {
    return !!user && roles.includes(user.role);
  }, [user]);

  const canAccessSection = useCallback((section: string) => {
    if (!user) return false;
    return user.allowedSections.includes('all') || user.allowedSections.includes(section);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, hasRole, canAccessSection }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
