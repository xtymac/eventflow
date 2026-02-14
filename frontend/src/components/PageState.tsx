import { Center, Loader, Text, Alert, Stack } from '@mantine/core';
import { IconAlertCircle, IconDatabaseOff } from '@tabler/icons-react';
import type { ReactNode } from 'react';

interface PageStateProps {
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}

export function PageState({ loading, error, empty, emptyMessage, children }: PageStateProps) {
  if (loading) {
    return (
      <Center h={300}>
        <Stack align="center" gap="sm">
          <Loader size="lg" />
          <Text c="dimmed" size="sm">読み込み中...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={20} />} my="md">
        データの取得に失敗しました。再読み込みしてください。
      </Alert>
    );
  }

  if (empty) {
    return (
      <Center h={200}>
        <Stack align="center" gap="sm">
          <IconDatabaseOff size={48} color="var(--mantine-color-gray-5)" />
          <Text c="dimmed">{emptyMessage || 'データがありません'}</Text>
        </Stack>
      </Center>
    );
  }

  return <>{children}</>;
}
