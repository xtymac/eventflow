import { useEffect, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';

/**
 * URL parameter names for state persistence
 */
const URL_PARAMS = {
  // Tab selection
  tab: 'tab',

  // Asset filters
  assetRoadType: 'roadType',
  assetStatus: 'assetStatus',
  assetWard: 'ward',
  assetSearch: 'assetSearch',
  assetUnnamed: 'unnamed',

  // Event filters
  eventStatus: 'eventStatus',
  eventSearch: 'eventSearch',
  eventDepartment: 'department',

  // Selected items (for deep linking)
  selectedEvent: 'event',
  selectedAsset: 'asset',
} as const;

type ViewType = 'events' | 'assets' | 'inspections';

/**
 * Hook to sync UI state with URL parameters
 * - Reads URL params on mount and initializes store
 * - Updates URL when relevant store state changes
 */
export function useUrlState() {
  const isInitialized = useRef(false);
  const isUpdatingFromUrl = useRef(false);

  const {
    currentView,
    setCurrentView,
    assetFilters,
    setAssetFilter,
    eventFilters,
    setEventFilter,
    selectedEventId,
    selectEvent,
    selectedAssetId,
    selectAsset,
  } = useUIStore();

  // Initialize from URL on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    isUpdatingFromUrl.current = true;

    const params = new URLSearchParams(window.location.search);

    // Tab selection
    const tab = params.get(URL_PARAMS.tab);
    if (tab && ['events', 'assets', 'inspections'].includes(tab)) {
      setCurrentView(tab as ViewType);
    }

    // Asset filters
    const roadType = params.get(URL_PARAMS.assetRoadType);
    if (roadType) setAssetFilter('roadType', roadType);

    const assetStatus = params.get(URL_PARAMS.assetStatus);
    if (assetStatus) setAssetFilter('status', assetStatus);

    const ward = params.get(URL_PARAMS.assetWard);
    if (ward) setAssetFilter('ward', ward);

    const assetSearch = params.get(URL_PARAMS.assetSearch);
    if (assetSearch) setAssetFilter('search', assetSearch);

    const unnamed = params.get(URL_PARAMS.assetUnnamed);
    if (unnamed === 'true') setAssetFilter('unnamed', true);

    // Event filters
    const eventStatus = params.get(URL_PARAMS.eventStatus);
    if (eventStatus) setEventFilter('status', eventStatus);

    const eventSearch = params.get(URL_PARAMS.eventSearch);
    if (eventSearch) setEventFilter('search', eventSearch);

    const department = params.get(URL_PARAMS.eventDepartment);
    if (department) setEventFilter('department', department);

    // Selected items (deep linking)
    const selectedEvent = params.get(URL_PARAMS.selectedEvent);
    if (selectedEvent) {
      selectEvent(selectedEvent);
      // If event is selected, switch to events tab
      if (!tab) setCurrentView('events');
    }

    const selectedAsset = params.get(URL_PARAMS.selectedAsset);
    if (selectedAsset && !selectedEvent) {
      selectAsset(selectedAsset);
      // If asset is selected, switch to assets tab
      if (!tab) setCurrentView('assets');
    }

    // Delay clearing the flag to let effects run
    setTimeout(() => {
      isUpdatingFromUrl.current = false;
    }, 100);
  }, [setCurrentView, setAssetFilter, setEventFilter, selectEvent, selectAsset]);

  // Update URL when state changes
  useEffect(() => {
    // Skip if we're initializing from URL
    if (isUpdatingFromUrl.current) return;

    const params = new URLSearchParams();

    // Tab selection (only add if not default)
    if (currentView !== 'events') {
      params.set(URL_PARAMS.tab, currentView);
    }

    // Asset filters
    if (assetFilters.roadType) params.set(URL_PARAMS.assetRoadType, assetFilters.roadType);
    if (assetFilters.status) params.set(URL_PARAMS.assetStatus, assetFilters.status);
    if (assetFilters.ward) params.set(URL_PARAMS.assetWard, assetFilters.ward);
    if (assetFilters.search) params.set(URL_PARAMS.assetSearch, assetFilters.search);
    if (assetFilters.unnamed) params.set(URL_PARAMS.assetUnnamed, 'true');

    // Event filters
    if (eventFilters.status) params.set(URL_PARAMS.eventStatus, eventFilters.status);
    if (eventFilters.search) params.set(URL_PARAMS.eventSearch, eventFilters.search);
    if (eventFilters.department) params.set(URL_PARAMS.eventDepartment, eventFilters.department);

    // Selected items
    if (selectedEventId) params.set(URL_PARAMS.selectedEvent, selectedEventId);
    if (selectedAssetId && !selectedEventId) params.set(URL_PARAMS.selectedAsset, selectedAssetId);

    // Build URL
    const queryString = params.toString();
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    // Update URL without triggering navigation
    if (window.location.search !== (queryString ? `?${queryString}` : '')) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [
    currentView,
    assetFilters.roadType,
    assetFilters.status,
    assetFilters.ward,
    assetFilters.search,
    assetFilters.unnamed,
    eventFilters.status,
    eventFilters.search,
    eventFilters.department,
    selectedEventId,
    selectedAssetId,
  ]);
}
