import { useState } from 'react';
import { Box, Stack, Text, Title, Divider } from '@/components/shims';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PasswordInput } from '@/components/ui/password-input';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, type UserRole } from '../contexts/AuthContext';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username || '\u30C6\u30B9\u30C8\u30E6\u30FC\u30B6\u30FC';
    login(u, password, role);
    const next = searchParams.get('next');
    navigate(next && next.startsWith('/') ? next : '/map');
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
      <div
        className="py-4 px-8"
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #dee2e6',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <Stack gap={4}>
            <Title order={4} fw={600} c="gray.8">
              名古屋市緑生土木局
            </Title>
            <Text size="sm" c="dimmed">
              Nagoya City Green Civil Engineering Bureau
            </Text>
          </Stack>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-sm mx-auto w-full"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: '3rem',
          paddingBottom: '3rem',
        }}
      >
        <div
          className="w-full rounded-md bg-white p-8"
          style={{
            border: '1px solid #dee2e6',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
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
                <div>
                  <Label htmlFor="username" className="font-medium mb-2 block">ユーザー名</Label>
                  <Input
                    id="username"
                    placeholder="ユーザー名を入力"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="rounded"
                  />
                </div>

                <PasswordInput
                  label="パスワード"
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                {/* Role Selection */}
                <div>
                  <Text size="sm" fw={500} className="mb-1.5">
                    ロール
                  </Text>
                  <RadioGroup value={role} onValueChange={(v) => setRole(v as UserRole)}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="admin" id="role-admin" />
                      <Label htmlFor="role-admin" className="text-sm">管理者（技術指導課）</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="user" id="role-user" />
                      <Label htmlFor="role-user" className="text-sm">利用者（緑地部／公園緑地課、各土木事務所）</Label>
                    </div>
                  </RadioGroup>
                </div>
              </Stack>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full mt-2 rounded"
              >
                ログイン
              </Button>
            </Stack>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div
        className="py-2"
        style={{
          backgroundColor: 'white',
          borderTop: '1px solid #dee2e6',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <Text size="xs" c="dimmed" ta="center">
            &copy; 2026 Nagoya City. All rights reserved.
          </Text>
        </div>
      </div>
    </Box>
  );
}
