import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin,
  Table2,
  ChevronDown,
  ChevronRight,
  RefreshCcwDot,
  SquareUser,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const SIDEBAR_WIDTH = 240;

/* ── 1st-level menu item ── */
function SidebarGroup({
  label,
  icon: Icon,
  active,
  expandable,
  expanded,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border-0 bg-transparent px-3 py-1 text-sm text-sidebar-foreground',
        'h-8 cursor-pointer hover:bg-accent',
        active && !expandable && 'font-medium text-sidebar-accent-foreground',
      )}
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-left text-sm font-normal leading-5 tracking-normal" style={{ color: 'var(--sidebar-sidebar-foreground, #404040)' }}>{label}</span>
      {expandable && (
        expanded
          ? <ChevronDown className="size-4 text-muted-foreground" />
          : <ChevronRight className="size-4 text-muted-foreground" />
      )}
    </button>
  );
}

/* ── 2nd-level sub-item with tree connector ── */
function SidebarSubItem({
  label,
  active,
  badge,
  badgeVariant,
  onClick,
}: {
  label: string;
  active?: boolean;
  badge?: string | number;
  badgeVariant?: 'default' | 'destructive' | 'secondary';
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-full items-center border-0 bg-transparent py-1 cursor-pointer"
    >
      {/* Tree connector line */}
      <div className="relative flex size-5 shrink-0 items-center justify-center">
        <div className="absolute left-1/2 top-[-6px] h-8 w-px -translate-x-1/2" style={{ background: 'var(--sidebar-sidebar-border, #E5E5E5)' }} />
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex w-full items-center gap-2 text-sm',
          active ? 'rounded-[6px] shadow-md' : 'rounded-md hover:bg-accent/50',
        )}
        style={active ? { background: 'var(--general-primary, #215042)', padding: '4px', gap: '8px' } : { padding: '4px' }}
      >
        <span
          className={cn('overflow-hidden text-left text-sm font-normal leading-5 tracking-normal')}
          style={{
            color: active ? '#FAFAFA' : 'var(--sidebar-sidebar-foreground, #404040)',
            flex: '1 0 0',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 1,
            textOverflow: 'ellipsis',
          }}
        >{label}</span>
        {badge != null && (
          <Badge
            variant={badgeVariant ?? 'secondary'}
            className={cn(
              'justify-center text-xs font-semibold',
              badgeVariant === 'destructive'
                ? 'size-5 p-0 rounded-full bg-destructive text-white hover:bg-destructive'
                : 'h-5 min-w-[20px] px-1.5',
            )}
          >
            {badge}
          </Badge>
        )}
      </div>
    </button>
  );
}

export function AppSidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMap = pathname.startsWith('/map');
  const isAssets = pathname.startsWith('/assets');
  const isPark = pathname.startsWith('/assets/parks');
  const isFacility = pathname.startsWith('/assets/facilities');
  const isCases = pathname.startsWith('/cases') || pathname.startsWith('/inspections');
  const isVendors = pathname.startsWith('/vendors');

  return (
    <aside
      className="flex h-full shrink-0 flex-col items-start border-r border-sidebar-border bg-sidebar px-4 py-1"
      style={{ width: SIDEBAR_WIDTH, padding: '4px 16px' }}
    >
      {/* Logo + Navigation wrapper */}
      <div className="flex flex-col items-stretch gap-6 self-stretch">
        {/* Logo + Department dropdown */}
        <div className="flex h-[59px] min-h-[36px] items-center gap-3 self-stretch px-3 py-[7.5px]">
          <img
            src="/logo.svg"
            alt="logo"
            width={32}
            height={32}
            className="shrink-0 rounded-lg object-cover"
          />
          <span className="flex-1 text-sm text-foreground">公園管理</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>

        {/* Navigation */}
        <nav className="flex w-full flex-col gap-0">
        {/* 地図 */}
        <SidebarGroup
          label="地図"
          icon={MapPin}
          active={isMap}
          onClick={() => navigate('/map')}
        />

        {/* Divider */}
        <div className="flex flex-col items-start gap-2.5 self-stretch" style={{ padding: '10px 12px' }}>
          <div className="h-px w-full" style={{ background: 'var(--sidebar-sidebar-border, #E5E5E5)' }} />
        </div>

        {/* 資産台帳 */}
        <SidebarGroup
          label="資産台帳"
          icon={Table2}
          onClick={() => navigate('/assets/parks')}
        />
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

        {/* 案件管理 */}
        <SidebarGroup
          label="案件管理"
          icon={RefreshCcwDot}
          onClick={() => navigate('/cases')}
        />
        <SidebarSubItem
          label="未確認"
          badge={12}
          onClick={() => navigate('/cases')}
          active={pathname === '/cases'}
        />
        <SidebarSubItem
          label="差戻"
          badge={3}
          badgeVariant="destructive"
          onClick={() => navigate('/cases')}
        />
        <SidebarSubItem
          label="確認済"
          onClick={() => navigate('/cases')}
        />

        {/* 業者管理 */}
        <SidebarGroup
          label="業者管理"
          icon={SquareUser}
          active={isVendors}
          onClick={() => navigate('/vendors')}
        />
      </nav>
      </div>
    </aside>
  );
}
