import { Center, Stack, Text, Paper } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { IconTools } from '@tabler/icons-react';

interface StubPageProps {
  title: string;
}

export function StubPage({ title }: StubPageProps) {
  return (
    <Center h="calc(100vh - 120px)">
      <Paper p="xl" withBorder>
        <Stack align="center" gap="md">
          <IconTools size={64} className="text-muted-foreground" />
          <Text size="xl" fw={600}>{title}</Text>
          <Badge variant="secondary">Coming Soon</Badge>
          <Text c="dimmed" size="sm">このページは開発中です</Text>
        </Stack>
      </Paper>
    </Center>
  );
}
