import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  MapPin,
  Table2,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  PanelRight,
  RefreshCcwDot,
  SquareUser,
  Ratio,
  SquareKanban,
  Clock3,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { useRecentVisits } from '@/hooks/useRecentVisits';
import { DEPARTMENTS, detectDepartment } from '@/lib/departments';

/* ── Constants ── */
export const SIDEBAR_WIDTH_EXPANDED = 240;
export const SIDEBAR_WIDTH_COLLAPSED = 72;
const LS_KEY = 'sidebar-collapsed';

/* ── Context for sharing collapsed state ── */
const SidebarCtx = createContext<{ collapsed: boolean; toggle: () => void }>({
  collapsed: false,
  toggle: () => { },
});
export function useSidebarCollapsed() {
  return useContext(SidebarCtx);
}

/* ── Divider ── */
function SidebarDivider() {
  return (
    <div className="flex flex-col items-start gap-2.5 self-stretch" style={{ padding: '10px 12px' }}>
      <div className="h-px w-full" style={{ background: 'var(--sidebar-sidebar-border, #E5E5E5)' }} />
    </div>
  );
}

/* ── 1st-level nav item (expanded view) ── */
function SidebarItem({
  icon: Icon,
  label,
  active,
  badge: badgeValue,
  expandable,
  expanded,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  active?: boolean;
  badge?: string | number;
  expandable?: boolean;
  expanded?: boolean;
  onClick?: () => void;
}) {
  const isActive = active && !expandable;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border-0 px-3 py-1 text-sm',
        'h-8 cursor-pointer bg-transparent hover:bg-accent',
        isActive && 'font-medium',
      )}
      style={isActive ? { backgroundColor: 'var(--sidebar-accent, #215042)' } : undefined}
    >
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        <Icon
          className="size-6 shrink-0"
          style={{ color: isActive ? 'var(--sidebar-accent-foreground, #fafafa)' : 'var(--muted-foreground)' }}
        />
        <span
          className="flex-1 truncate text-left text-sm font-normal leading-5 tracking-normal"
          style={{ color: isActive ? 'var(--sidebar-accent-foreground, #fafafa)' : 'var(--sidebar-sidebar-foreground, #404040)' }}
        >
          {label}
        </span>
      </div>
      {badgeValue != null && (
        <span
          className="flex shrink-0 items-center justify-center rounded-full text-center text-xs font-semibold leading-4"
          style={{
            minHeight: 24,
            padding: '3px 8px',
            gap: 6,
            background: 'var(--general-secondary, #F5F5F5)',
            color: 'var(--sidebar-sidebar-foreground, #404040)',
          }}
        >
          {badgeValue}
        </span>
      )}
      {expandable && (
        expanded
          ? <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
          : <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

/* ── Collapsed icon button with tooltip ── */
function SidebarIconButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="flex size-10 items-center justify-center rounded-md border-0 bg-transparent cursor-pointer hover:bg-accent"
          style={active ? { backgroundColor: 'var(--sidebar-accent, #215042)' } : undefined}
        >
          <Icon
            className="size-6"
            style={{ color: active ? 'var(--sidebar-accent-foreground, #fafafa)' : 'var(--muted-foreground)' }}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/* ── 2nd-level sub-item with tree connector ── */
function SidebarSubItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-full items-center border-0 bg-transparent py-1 cursor-pointer"
    >
      {/* Tree connector line */}
      <div className="relative flex size-5 shrink-0 items-center justify-center px-2">
        <div
          className="absolute left-1/2 top-[-6px] h-8 w-px -translate-x-1/2"
          style={{ background: 'var(--sidebar-sidebar-border, #E5E5E5)' }}
        />
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex w-full items-center gap-2 text-sm',
          active ? 'rounded-[6px] shadow-md' : 'rounded-md hover:bg-accent/50',
        )}
        style={
          active
            ? { background: 'var(--general-primary, #215042)', padding: '4px', gap: '8px' }
            : { padding: '4px' }
        }
      >
        <span
          className="flex-1 truncate text-left text-sm font-normal leading-5 tracking-normal"
          style={{ color: active ? '#FAFAFA' : 'var(--sidebar-sidebar-foreground, #404040)' }}
        >
          {label}
        </span>
      </div>
    </button>
  );
}

