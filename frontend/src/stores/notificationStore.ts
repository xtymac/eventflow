import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotificationState {
  // Persisted: Set of edit IDs the user has already seen
  viewedEditIds: string[];
  // Transient: Sidebar open state
  isSidebarOpen: boolean;

  // Actions
  markAsViewed: (editId: string) => void;
  markAllAsViewed: (editIds: string[]) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      viewedEditIds: [],
      isSidebarOpen: false,

      markAsViewed: (editId) =>
        set((state) => ({
          viewedEditIds: state.viewedEditIds.includes(editId)
            ? state.viewedEditIds
            : [...state.viewedEditIds, editId],
        })),

      markAllAsViewed: (editIds) =>
        set((state) => ({
          viewedEditIds: [...new Set([...state.viewedEditIds, ...editIds])],
        })),

      openSidebar: () => set({ isSidebarOpen: true }),
      closeSidebar: () => set({ isSidebarOpen: false }),
      toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
    }),
    {
      name: 'notification-store',
      partialize: (state) => ({ viewedEditIds: state.viewedEditIds }), // Only persist viewedEditIds
    }
  )
);
