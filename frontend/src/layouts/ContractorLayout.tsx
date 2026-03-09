import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LogOut } from 'lucide-react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const HEADER_HEIGHT = 52;

const CONTRACTOR_TABS = [
  { label: '地図', to: '/contractor/map', matchPaths: ['/contractor/map'] },
  { label: '点検記録', to: '/contractor/inspections', matchPaths: ['/contractor/inspections'] },
  { label: '修理記録', to: '/contractor/repairs', matchPaths: ['/contractor/repairs'] },
];

export function ContractorLayout() {
  const { user, isAuthenticated, hasRole, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!isAuthenticated) {
    const next = pathname !== '/contractor' ? `?next=${encodeURIComponent(pathname)}` : '';
    return <Navigate to={`/login${next}`} replace />;
  }

  if (!hasRole(['contractor'])) {
    return <Navigate to="/403" replace />;
  }

  return (
    <div className="flex h-screen flex-col" data-testid="contractor-layout">
      {/* Header */}
      <header
        className="flex flex-none items-center justify-between bg-white px-4 md:px-10"
        style={{ height: HEADER_HEIGHT, maxHeight: HEADER_HEIGHT, borderBottom: '1px solid var(--sidebar-sidebar-border, #E5E5E5)', boxSizing: 'border-box' }}
        data-testid="contractor-header"
      >
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/contractor/map')} className="border-0 appearance-none bg-transparent cursor-pointer">
            <img src="/logo.svg" alt="EventFlow" width={28} height={28} className="rounded-lg" />
          </button>
          <span className="text-sm text-foreground" data-testid="contractor-header-title">情報登録機能</span>
        </div>

        {/* Center: Tab navigation */}
        <nav className="hidden sm:flex items-center gap-1" data-testid="contractor-nav-tabs">
          {CONTRACTOR_TABS.map((tab) => {
            const isActive = tab.matchPaths.some((p) => pathname.startsWith(p));
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => navigate(tab.to)}
                className="border-0 appearance-none rounded-lg px-6 py-2 text-sm transition-all duration-150 cursor-pointer"
                style={{
                  backgroundColor: isActive ? 'var(--primary, #215042)' : 'transparent',
                  color: isActive ? 'white' : '#404040',
                  fontWeight: isActive ? 500 : 400,
                }}
                data-testid={`contractor-tab-${tab.to.split('/').pop()}`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right: User info + logout */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 border-0 appearance-none bg-transparent cursor-pointer"
              data-testid="contractor-user-menu"
            >
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm text-foreground leading-tight">{user?.name}</span>
                <span className="text-xs text-muted-foreground leading-tight">事業者</span>
              </div>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[200px]" align="end">
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => { logout(); navigate('/login'); }}
            >
              <LogOut className="mr-2 size-4" />
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Content */}
      <main className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
