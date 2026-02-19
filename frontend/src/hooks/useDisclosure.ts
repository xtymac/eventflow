import { useCallback, useState } from 'react';

/**
 * Drop-in replacement for Mantine's useDisclosure hook.
 * Returns [opened, { open, close, toggle }].
 */
export function useDisclosure(initialState = false) {
  const [opened, setOpened] = useState(initialState);

  const open = useCallback(() => setOpened(true), []);
  const close = useCallback(() => setOpened(false), []);
  const toggle = useCallback(() => setOpened((v) => !v), []);

  return [opened, { open, close, toggle }] as const;
}
