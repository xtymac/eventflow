import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, LogOut, Search } from 'lucide-react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppSidebar } from '../components/AppSidebar';

const HEADER_HEIGHT = 67;

export function RootLayout() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!isAuthenticated) {
    const next = pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    return <Navigate to={`/login${next}`} replace />;
  }

  return (
    <div className="flex h-screen">
      {/* Left: Sidebar */}
      <AppSidebar />

      {/* Right: Header + Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex shrink-0 items-center justify-between bg-white px-10"
          style={{ height: HEADER_HEIGHT, borderBottom: '1px solid var(--sidebar-sidebar-border, #E5E5E5)' }}
        >
          {/* Search bar */}
          <div
            className="max-w-[480px] w-full"
            style={{
              display: 'flex',
              minHeight: 36,
              padding: '4px 4px 4px 16px',
              marginLeft: 30,
              alignItems: 'center',
              gap: 8,
              borderRadius: 8,
              border: '1px solid #E5E5E5',
              background: '#FFF',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.00)',
            }}
          >
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="検索"
              className="h-auto min-h-0 flex-1 border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:border-0"
            />
            <Select defaultValue="all">
              <SelectTrigger className="h-7 w-auto shrink-0 border-0 shadow-none focus:ring-0 gap-1 text-sm text-muted-foreground">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User info */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" data-testid="user-avatar" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: 'none', border: 'none', padding: 0, marginRight: 30 }}>
                <div style={{ width: 40, height: 40, borderRadius: 9999, backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#0a0a0a', flexShrink: 0 }}>
                  {user?.name?.split(/\s+/).map(s => s[0]).join('').slice(0, 2) || 'U'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
                  <p style={{ fontSize: 14, lineHeight: '20px', color: '#0a0a0a', margin: 0 }}>{user?.name}</p>
                  <p style={{ fontSize: 12, lineHeight: '16px', color: '#737373', margin: 0 }}>{user?.roleLabel}</p>
                </div>
                <ChevronDown style={{ width: 20, height: 20, color: '#737373', flexShrink: 0 }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]" align="end">
              <DropdownMenuLabel>{user?.department}</DropdownMenuLabel>
              <DropdownMenuSeparator />
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
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
