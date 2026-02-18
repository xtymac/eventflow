import { useState, useMemo } from 'react';
import { Box, Text, Group, Stack } from '@/components/shims';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    <Box p="lg" style={{ height: '100%' }}>
      <div className="relative mb-6">
        <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search (ID, Name, 市区町村)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Text size="lg" fw={600} mb="sm">公園 List</Text>

      <ScrollArea style={{ height: 'calc(100vh - 240px)' }}>
        <Stack gap={0}>
          {parks.map((p) => (
            <Box
              key={p.id}
              py="md"
              px="lg"
              className="cursor-pointer rounded mb-1"
              onClick={() => navigate(`/assets/parks/${p.id}`)}
              style={{
                backgroundColor: '#f1f3f5',
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
