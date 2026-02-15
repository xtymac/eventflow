import { Group, UnstyledButton, Text, Menu, Avatar, Burger } from '@mantine/core';
import { IconChevronDown, IconLogout } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface DemoHeaderProps {
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

const DEPARTMENTS = [
  { label: '公園管理', value: 'park', route: '/park-mgmt' },
  { label: '樹木管理', value: 'tree', route: '/tree-mgmt' },
];

/**
 * Demo-specific header for all demo users.
 *
 * Unified layout (admin + user):
 *   [公園管理 ▽ / static]  ──  [地図] [資産台帳] [案件管理] [業者管理]  ──  [○]
 *   - admin: 公園管理 static, 資産台帳/案件管理/業者管理 disabled (placeholder)
 *   - user:  公園管理 static, 資産台帳/業者管理 disabled (RBAC)
 *
 * Legacy layout (park_manager, tree_manager):
 *   [☰] [dept label]  ──  [tabs]  ──  [avatar]
 */
export function DemoHeader({ sidebarOpen, onToggleSidebar }: DemoHeaderProps) {
  const { user, logout, hasRole, canAccessSection } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isAdmin = user?.role === 'admin';
  const isUser = user?.role === 'user';

  // ── Unified layout for admin + user ─────────────────────────────
  if (isAdmin || isUser) {
    // Build tabs — admin: only 地図 clickable; user: 資産台帳/業者管理 disabled
    const tabs: { label: string; to?: string; matchPaths: string[] }[] = [
      { label: '地図', to: '/map', matchPaths: ['/map'] },
      { label: '資産台帳', matchPaths: [] },
      isAdmin
        ? { label: '案件管理', matchPaths: [] }
        : { label: '案件管理', to: '/cases', matchPaths: ['/cases'] },
      isAdmin
        ? { label: '業者管理', matchPaths: [] }
        : { label: '業者管理', matchPaths: ['/vendors'] },
    ];

    return (
      <Group h="100%" px="md" justify="space-between" style={{ borderBottom: '1px solid #dee2e6' }}>
        {/* Left: 公園管理 static label (both admin and user) */}
        <Text size="sm" fw={500} px="sm" c="#333">公園管理</Text>

        {/* Center: 4 tabs */}
        <Group gap={0}>
          {tabs.map((tab) => {
            const isActive = tab.matchPaths.some((p) => pathname.startsWith(p));
            const isDisabled = !tab.to;

            return (
              <UnstyledButton
                key={tab.label}
                onClick={isDisabled ? undefined : () => navigate(tab.to!)}
                px="lg"
                py="xs"
                style={{
                  border: '1px solid #dee2e6',
                  backgroundColor: isActive ? 'var(--mantine-color-blue-6)' : 'white',
                  color: isDisabled ? '#adb5bd' : isActive ? 'white' : '#333',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 14,
                  marginLeft: -1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.7 : 1,
                }}
              >
                {tab.label}
              </UnstyledButton>
            );
          })}
        </Group>

        {/* Right: Avatar + logout */}
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <UnstyledButton>
              <Avatar size="md" radius="xl" color="gray" />
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{user?.department}</Menu.Label>
            <Menu.Label>{user?.roleLabel}</Menu.Label>
            <Menu.Divider />
            <Menu.Item
              color="red"
              leftSection={<IconLogout size={16} />}
              onClick={() => { logout(); navigate('/login'); }}
            >
              ログアウト
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    );
  }

  // ── Legacy layout for park_manager / tree_manager ───────────────
  const canPark = canAccessSection('park-mgmt');
  const canTree = canAccessSection('tree-mgmt');
  const canAssets = canPark || canTree;
  const canSwitchDept = canPark && canTree;

  const department = pathname.startsWith('/tree-mgmt') ? 'tree'
    : pathname.startsWith('/park-mgmt') ? 'park'
    : canTree && !canPark ? 'tree' : 'park';
  const currentDept = DEPARTMENTS.find((d) => d.value === department)!;

  const demoTabs: { label: string; to: string; matchPaths: string[] }[] = [
    { label: '地図', to: '/map', matchPaths: ['/map'] },
  ];
  if (canAssets) {
    demoTabs.push({ label: '資産台帳', to: currentDept.route, matchPaths: ['/park-mgmt', '/tree-mgmt'] });
  }
  demoTabs.push({ label: '案件管理', to: '/cases', matchPaths: ['/cases'] });
  if (hasRole(['admin'])) {
    demoTabs.push({ label: '業者管理', to: '/vendors', matchPaths: ['/vendors'] });
  }

  return (
    <Group h="100%" px="md" justify="space-between" style={{ borderBottom: '1px solid #dee2e6' }}>
      {/* Left: Hamburger + Department selector */}
      <Group gap="md">
        {sidebarOpen !== undefined && onToggleSidebar && (
          <Burger opened={sidebarOpen} onClick={onToggleSidebar} size="sm" />
        )}

        {canAssets && (
          canSwitchDept ? (
            <Menu shadow="md" width={180}>
              <Menu.Target>
                <UnstyledButton
                  px="sm"
                  py={6}
                  style={{ border: '1px solid #dee2e6', borderRadius: 4 }}
                >
                  <Group gap={6}>
                    <Text size="sm" fw={500}>{currentDept.label}</Text>
                    <IconChevronDown size={14} color="#868e96" />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                {DEPARTMENTS.map((dept) => (
                  <Menu.Item
                    key={dept.value}
                    onClick={() => navigate(dept.route)}
                    fw={department === dept.value ? 600 : 400}
                    bg={department === dept.value ? 'var(--mantine-color-blue-0)' : undefined}
                  >
                    {dept.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Text size="sm" fw={500} px="sm">{currentDept.label}</Text>
          )
        )}
      </Group>

      {/* Center: Tab bar */}
      <Group gap={0}>
        {demoTabs.map((tab) => {
          const isActive = tab.matchPaths.some((p) => pathname.startsWith(p));
          return (
            <UnstyledButton
              key={tab.label}
              onClick={() => navigate(tab.to)}
              px="lg"
              py="xs"
              style={{
                border: '1px solid #dee2e6',
                backgroundColor: isActive ? 'var(--mantine-color-blue-6)' : 'white',
                color: isActive ? 'white' : '#333',
                fontWeight: isActive ? 600 : 400,
                fontSize: 14,
                marginLeft: -1,
              }}
            >
              {tab.label}
            </UnstyledButton>
          );
        })}
      </Group>

      {/* Right: Avatar + logout */}
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <UnstyledButton>
            <Avatar size="sm" radius="xl" color="gray">
              {user?.name?.charAt(0) || 'U'}
            </Avatar>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{user?.department}</Menu.Label>
          <Menu.Label>{user?.roleLabel}</Menu.Label>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<IconLogout size={16} />}
            onClick={() => { logout(); navigate('/login'); }}
          >
            ログアウト
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
