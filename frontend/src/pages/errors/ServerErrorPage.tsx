import { Center, Stack, Text, Title } from '@/components/shims';
import { Button } from '@/components/ui/button';
import { IconServerOff } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export function ServerErrorPage() {
  const navigate = useNavigate();

  return (
    <Center h="calc(100vh - 120px)">
      <Stack align="center" gap="md">
        <IconServerOff size={80} className="text-red-400" />
        <Title order={2}>500</Title>
        <Text c="dimmed">サーバーエラーが発生しました</Text>
        <Button variant="outline" onClick={() => navigate('/map')}>
          地図に戻る
        </Button>
      </Stack>
    </Center>
  );
}
