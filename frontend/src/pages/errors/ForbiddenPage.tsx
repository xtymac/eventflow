import { Center, Stack, Text, Button, Title } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <Center h="calc(100vh - 120px)">
      <Stack align="center" gap="md">
        <IconLock size={80} color="var(--mantine-color-orange-5)" />
        <Title order={2}>403</Title>
        <Text c="dimmed">このページへのアクセス権限がありません</Text>
        <Button variant="light" onClick={() => navigate(-1)}>
          前のページに戻る
        </Button>
      </Stack>
    </Center>
  );
}
