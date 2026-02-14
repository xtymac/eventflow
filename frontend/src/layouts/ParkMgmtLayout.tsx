import { Box, NavLink as MantineNavLink, ScrollArea, Stack, TextInput } from '@mantine/core';
import { IconBuildingCommunity, IconToolsKitchen2, IconSearch } from '@tabler/icons-react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';

const SIDEBAR_WIDTH = 200;

export function ParkMgmtLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [search, setSearch] = useState('');

  const isParksActive = pathname.includes('/park-mgmt/parks');
  const isFacilitiesActive = pathname.includes('/park-mgmt/facilities');

  return (
    <Box style={{ display: 'flex', height: '100%' }}>
      {/* Left Sidebar */}
      <Box
        w={SIDEBAR_WIDTH}
        style={{
          borderRight: '1px solid var(--mantine-color-gray-3)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box p="sm">
          <TextInput
            placeholder="検索..."
            leftSection={<IconSearch size={16} />}
            size="sm"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
        </Box>
        <ScrollArea style={{ flex: 1 }}>
          <Stack gap={0} p="xs">
            <MantineNavLink
              label="公園"
              leftSection={<IconBuildingCommunity size={18} />}
              active={isParksActive}
              onClick={() => navigate('/park-mgmt/parks')}
              variant="filled"
            />
            <MantineNavLink
              label="施設"
              leftSection={<IconToolsKitchen2 size={18} />}
              active={isFacilitiesActive}
              onClick={() => navigate('/park-mgmt/facilities')}
              variant="filled"
            />
          </Stack>
        </ScrollArea>
      </Box>

      {/* Main Content */}
      <Box style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
