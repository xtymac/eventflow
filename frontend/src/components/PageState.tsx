import { Center, Stack, Text, Loader } from '@/components/shims';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
      <Alert variant="destructive" className="my-4">
        <IconAlertCircle className="h-4 w-4" />
        <AlertDescription>データの取得に失敗しました。再読み込みしてください。</AlertDescription>
      </Alert>
    );
  }

  if (empty) {
    return (
      <Center h={200}>
        <Stack align="center" gap="sm">
          <IconDatabaseOff size={48} className="text-muted-foreground" />
          <Text c="dimmed">{emptyMessage || 'データがありません'}</Text>
        </Stack>
      </Center>
    );
  }

  return <>{children}</>;
}
