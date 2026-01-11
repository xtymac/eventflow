import { useRecentEdits, useRoadEditSSE } from './useApi';
import { useNotificationStore } from '../stores/notificationStore';

/**
 * Shared hook for notification state used by both App.tsx (for badge)
 * and NotificationSidebar (for list). Prevents duplicate API calls.
 */
export function useNotifications() {
  const { data, isLoading, refetch } = useRecentEdits({ limit: 50 });
  const viewedEditIds = useNotificationStore((s) => s.viewedEditIds);

  // SSE for real-time updates (invalidates query cache)
  useRoadEditSSE();

  const edits = data?.data ?? [];
  const unreadCount = edits.filter((e) => !viewedEditIds.includes(e.id)).length;

  return { edits, unreadCount, isLoading, refetch };
}
