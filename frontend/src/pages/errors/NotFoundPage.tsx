import { Center, Stack, Text, Title } from '@/components/shims';
import { Button } from '@/components/ui/button';
import { IconError404 } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Center h="calc(100vh - 120px)">
      <Stack align="center" gap="md">
        <IconError404 size={80} className="text-muted-foreground" />
        <Title order={2}>404</Title>
        <Text c="dimmed">ページが見つかりません</Text>
        <Button variant="outline" onClick={() => navigate('/map')}>
          地図に戻る
        </Button>
      </Stack>
    </Center>
  );
}
