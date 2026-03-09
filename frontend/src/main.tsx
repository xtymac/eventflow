import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfirmDialogProvider } from '@/components/ui/confirm-dialog';
import { AuthProvider } from './contexts/AuthContext';
import { router } from './router';
import { useUIStore } from './stores/uiStore';
import './styles/tailwind.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/index.css';

// Expose store for E2E testing
if (import.meta.env.DEV) {
  (window as any).__zustand_uiStore = useUIStore;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <ConfirmDialogProvider>
              <Toaster position="top-right" richColors />
              <RouterProvider router={router} />
            </ConfirmDialogProvider>
          </TooltipProvider>
        </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
