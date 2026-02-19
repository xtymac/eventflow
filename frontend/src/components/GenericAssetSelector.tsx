import { useState, useMemo } from 'react';
import { Text, Loader } from '@/components/shims';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from 'use-debounce';
import {
  useAssets,
  useRiversInBbox,
  useStreetLightsInBbox,
  useGreenSpacesInBbox,
  useStreetTreesInBbox,
  useParkFacilitiesInBbox,
  usePavementSectionsInBbox,
  usePumpStationsInBbox,
} from '../hooks/useApi';
import { useUIStore } from '../stores/uiStore';
import type { AssetTypeRef } from '@nagoya/shared';

const LIMIT = 50;

// Asset type labels for display
export const ASSET_TYPE_LABELS: Record<AssetTypeRef, string> = {
  road: '道路',
  river: '河川',
  streetlight: '街路灯',
  greenspace: '緑地',
  street_tree: '街路樹',
  park_facility: '公園施設',
  pavement_section: '舗装区間',
  pump_station: 'ポンプ場',
};

interface GenericAssetSelectorProps {
  assetType: AssetTypeRef;
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

// Helper to format asset label based on type
function formatAssetLabel(asset: any, _assetType: AssetTypeRef): string {
  const name = asset.name || asset.displayName || asset.id;
  const ward = asset.ward ? ` (${asset.ward})` : '';
  return `${name}${ward}`;
}

export function GenericAssetSelector({
  assetType,
  value,
  onChange,
  label = '資産を選択',
  placeholder = '検索...',
  error,
  disabled = false,
}: GenericAssetSelectorProps) {
  const [searchValue] = useState('');
  const [debouncedSearch] = useDebounce(searchValue, 300);
  const mapBbox = useUIStore((s) => s.mapBbox);

  // Fetch assets based on type
  // Roads use useAssets, others use type-specific hooks with bbox
  const roadsQuery = useAssets(
    assetType === 'road' ? {
      status: 'active',
      q: debouncedSearch || undefined,
      limit: LIMIT,
    } : { limit: 0 } // Disabled if not road
  );

  const riversQuery = useRiversInBbox(
    assetType === 'river' && mapBbox ? mapBbox : null,
    undefined,
    { enabled: assetType === 'river' }
  );

  const streetlightsQuery = useStreetLightsInBbox(
    assetType === 'streetlight' && mapBbox ? mapBbox : null,
    undefined,
    { enabled: assetType === 'streetlight' }
  );

  const greenspacesQuery = useGreenSpacesInBbox(
    assetType === 'greenspace' && mapBbox ? mapBbox : null,
    undefined,
    { enabled: assetType === 'greenspace' }
  );

  const streetTreesQuery = useStreetTreesInBbox(
    assetType === 'street_tree' && mapBbox ? mapBbox : null,
    undefined,
    { enabled: assetType === 'street_tree' }
  );

  const parkFacilitiesQuery = useParkFacilitiesInBbox(
    assetType === 'park_facility' && mapBbox ? mapBbox : null,
    undefined,
    { enabled: assetType === 'park_facility' }
  );

  const pavementSectionsQuery = usePavementSectionsInBbox(
    assetType === 'pavement_section' && mapBbox ? mapBbox : null,
    undefined,
    { enabled: assetType === 'pavement_section' }
  );

  const pumpStationsQuery = usePumpStationsInBbox(
    assetType === 'pump_station' && mapBbox ? mapBbox : null,
    undefined,
    { enabled: assetType === 'pump_station' }
  );

  // Get the right query based on asset type
  const query = useMemo(() => {
    switch (assetType) {
      case 'road':
        return roadsQuery;
      case 'river':
        return riversQuery;
      case 'streetlight':
        return streetlightsQuery;
      case 'greenspace':
        return greenspacesQuery;
      case 'street_tree':
        return streetTreesQuery;
      case 'park_facility':
        return parkFacilitiesQuery;
      case 'pavement_section':
        return pavementSectionsQuery;
      case 'pump_station':
        return pumpStationsQuery;
      default:
        return roadsQuery;
    }
  }, [
    assetType,
    roadsQuery,
    riversQuery,
    streetlightsQuery,
    greenspacesQuery,
    streetTreesQuery,
    parkFacilitiesQuery,
    pavementSectionsQuery,
    pumpStationsQuery,
  ]);

  // Extract data array from query (handle different response shapes)
  const assets = useMemo(() => {
    if (!query.data) return [];
    // Roads have { data: [...] } shape
    if ('data' in query.data && Array.isArray(query.data.data)) {
      return query.data.data;
    }
    // Others have direct array or { features: [...] } (GeoJSON)
    if (Array.isArray(query.data)) {
      return query.data;
    }
    if ('features' in query.data && Array.isArray(query.data.features)) {
      // Extract properties from GeoJSON features
      return query.data.features.map((f: any) => f.properties);
    }
    return [];
  }, [query.data]);

  // Filter by search if applicable (for non-road types that don't have server-side search)
  const filteredAssets = useMemo(() => {
    if (!debouncedSearch || assetType === 'road') {
      return assets.slice(0, LIMIT);
    }
    const search = debouncedSearch.toLowerCase();
    return assets
      .filter((a: any) => {
        const name = (a.name || a.displayName || a.id || '').toLowerCase();
        return name.includes(search);
      })
      .slice(0, LIMIT);
  }, [assets, debouncedSearch, assetType]);

  // Build select options
  const options = useMemo(() => {
    return filteredAssets.map((a: any) => ({
      value: a.id,
      label: formatAssetLabel(a, assetType),
    }));
  }, [filteredAssets, assetType]);

  const isLoading = query.isLoading || query.isFetching;

  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
      <Select
        value={value ?? ''}
        onValueChange={(v) => onChange(v || null)}
        disabled={disabled}
      >
        <SelectTrigger className={error ? 'border-red-500' : ''}>
          <SelectValue placeholder={placeholder} />
          {isLoading && <Loader size="xs" className="ml-2" />}
        </SelectTrigger>
        <SelectContent>
          {options.length > 0 ? (
            options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))
          ) : (
            <div className="px-2 py-4 text-center">
              {isLoading ? (
                <Loader size="xs" />
              ) : !mapBbox && assetType !== 'road' ? (
                <Text size="xs" c="dimmed">地図を移動してください</Text>
              ) : (
                <Text size="xs" c="dimmed">見つかりませんでした</Text>
              )}
            </div>
          )}
        </SelectContent>
      </Select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
