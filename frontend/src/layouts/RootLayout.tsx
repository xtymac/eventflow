import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MantineProvider } from '@mantine/core';
import { ChevronDown, LogOut } from 'lucide-react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppSidebar } from '../components/AppSidebar';

const HEADER_HEIGHT = 52;

export function RootLayout() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!isAuthenticated) {
    const next = pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    return <Navigate to={`/login${next}`} replace />;
  }

  // Contractors get their own layout — redirect them away from staff routes
  if (user?.role === 'contractor') {
    return <Navigate to="/contractor/map" replace />;
  }

  return (
    <MantineProvider
      defaultColorScheme="light"
      theme={{
        primaryColor: 'blue',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div className="flex h-screen">
        {/* Left: Sidebar */}
        <AppSidebar />

        {/* Right: Header + Content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header
            className="flex flex-none items-center justify-end bg-white px-4 md:px-10 py-0"
            style={{ height: HEADER_HEIGHT, maxHeight: HEADER_HEIGHT, borderBottom: '1px solid var(--sidebar-sidebar-border, #E5E5E5)', boxSizing: 'border-box' }}
          >
            {/* User info */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" data-testid="user-avatar" style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9999, backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#0a0a0a', flexShrink: 0 }}>
                    {user?.name?.split(/\s+/).map(s => s[0]).join('').slice(0, 2) || 'U'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}>
                    <p style={{ fontSize: 13, lineHeight: '18px', color: '#0a0a0a', margin: 0 }}>{user?.name}</p>
                    <p style={{ fontSize: 11, lineHeight: '14px', color: '#737373', margin: 0 }}>{user?.roleLabel}</p>
                  </div>
                  <ChevronDown style={{ width: 16, height: 16, color: '#737373', flexShrink: 0 }} />
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
          <main className="min-w-0 flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </MantineProvider>
  );
}
