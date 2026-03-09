import { useCallback, useRef, useState } from 'react';
import { MantineProvider } from '@mantine/core';
import { MapView } from '../../components/MapView';
import { MapSearch } from '../../components/MapSearch';
import { Navigation } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { CURATED_PARKS } from '../../data/curatedParks';
import { ContractorParkPreview } from './ContractorParkPreview';
import { ContractorFacilityPreview } from './ContractorFacilityPreview';
import { ContractorInspectionForm } from './ContractorInspectionForm';
import { ContractorRepairForm } from './ContractorRepairForm';

const PARKS_BY_ID = new Map(CURATED_PARKS.map(p => [p.id, p]));

export function ContractorMapPage() {
  const selectedAssetId = useUIStore(s => s.selectedAssetId);
  const selectedAssetType = useUIStore(s => s.selectedAssetType);
  const selectAsset = useUIStore(s => s.selectAsset);
  const previousParkIdRef = useRef<string | null>(null);
  const [inspectionFormFacilityId, setInspectionFormFacilityId] = useState<string | null>(null);
  const [repairFormFacilityId, setRepairFormFacilityId] = useState<string | null>(null);

  const selectedPark =
    selectedAssetId && selectedAssetType === 'green-space'
      ? PARKS_BY_ID.get(selectedAssetId) ?? null
      : null;

  const selectedFacilityId =
    selectedAssetId && selectedAssetType === 'park-facility'
      ? selectedAssetId
      : null;

  // Track which park we came from when opening a facility from the list
  const handleFacilityClick = useCallback(
    (facilityId: string, fromParkId?: string) => {
      previousParkIdRef.current = fromParkId ?? null;
      selectAsset(facilityId, 'park-facility');
    },
    [selectAsset],
  );

  const handleBack = useCallback(() => {
    const parkId = previousParkIdRef.current;
    if (parkId) {
      selectAsset(parkId, 'green-space');
    } else {
      selectAsset(null);
    }
    previousParkIdRef.current = null;
  }, [selectAsset]);

  const handleNavigateToPark = useCallback(
    (parkId: string) => {
      previousParkIdRef.current = null;
      selectAsset(parkId, 'green-space');
    },
    [selectAsset],
  );

  return (
    <MantineProvider
      defaultColorScheme="light"
      theme={{
        primaryColor: 'blue',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
    <div className="relative size-full" data-testid="contractor-map-page">
      <MapView />

      {/* Floating search bar — top center */}
      <div className="absolute left-1/2 top-4 z-10 w-full max-w-[500px] -translate-x-1/2 px-4">
        <div className="rounded-[10px] border border-border bg-background p-3 shadow-md">
          <MapSearch />
        </div>
      </div>

      {/* Locate button — bottom right */}
      <button
        type="button"
        aria-label="現在地に移動"
        disabled
        className="absolute bottom-6 right-4 z-10 flex size-[52px] items-center justify-center rounded-lg bg-background shadow-md disabled:opacity-50"
        data-testid="contractor-locate-button"
      >
        <Navigation size={24} className="text-foreground" />
      </button>

      {/* Park preview panel — right sidebar */}
      {selectedPark && (
        <div
          className="absolute right-0 top-0 z-20 h-full w-full bg-background shadow-lg sm:w-[400px]"
          data-testid="contractor-park-panel"
        >
          <ContractorParkPreview
            park={selectedPark}
            onClose={() => selectAsset(null)}
            onFacilityClick={handleFacilityClick}
          />
        </div>
      )}

      {/* Facility preview panel — right sidebar */}
      {selectedFacilityId && (
        <div
          className="absolute right-0 top-0 z-20 h-full w-full bg-background shadow-lg sm:w-[400px]"
          data-testid="contractor-facility-panel"
        >
          <ContractorFacilityPreview
            facilityId={selectedFacilityId}
            onClose={() => selectAsset(null)}
            onBack={previousParkIdRef.current ? handleBack : undefined}
            onNavigateToPark={handleNavigateToPark}
            onOpenInspectionForm={() => setInspectionFormFacilityId(selectedFacilityId)}
            onOpenRepairForm={() => setRepairFormFacilityId(selectedFacilityId)}
          />
        </div>
      )}

      {/* Inspection form — centered modal overlay */}
      <ContractorInspectionForm
        facilityId={inspectionFormFacilityId ?? ''}
        open={!!inspectionFormFacilityId}
        onClose={() => setInspectionFormFacilityId(null)}
        onSubmitted={() => setInspectionFormFacilityId(null)}
      />

      {/* Repair form — centered modal overlay */}
      <ContractorRepairForm
        facilityId={repairFormFacilityId ?? ''}
        open={!!repairFormFacilityId}
        onClose={() => setRepairFormFacilityId(null)}
        onSubmitted={() => setRepairFormFacilityId(null)}
      />
    </div>
    </MantineProvider>
  );
}
