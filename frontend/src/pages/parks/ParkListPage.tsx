import { useState, useMemo } from 'react';
import { Box, TextInput, Text, Group, Stack, ScrollArea } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { CURATED_PARKS } from '../../data/curatedParks';

export function ParkListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const parks = useMemo(() => {
    const filtered = CURATED_PARKS.filter((p) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        p.displayName.toLowerCase().includes(s) ||
        p.id.toLowerCase().includes(s) ||
        p.ward.toLowerCase().includes(s)
      );
    });
    return filtered.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));
  }, [search]);

  return (
    <Box p="lg" h="100%">
      <TextInput
        placeholder="Search (ID, Name, 市区町村)"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="lg"
      />

      <Text size="lg" fw={600} mb="sm">公園 List</Text>

      <ScrollArea h="calc(100vh - 240px)">
        <Stack gap={0}>
          {parks.map((p) => (
            <Box
              key={p.id}
              py="md"
              px="lg"
              onClick={() => navigate(`/park-mgmt/parks/${p.id}`)}
              style={{
                backgroundColor: '#f1f3f5',
                marginBottom: 4,
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              <Group justify="space-between">
                <Text fw={500} size="sm">{p.displayName}</Text>
                <Text size="xs" c="dimmed">{p.ward}</Text>
              </Group>
            </Box>
          ))}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
