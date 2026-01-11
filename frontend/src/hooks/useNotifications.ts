import { useRecentEdits, useRoadEditSSE } from './useApi';
import { useNotificationStore } from '../stores/notificationStore';
import { useMapStore } from '../stores/mapStore';

/**
 * Shared hook for notification state used by both App.tsx (for badge)
 * and NotificationSidebar (for list). Prevents duplicate API calls.
 */
export function useNotifications() {
  const { data, isLoading, refetch } = useRecentEdits({ limit: 50 });
  const viewedEditIds = useNotificationStore((s) => s.viewedEditIds);
  const refreshRoadTiles = useMapStore((s) => s.refreshRoadTiles);

  // SSE for real-time updates (invalidates query cache + refreshes map tiles)
  useRoadEditSSE({
    onEdit: () => {
      refreshRoadTiles();
    },
  });

  const edits = data?.data ?? [];
  const unreadCount = edits.filter((e) => !viewedEditIds.includes(e.id)).length;

  return { edits, unreadCount, isLoading, refetch };
}
