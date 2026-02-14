import { useState } from 'react';
import { Box, Container, Paper, Stack, Title, TextInput, PasswordInput, Button, Text, Divider, Radio, Group } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useAuth, type UserRole } from '../contexts/AuthContext';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username || 'テストユーザー';
    login(u, password, role);
    navigate('/map');
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)',
      }}
    >
      {/* Header */}
      <Box
        py="md"
        px="xl"
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #dee2e6',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <Container size="lg">
          <Stack gap={4}>
            <Title order={4} fw={600} c="gray.8">
              名古屋市緑生土木局
            </Title>
            <Text size="sm" c="dimmed">
              Nagoya City Green Civil Engineering Bureau
            </Text>
          </Stack>
        </Container>
      </Box>

      {/* Main Content */}
      <Container
        size="xs"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: '3rem',
          paddingBottom: '3rem',
        }}
      >
        <Paper
          shadow="sm"
          p="xl"
          radius="md"
          w="100%"
          style={{
            border: '1px solid #dee2e6',
            backgroundColor: 'white',
          }}
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="lg">
              {/* Title */}
              <Stack gap="xs">
                <Title order={2} ta="center" fw={600}>
                  Login
                </Title>
                <Text size="sm" c="dimmed" ta="center">
                  公園管理システム
                </Text>
              </Stack>

              <Divider />

              {/* Form Fields */}
              <Stack gap="md">
                <TextInput
                  label="ユーザー名"
                  placeholder="ユーザー名を入力"
                  value={username}
                  onChange={(e) => setUsername(e.currentTarget.value)}
                  size="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { borderRadius: 4 },
                  }}
                />

                <PasswordInput
                  label="パスワード"
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  size="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: { borderRadius: 4 },
                  }}
                />

                {/* Role Selection */}
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    ロール
                  </Text>
                  <Radio.Group value={role} onChange={(v) => setRole(v as UserRole)}>
                    <Stack gap="xs">
                      <Radio
                        value="admin"
                        label="管理者（技術指導課）"
                        styles={{
                          label: { fontSize: 14 },
                        }}
                      />
                      <Radio
                        value="user"
                        label="利用者（緑地部／公園緑地課、各土木事務所）"
                        styles={{
                          label: { fontSize: 14 },
                        }}
                      />
                    </Stack>
                  </Radio.Group>
                </Stack>
              </Stack>

              {/* Submit Button */}
              <Button
                type="submit"
                fullWidth
                size="md"
                style={{
                  marginTop: '0.5rem',
                  borderRadius: 4,
                }}
              >
                ログイン
              </Button>
            </Stack>
          </form>
        </Paper>
      </Container>

      {/* Footer */}
      <Box
        py="sm"
        style={{
          backgroundColor: 'white',
          borderTop: '1px solid #dee2e6',
        }}
      >
        <Container size="lg">
          <Text size="xs" c="dimmed" ta="center">
            © 2026 Nagoya City. All rights reserved.
          </Text>
        </Container>
      </Box>
    </Box>
  );
}
