import { Center, Stack, Text, Badge, Paper } from '@mantine/core';
import { IconTools } from '@tabler/icons-react';

interface StubPageProps {
  title: string;
}

export function StubPage({ title }: StubPageProps) {
  return (
    <Center h="calc(100vh - 120px)">
      <Paper p="xl" radius="md" withBorder>
        <Stack align="center" gap="md">
          <IconTools size={64} color="var(--mantine-color-gray-5)" />
          <Text size="xl" fw={600}>{title}</Text>
          <Badge color="blue" variant="light" size="lg">Coming Soon</Badge>
          <Text c="dimmed" size="sm">このページは開発中です</Text>
        </Stack>
      </Paper>
    </Center>
  );
}
