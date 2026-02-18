import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  IconBuildingCommunity,
  IconToolsKitchen2,
  IconTree,
  IconTrees,
  IconPlant,
  IconSearch,
} from '@tabler/icons-react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { DEPT_SCOPES, scopeToDepartment, type Scope } from '../contexts/AuthContext';

const SIDEBAR_WIDTH = 200;

const SCOPE_META: Record<Scope, { label: string; icon: typeof IconBuildingCommunity }> = {
  parks: { label: '公園', icon: IconBuildingCommunity },
  facilities: { label: '施設', icon: IconToolsKitchen2 },
  'green-lands': { label: '緑地', icon: IconPlant },
  'park-trees': { label: '公園樹木', icon: IconTree },
  'street-trees': { label: '街路樹', icon: IconTrees },
};

export function AssetLayout() {
  const navigate = useNavigate();
  const { scope } = useParams<{ scope: string }>();
  const [search, setSearch] = useState('');

  const currentDept = scope ? scopeToDepartment(scope as Scope) : 'park';
  const deptScopes = DEPT_SCOPES[currentDept];

  return (
    <div className="flex h-full">
      {/* Left Sidebar */}
      <div
        className="flex flex-col shrink-0 border-r"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <div className="p-2">
          <div className="relative">
            <IconSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="検索..."
              className="pl-8 h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0 p-1.5">
            {deptScopes.map((s) => {
              const meta = SCOPE_META[s];
              const Icon = meta.icon;
              const isActive = scope === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => navigate(`/assets/${s}`)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm w-full text-left',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  <Icon size={18} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
