export type RoadAssetLabelFields = {
  id?: string | number | null;
  displayName?: string | null;
  name?: string | null;
  nameJa?: string | null;
  ref?: string | null;
  localRef?: string | null;
};

const normalize = (value?: string | null) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeId = (value?: string | number | null) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const getFallbackName = (asset: RoadAssetLabelFields) =>
  normalize(asset.displayName) ||
  normalize(asset.name) ||
  normalize(asset.nameJa) ||
  normalize(asset.ref) ||
  normalize(asset.localRef);

export const getRoadAssetLabel = (asset: RoadAssetLabelFields) => {
  const label = getFallbackName(asset);
  if (label) return label;
  const id = normalizeId(asset.id);
  if (id) {
    // Show simplified ID without "RA-" prefix (e.g., "NISH-4032" instead of "RA-NISH-4032")
    return id.startsWith('RA-') ? id.substring(3) : id;
  }
  return 'Unnamed Road';
};

export const isRoadAssetUnnamed = (asset: RoadAssetLabelFields) => !getFallbackName(asset);
