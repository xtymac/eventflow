import { Text } from '@/components/shims';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconChevronDown, IconLogout } from '@tabler/icons-react';
import { Menu as MenuIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { DEPARTMENTS, detectDepartment } from '@/lib/departments';

interface DemoHeaderProps {
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function DemoHeader({ sidebarOpen, onToggleSidebar }: DemoHeaderProps) {
  const { user, logout, hasRole, canAccessSection } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isAdmin = user?.role === 'admin';
  const isUser = user?.role === 'user';

  const currentDept = detectDepartment(pathname);

  // ── Unified layout for admin + user ─────────────────────────────
  if (isAdmin || isUser) {
    const tabs: { label: string; to?: string; matchPaths: string[] }[] = [
      { label: '地図', to: '/map', matchPaths: ['/map'] },
      { label: '資産台帳', to: currentDept === 'tree' ? '/assets/park-trees' : '/assets/parks', matchPaths: ['/assets'] },
      { label: '案件管理', to: '/cases', matchPaths: ['/cases', '/inspections'] },
      isAdmin
        ? { label: '業者管理', to: '/vendors', matchPaths: ['/vendors'] }
        : { label: '業者管理', matchPaths: ['/vendors'] },
    ];

    return (
      <div className="flex h-full items-center justify-between border-b border-gray-200 bg-white px-4">
        {/* Left: Logo + Department dropdown */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/map')} className="border-0 appearance-none bg-transparent cursor-pointer">
            <img src="/favicon.svg" alt="EventFlow" width={32} height={32} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 cursor-pointer"
              >
                {currentDept === 'tree' ? '樹木管理' : '公園管理'}
                <IconChevronDown size={14} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[180px]">
              {DEPARTMENTS.map((dept) => {
                const isActive = currentDept === dept.value;
                return (
                  <DropdownMenuItem
                    key={dept.value}
                    onClick={() => navigate(dept.route)}
                    className={isActive ? 'font-semibold bg-blue-50' : ''}
                  >
                    {dept.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center: segmented tab bar */}
        <nav
          className="inline-flex items-center gap-0.5 rounded-lg p-1"
          style={{ backgroundColor: '#e9ecef', border: '1px solid #dee2e6' }}
        >
          {tabs.map((tab) => {
            const isActive = tab.matchPaths.some((p) => pathname.startsWith(p));
            const isDisabled = !tab.to;

            return (
              <button
                key={tab.label}
                type="button"
                disabled={isDisabled}
                onClick={isDisabled ? undefined : () => navigate(tab.to!)}
                className="border-0 appearance-none rounded-md px-5 py-1.5 text-sm transition-all duration-150"
                style={{
                  backgroundColor: isActive ? '#fff' : 'transparent',
                  color: isDisabled ? '#adb5bd' : isActive ? '#1a1a1a' : '#495057',
                  fontWeight: isActive ? 600 : 500,
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.5 : 1,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Avatar + logout */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="border-0 appearance-none bg-transparent cursor-pointer">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[200px]" align="end">
            <DropdownMenuLabel>{user?.department}</DropdownMenuLabel>
            <DropdownMenuLabel>{user?.roleLabel}</DropdownMenuLabel>
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
    );
  }

  // ── Legacy layout for park_manager / tree_manager ───────────────
  const canPark = canAccessSection('park-mgmt');
  const canTree = canAccessSection('tree-mgmt');
  const canAssets = canPark || canTree;
  const canSwitchDept = canPark && canTree;

  const department = currentDept === 'tree' ? 'tree'
    : canTree && !canPark ? 'tree' : 'park';
  const currentDeptObj = DEPARTMENTS.find((d) => d.value === department)!;

  const demoTabs: { label: string; to: string; matchPaths: string[] }[] = [
    { label: '地図', to: '/map', matchPaths: ['/map'] },
  ];
  if (canAssets) {
    demoTabs.push({ label: '資産台帳', to: currentDeptObj.route, matchPaths: ['/assets'] });
  }
  demoTabs.push({ label: '案件管理', to: '/cases', matchPaths: ['/cases', '/inspections'] });
  if (hasRole(['admin'])) {
    demoTabs.push({ label: '業者管理', to: '/vendors', matchPaths: ['/vendors'] });
  }

  return (
    <div className="flex h-full items-center justify-between border-b border-gray-200 bg-white px-4">
      {/* Left: Hamburger + Department selector */}
      <div className="flex items-center gap-4">
        {sidebarOpen !== undefined && onToggleSidebar && (
          <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
            <MenuIcon className="h-5 w-5" />
          </Button>
        )}
        <button type="button" onClick={() => navigate('/map')} className="border-0 appearance-none bg-transparent cursor-pointer">
          <img src="/favicon.svg" alt="EventFlow" width={32} height={32} />
        </button>

        {canAssets && (
          canSwitchDept ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 cursor-pointer"
                >
                  {currentDeptObj.label}
                  <IconChevronDown size={14} className="text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[180px]">
                {DEPARTMENTS.map((dept) => (
                  <DropdownMenuItem
                    key={dept.value}
                    onClick={() => navigate(dept.route)}
                    className={department === dept.value ? 'font-semibold bg-blue-50' : ''}
                  >
                    {dept.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Text size="sm" fw={500} px="sm">{currentDeptObj.label}</Text>
          )
        )}
      </div>

      {/* Center: segmented tab bar */}
      <nav
        className="inline-flex items-center gap-0.5 rounded-lg p-1"
        style={{ backgroundColor: '#e9ecef', border: '1px solid #dee2e6' }}
      >
        {demoTabs.map((tab) => {
          const isActive = tab.matchPaths.some((p) => pathname.startsWith(p));
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => navigate(tab.to)}
              className="border-0 appearance-none rounded-md px-5 py-1.5 text-sm transition-all duration-150 cursor-pointer"
              style={{
                backgroundColor: isActive ? '#fff' : 'transparent',
                color: isActive ? '#1a1a1a' : '#495057',
                fontWeight: isActive ? 600 : 500,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Right: Avatar + logout */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="border-0 appearance-none bg-transparent cursor-pointer">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{user?.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]" align="end">
          <DropdownMenuLabel>{user?.department}</DropdownMenuLabel>
          <DropdownMenuLabel>{user?.roleLabel}</DropdownMenuLabel>
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
  );
}