/* ── Section label ── */
function SidebarGroupLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center self-stretch px-3 py-2">
      <span
        className="text-xs font-semibold"
        style={{ color: 'var(--sidebar-unofficial-sidebar-muted, #737373)' }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Recent visits section ── */
function RecentVisitsSection({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const recentVisits = useRecentVisits();

  if (recentVisits.length === 0) return null;

  if (collapsed) {
    return (
      <>
        <SidebarDivider />
        <SidebarIconButton
          icon={Clock3}
          label="最近"
          onClick={() => {
            if (recentVisits[0]) navigate(recentVisits[0].path);
          }}
        />
      </>
    );
  }

  return (
    <div className="flex w-full flex-col">
      <SidebarDivider />
      <SidebarGroupLabel label="最近" />
      {recentVisits.map((visit) => (
        <button
          key={visit.path}
          type="button"
          onClick={() => navigate(visit.path)}
          className="flex h-8 w-full items-center gap-2 border-0 bg-transparent px-3 py-1 text-sm cursor-pointer rounded-md hover:bg-accent"
        >
          <span
            className="flex-1 truncate text-left text-sm font-normal leading-5 tracking-normal"
            style={{ color: 'var(--sidebar-sidebar-foreground, #404040)' }}
          >
            {visit.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── Media query hook ── */
const MD_BREAKPOINT = 768;

function useIsSmallScreen() {
  const [isSmall, setIsSmall] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MD_BREAKPOINT : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MD_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsSmall(e.matches);
    mql.addEventListener('change', handler);
    setIsSmall(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isSmall;
}

/* ── Main sidebar component ── */
export function AppSidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentDeptValue = detectDepartment(pathname);
  const currentDept = DEPARTMENTS.find((d) => d.value === currentDeptValue)!;
  const isSmallScreen = useIsSmallScreen();

  /* Collapse state (persisted — user preference for desktop) */
  const [userCollapsed, setUserCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === '1';
    } catch {
      return false;
    }
  });

  /* On small screens, always collapsed. On large screens, respect user pref. */
  const collapsed = isSmallScreen || userCollapsed;

  const toggle = useCallback(() => {
    setUserCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  /* Expandable sections */
  const [assetsOpen, setAssetsOpen] = useState(true);
  const [casesOpen, setCasesOpen] = useState(true);

  /* Active routes */
  const isMap = pathname.startsWith('/map');
  const isPark = pathname.startsWith('/assets/parks');
  const isFacility = pathname.startsWith('/assets/facilities');
  const isCases = pathname.startsWith('/cases');
  const isInspections = pathname === '/cases/inspections';
  const isRepairs = pathname === '/cases/repairs';
  const isVendors = pathname.startsWith('/vendors');

  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <SidebarCtx.Provider value={{ collapsed, toggle }}>
      <TooltipProvider>
        <aside
          className="flex h-full shrink-0 flex-col items-start border-r bg-sidebar overflow-hidden"
          style={{
            width: sidebarWidth,
            borderColor: 'var(--sidebar-sidebar-border, #E5E5E5)',
            padding: '4px 16px',
            transition: 'width 200ms ease',
          }}
        >
          <div className="flex w-full flex-col items-stretch gap-6">
            {/* ── Header: Logo + Department + Toggle ── */}
            {collapsed ? (
              /* Collapsed header */
              <div className="flex w-full flex-col items-start">
                {/* Department label */}
                <div className="flex min-h-[36px] w-full flex-col items-center gap-0.5 justify-center rounded-md p-1">
                  <div className="flex w-full flex-col items-center justify-center">
                    <span
                      className="text-sm font-normal leading-5 text-center whitespace-pre-wrap"
                      style={{ color: 'var(--general-foreground, #0a0a0a)' }}
                    >
                      {currentDept.label.slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex w-5 items-center justify-center p-0.5">
                    <ChevronDown className="size-6 text-muted-foreground" />
                  </div>
                </div>
                {/* Divider */}
                <SidebarDivider />
                {/* Toggle button (hidden on small screens where collapse is automatic) */}
                {!isSmallScreen && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={toggle}
                        className="flex size-10 w-full items-center justify-center rounded-md border-0 bg-transparent cursor-pointer hover:bg-accent"
                      >
                        <PanelRight className="size-6 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">サイドバーを展開</TooltipContent>
                  </Tooltip>
                )}
              </div>
            ) : (
              /* Expanded header */
              <div className="flex w-full items-center justify-between">
                <div className="flex min-h-[36px] items-center gap-3 px-3 py-2">
                  <Link to="/map" className="flex shrink-0 items-center">
                    <img
                      src="/logo.svg"
                      alt="地図に戻る"
                      width={28}
                      height={29}
                      className="shrink-0 rounded-lg object-cover"
                    />
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-md border-0 bg-transparent px-0 py-1 cursor-pointer text-sm text-foreground hover:bg-accent"
                      >
                        <span className="text-sm font-normal leading-5" style={{ color: 'var(--general-foreground, #0a0a0a)' }}>
                          {currentDept.label}
                        </span>
                        <span className="flex items-center justify-center p-0.5">
                          <ChevronsUpDown className="size-5 text-muted-foreground" />
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {DEPARTMENTS.map((dept) => (
                        <DropdownMenuItem
                          key={dept.value}
                          onClick={() => dept.route !== pathname && navigate(dept.route)}
                        >
                          <Check
                            className={cn(
                              'size-4',
                              currentDeptValue === dept.value ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          {dept.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggle}
                      className="flex size-6 items-center justify-center rounded-md border-0 bg-transparent cursor-pointer hover:bg-accent"
                    >
                      <PanelRight className="size-6 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">サイドバーを折りたたむ</TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* ── Navigation ── */}
            {collapsed ? (
              /* Collapsed navigation: icon-only */
              <nav className="flex w-full flex-col items-center gap-0">
                <SidebarIconButton icon={MapPin} label="地図" active={isMap} onClick={() => navigate('/map')} />
                <SidebarDivider />
                <SidebarIconButton icon={Table2} label="資産台帳" active={isPark || isFacility} onClick={() => navigate('/assets/parks')} />
                <SidebarIconButton icon={RefreshCcwDot} label="案件管理" active={isCases} onClick={() => navigate('/cases/inspections')} />
                <SidebarIconButton icon={SquareUser} label="業者管理" active={isVendors} onClick={() => navigate('/vendors')} />
                <SidebarIconButton icon={Ratio} label="公園内建ぺい率一覧" onClick={() => navigate('/coverage')} />
                <SidebarIconButton icon={SquareKanban} label="公園施設長寿命化計画" onClick={() => navigate('/longevity')} />
              </nav>
            ) : (
              /* Expanded navigation */
              <nav className="flex w-full flex-col gap-0">
                {/* 地図 */}
                <SidebarItem
                  icon={MapPin}
                  label="地図"
                  active={isMap}
                  onClick={() => navigate('/map')}
                />

                <SidebarDivider />

                {/* 資産台帳 (collapsible) */}
                <Collapsible open={assetsOpen} onOpenChange={setAssetsOpen}>
                  <CollapsibleTrigger asChild>
                    <div>
                      <SidebarItem
                        icon={Table2}
                        label="資産台帳"
                        expandable
                        expanded={assetsOpen}
                        active={isPark || isFacility}
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarSubItem
                      label="公園"
                      active={isPark}
                      onClick={() => navigate('/assets/parks')}
                    />
                    <SidebarSubItem
                      label="施設"
                      active={isFacility}
                      onClick={() => navigate('/assets/facilities')}
                    />
                  </CollapsibleContent>
                </Collapsible>

                {/* 案件管理 (collapsible) */}
                <Collapsible open={casesOpen} onOpenChange={setCasesOpen}>
                  <CollapsibleTrigger asChild>
                    <div>
                      <SidebarItem
                        icon={RefreshCcwDot}
                        label="案件管理"
                        expandable
                        expanded={casesOpen}
                        active={isCases}
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarSubItem
                      label="点検"
                      active={isInspections}
                      onClick={() => navigate('/cases/inspections')}
                    />
                    <SidebarSubItem
                      label="補修"
                      active={isRepairs}
                      onClick={() => navigate('/cases/repairs')}
                    />
                  </CollapsibleContent>
                </Collapsible>

                {/* 業者管理 */}
                <SidebarItem
                  icon={SquareUser}
                  label="業者管理"
                  active={isVendors}
                  onClick={() => navigate('/vendors')}
                />

                {/* 公園内建ぺい率一覧 */}
                <SidebarItem
                  icon={Ratio}
                  label="公園内建ぺい率一覧"
                  onClick={() => navigate('/coverage')}
                />

                {/* 公園施設長寿命化計画 */}
                <SidebarItem
                  icon={SquareKanban}
                  label="公園施設長寿命化計画"
                  onClick={() => navigate('/longevity')}
                />
              </nav>
            )}

            {/* ── Recent Visits ── */}
            <RecentVisitsSection collapsed={collapsed} />
          </div>
        </aside>
      </TooltipProvider>
    </SidebarCtx.Provider>
  );
}
