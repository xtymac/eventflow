import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type UserRole = 'admin' | 'park_manager' | 'tree_manager' | 'user';

export type Scope = 'parks' | 'facilities' | 'park-trees' | 'street-trees' | 'green-lands';

export type Department = 'park' | 'tree';

export const DEPT_SCOPES: Record<Department, Scope[]> = {
  park: ['parks', 'facilities', 'green-lands'],
  tree: ['park-trees', 'street-trees'],
};

export const ALL_SCOPES: Scope[] = ['parks', 'facilities', 'park-trees', 'street-trees', 'green-lands'];

export function scopeToDepartment(scope: Scope): Department {
  return DEPT_SCOPES.tree.includes(scope) ? 'tree' : 'park';
}

interface AuthUser {
  name: string;
  role: UserRole;
  roleLabel: string;
  department: string;
  allowedSections: string[];
  allowedScopes: Scope[];
  scope: Scope;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, role: UserRole) => void;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  canAccessSection: (section: string) => boolean;
  canAccessScope: (scope: Scope) => boolean;
  scope: Scope;
  setScope: (scope: Scope) => void;
  allowedScopes: Scope[];
}

const ROLE_CONFIG: Record<UserRole, {
  roleLabel: string;
  department: string;
  allowedSections: string[];
  allowedScopes: Scope[];
  defaultScope: Scope;
}> = {
  admin: {
    roleLabel: '管理者',
    department: '技術指導課',
    allowedSections: ['all'],
    allowedScopes: ALL_SCOPES,
    defaultScope: 'parks',
  },
  park_manager: {
    roleLabel: '公園管理担当',
    department: '公園緑地管理科',
    allowedSections: ['park-mgmt', 'cases', 'map'],
    allowedScopes: ['parks', 'facilities', 'green-lands'],
    defaultScope: 'parks',
  },
  tree_manager: {
    roleLabel: '樹木管理担当',
    department: '樹木管理科',
    allowedSections: ['tree-mgmt', 'cases', 'map'],
    allowedScopes: ['park-trees', 'street-trees'],
    defaultScope: 'park-trees',
  },
  user: {
    roleLabel: '利用者',
    department: '緑地部・公園緑地課',
    allowedSections: ['map', 'cases', 'park-mgmt'],
    allowedScopes: ['parks', 'facilities'],
    defaultScope: 'parks',
  },
};

const AUTH_STORAGE_KEY = 'eventflow-auth';

// Mock authentication: Login accepts any username with the selected role
// In production, user database would be managed by backend API

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      // Migrate old format: add scope fields if missing
      if (!user.allowedScopes) {
        const config = ROLE_CONFIG[user.role as UserRole];
        if (config) {
          user.allowedScopes = config.allowedScopes;
          user.scope = config.defaultScope;
        }
      }
      return user;
    }
  } catch { /* ignore */ }
  return null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser);

  const login = useCallback((username: string, _password: string, role: UserRole) => {
    // Mock authentication - in production, this would call backend API
    // Password is intentionally unused (prefixed with _) - will be validated by backend in production
    const config = ROLE_CONFIG[role];
    const u: AuthUser = {
      name: username,
      role,
      roleLabel: config.roleLabel,
      department: config.department,
      allowedSections: config.allowedSections,
      allowedScopes: config.allowedScopes,
      scope: config.defaultScope,
    };
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

  const canAccessScope = useCallback((s: Scope) => {
    if (!user) return false;
    return user.allowedScopes.includes(s);
  }, [user]);

  const setScope = useCallback((s: Scope) => {
    if (!user) return;
    const updated = { ...user, scope: s };
    setUser(updated);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout,
      hasRole,
      canAccessSection,
      canAccessScope,
      scope: user?.scope ?? 'parks',
      setScope,
      allowedScopes: user?.allowedScopes ?? [],
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
