import { AppShell, Group, Title, UnstyledButton, Menu, Avatar, Text, Badge } from '@mantine/core';
import { IconChevronDown, IconMap, IconBuilding, IconClipboardList, IconUsers, IconLogout, IconTree } from '@tabler/icons-react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
    <UnstyledButton
      onClick={() => navigate(to)}
      px="md"
      py="xs"
      style={{
        borderRadius: 'var(--mantine-radius-sm)',
        backgroundColor: isActive ? 'var(--mantine-color-blue-0)' : undefined,
        color: isActive ? 'var(--mantine-color-blue-7)' : undefined,
        fontWeight: isActive ? 600 : 400,
      }}
    >
      <Group gap="xs">
        {icon}
        <Text size="sm">{label}</Text>
      </Group>
    </UnstyledButton>
  );
}

export function RootLayout() {
  const { user, isAuthenticated, logout, hasRole, canAccessSection } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const parkMgmtActive = pathname.startsWith('/park-mgmt') || pathname.startsWith('/tree-mgmt');

  return (
    <AppShell header={{ height: NAV_HEIGHT }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          {/* Left: Logo + Nav */}
          <Group gap="sm">
            <UnstyledButton onClick={() => navigate('/map')}>
              <Group gap="xs">
                <img src="/favicon.svg" alt="" width={36} height={36} />
                <Title order={4} visibleFrom="md">EventFlow</Title>
              </Group>
            </UnstyledButton>

            <Group gap={4} ml="md">
              {/* 公園管理 dropdown - show if user can access either park-mgmt or tree-mgmt */}
              {(canAccessSection('park-mgmt') || canAccessSection('tree-mgmt')) && (
                <Menu shadow="md" width={200} trigger="hover" openDelay={100} closeDelay={200}>
                  <Menu.Target>
                    <UnstyledButton
                      px="md"
                      py="xs"
                      style={{
                        borderRadius: 'var(--mantine-radius-sm)',
                        backgroundColor: parkMgmtActive ? 'var(--mantine-color-blue-0)' : undefined,
                        color: parkMgmtActive ? 'var(--mantine-color-blue-7)' : undefined,
                        fontWeight: parkMgmtActive ? 600 : 400,
                      }}
                    >
                      <Group gap="xs">
                        <IconBuilding size={18} />
                        <Text size="sm">公園管理</Text>
                        <IconChevronDown size={14} />
                      </Group>
                    </UnstyledButton>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {canAccessSection('park-mgmt') && (
                      <Menu.Item
                        leftSection={<IconBuilding size={16} />}
                        onClick={() => navigate('/park-mgmt/parks')}
                      >
                        公園管理
                      </Menu.Item>
                    )}
                    {canAccessSection('tree-mgmt') && (
                      <Menu.Item
                        leftSection={<IconTree size={16} />}
                        onClick={() => navigate('/tree-mgmt/park-trees')}
                      >
                        樹木管理
                      </Menu.Item>
                    )}
                  </Menu.Dropdown>
                </Menu>
              )}

              <NavItem label="地図" to="/map" icon={<IconMap size={18} />} />
              <NavItem label="案件管理" to="/cases" icon={<IconClipboardList size={18} />} />

              {hasRole(['admin']) && (
                <NavItem label="業者管理" to="/vendors" icon={<IconUsers size={18} />} />
              )}
            </Group>
          </Group>

          {/* Right: User */}
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <UnstyledButton>
                <Group gap="xs">
                  <Avatar size="sm" radius="xl" color="blue">
                    {user?.name?.charAt(0) || 'U'}
                  </Avatar>
                  <div style={{ lineHeight: 1 }}>
                    <Text size="sm" fw={500} visibleFrom="sm">{user?.name}</Text>
                    <Badge
                      size="xs"
                      variant="light"
                      color={
                        user?.role === 'admin' ? 'red' :
                        user?.role === 'park_manager' ? 'green' :
                        user?.role === 'tree_manager' ? 'teal' :
                        'blue'
                      }
                    >
                      {user?.roleLabel}
                    </Badge>
                  </div>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{user?.department}</Menu.Label>
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
      </AppShell.Header>

      <AppShell.Main style={{ height: `calc(100vh - ${NAV_HEIGHT}px)` }}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
