import { Text, Title } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconChevronDown, IconMap, IconBuilding, IconClipboardList, IconUsers, IconLogout, IconTree, IconListDetails } from '@tabler/icons-react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isDemoEnvironment, isAdminNavEnabled } from '../utils/environment';
import { DemoHeader } from '../features/admin-demo/DemoHeader';
import { useUIStore } from '../stores/uiStore';

const NAV_HEIGHT = 60;

interface NavItemProps {
  label: string;
  to: string;
  icon: React.ReactNode;
  matchPaths?: string[];
}

function NavItem({ label, to, icon, matchPaths }: NavItemProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isActive = matchPaths
    ? matchPaths.some((p) => pathname.startsWith(p))
    : pathname.startsWith(to);

  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="flex items-center gap-1.5 rounded-sm px-4 py-1.5 text-sm"
      style={{
        backgroundColor: isActive ? '#e7f5ff' : undefined,
        color: isActive ? '#1c7ed6' : undefined,
        fontWeight: isActive ? 600 : 400,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function RootLayout() {
  const { user, isAuthenticated, logout, hasRole, canAccessScope } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isDemoMode = isAdminNavEnabled() && isDemoEnvironment();
  const isUnifiedLayout = user?.role === 'user' || user?.role === 'admin';
  const demoSidebarOpen = useUIStore((s) => s.demoSidebarOpen);
  const toggleDemoSidebar = useUIStore((s) => s.toggleDemoSidebar);

  if (!isAuthenticated) {
    const next = pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    return <Navigate to={`/login${next}`} replace />;
  }

  const assetsActive = pathname.startsWith('/assets');

  return (
    <div className="flex h-screen flex-col">
      <header className="flex-none border-b" style={{ height: NAV_HEIGHT }}>
        {isDemoMode ? (
          isUnifiedLayout
            ? <DemoHeader />
            : <DemoHeader sidebarOpen={demoSidebarOpen} onToggleSidebar={toggleDemoSidebar} />
        ) : (
          <div className="flex h-full items-center justify-between px-4">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => navigate('/map')} className="flex items-center gap-1.5 cursor-pointer">
                <img src="/favicon.svg" alt="" width={36} height={36} />
                <Title order={4} className="hidden md:block">EventFlow</Title>
              </button>

              <div className="flex items-center gap-1 ml-4">
                {(canAccessScope('parks') || canAccessScope('park-trees')) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-sm px-4 py-1.5 text-sm cursor-pointer"
                        style={{
                          backgroundColor: assetsActive ? '#e7f5ff' : undefined,
                          color: assetsActive ? '#1c7ed6' : undefined,
                          fontWeight: assetsActive ? 600 : 400,
                        }}
                      >
                        <IconBuilding size={18} />
                        公園管理
                        <IconChevronDown size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[200px]">
                      {canAccessScope('parks') && (
                        <DropdownMenuItem onClick={() => navigate('/assets/parks')}>
                          <IconBuilding size={16} className="mr-2" />
                          公園管理
                        </DropdownMenuItem>
                      )}
                      {canAccessScope('park-trees') && (
                        <DropdownMenuItem onClick={() => navigate('/assets/park-trees')}>
                          <IconTree size={16} className="mr-2" />
                          樹木管理
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <NavItem label="地図" to="/map" icon={<IconMap size={18} />} />
                <NavItem label="資産台帳" to="/assets/parks" icon={<IconListDetails size={18} />} matchPaths={['/assets']} />
                <NavItem label="案件管理" to="/cases" icon={<IconClipboardList size={18} />} matchPaths={['/cases', '/inspections']} />

                {hasRole(['admin']) && (
                  <NavItem label="業者管理" to="/vendors" icon={<IconUsers size={18} />} />
                )}
              </div>
            </div>

            {/* Right: User */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-1.5 cursor-pointer">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                      {user?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div style={{ lineHeight: 1 }}>
                    <Text size="sm" fw={500} className="hidden sm:block">{user?.name}</Text>
                    <Badge
                      variant="secondary"
                      className={
                        user?.role === 'admin' ? 'bg-red-100 text-red-700' :
                        user?.role === 'park_manager' ? 'bg-green-100 text-green-700' :
                        user?.role === 'tree_manager' ? 'bg-teal-100 text-teal-700' :
                        'bg-blue-100 text-blue-700'
                      }
                    >
                      {user?.roleLabel}
                    </Badge>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px]" align="end">
                <DropdownMenuLabel>{user?.department}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => { logout(); navigate('/login'); }}
                >
                  <IconLogout size={16} className="mr-2" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden" style={{ height: `calc(100vh - ${NAV_HEIGHT}px)` }}>
        <Outlet />
      </main>
    </div>
  );
}
