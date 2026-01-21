/**
 * Google Maps API service for road name lookup and place search
 * Uses Reverse Geocoding API to get road names from coordinates
 * Uses Places Text Search API for location search
 */

// Nagoya city bounds for search restriction
export const NAGOYA_BOUNDS = {
  south: 35.05,
  north: 35.30,
  west: 136.80,
  east: 137.05,
};

// Nagoya city center for biasing search results
const NAGOYA_CENTER = { lat: 35.18, lng: 136.91 };
const NAGOYA_SEARCH_RADIUS = 15000; // 15km radius

/**
 * Check if coordinates are within Nagoya city bounds
 */
export function isWithinNagoyaBounds(lng: number, lat: number): boolean {
  return (
    lng >= NAGOYA_BOUNDS.west &&
    lng <= NAGOYA_BOUNDS.east &&
    lat >= NAGOYA_BOUNDS.south &&
    lat <= NAGOYA_BOUNDS.north
  );
}

// Place search result from Google Places API
export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [lng, lat]
  types: string[];
}

interface PlacesTextSearchResponse {
  results: Array<{
    place_id: string;
    name: string;
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    types: string[];
  }>;
  status: string;
  error_message?: string;
}

interface ReverseGeocodeResult {
  roadName: string | null;
  sublocality: string | null;  // 町名/丁目 (sublocality_level_1, neighborhood)
  formattedAddress: string | null;
  placeId: string | null;
}

interface GeocodeResponse {
  results: Array<{
    place_id: string;
    formatted_address: string;
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    types: string[];
  }>;
  status: string;
  error_message?: string;
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Get road name from coordinates using Google Maps Reverse Geocoding API
 * @param lat Latitude
 * @param lng Longitude
 * @returns Road name and address information
 */
export async function getRoadNameFromCoordinates(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  url.searchParams.set('language', 'ja'); // Japanese results
  url.searchParams.set('result_type', 'route'); // Focus on road results

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Google Maps API error: ${response.status}`);
  }

  const data: GeocodeResponse = await response.json();

  if (data.status === 'ZERO_RESULTS') {
    return { roadName: null, sublocality: null, formattedAddress: null, placeId: null };
  }

  if (data.status !== 'OK') {
    throw new Error(`Google Maps API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
  }

  // Find the route result
  const routeResult = data.results.find(r => r.types.includes('route'));

  // Helper to extract sublocality from address components
  const extractSublocality = (components: GeocodeResponse['results'][0]['address_components']): string | null => {
    // Priority: sublocality_level_1 > neighborhood > sublocality
    const sublocalityLevel1 = components.find(c => c.types.includes('sublocality_level_1'));
    if (sublocalityLevel1) return sublocalityLevel1.long_name;

    const neighborhood = components.find(c => c.types.includes('neighborhood'));
    if (neighborhood) return neighborhood.long_name;

    const sublocality = components.find(c => c.types.includes('sublocality'));
    if (sublocality) return sublocality.long_name;

    return null;
  };

  if (!routeResult) {
    // Fallback to first result
    const firstResult = data.results[0];
    if (!firstResult) {
      return { roadName: null, sublocality: null, formattedAddress: null, placeId: null };
    }

    // Try to extract route from address components
    const routeComponent = firstResult.address_components.find(c =>
      c.types.includes('route')
    );

    return {
      roadName: routeComponent?.long_name || null,
      sublocality: extractSublocality(firstResult.address_components),
      formattedAddress: firstResult.formatted_address,
      placeId: firstResult.place_id,
    };
  }

  // Extract road name from route result
  const routeComponent = routeResult.address_components.find(c =>
    c.types.includes('route')
  );

  return {
    roadName: routeComponent?.long_name || null,
    sublocality: extractSublocality(routeResult.address_components),
    formattedAddress: routeResult.formatted_address,
    placeId: routeResult.place_id,
  };
}

/**
 * Get road name for a LineString geometry by sampling points along the line
 * @param coordinates Array of [lng, lat] coordinates
 * @returns Most common road name found
 */
export async function getRoadNameForLineString(
  coordinates: [number, number][]
): Promise<ReverseGeocodeResult> {
  if (!coordinates || coordinates.length === 0) {
    return { roadName: null, sublocality: null, formattedAddress: null, placeId: null };
  }

  // Sample up to 3 points: start, middle, end
  const sampleIndices = [
    0,
    Math.floor(coordinates.length / 2),
    coordinates.length - 1,
  ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

  const results: ReverseGeocodeResult[] = [];

  for (const idx of sampleIndices) {
    const [lng, lat] = coordinates[idx];
    try {
      const result = await getRoadNameFromCoordinates(lat, lng);
      if (result.roadName) {
        results.push(result);
      }
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[GoogleMaps] Error at point ${idx}:`, error);
    }
  }

  if (results.length === 0) {
    return { roadName: null, sublocality: null, formattedAddress: null, placeId: null };
  }

  // Return the most common road name, or first if all different
  const nameCounts = new Map<string, number>();
  for (const r of results) {
    if (r.roadName) {
      nameCounts.set(r.roadName, (nameCounts.get(r.roadName) || 0) + 1);
    }
  }

  let bestName = results[0].roadName;
  let bestCount = 0;
  for (const [name, count] of nameCounts) {
    if (count > bestCount) {
      bestName = name;
      bestCount = count;
    }
  }

  const bestResult = results.find(r => r.roadName === bestName) || results[0];
  return bestResult;
}

/**
 * Check if Google Maps API is configured
 */
export function isGoogleMapsConfigured(): boolean {
  return !!GOOGLE_MAPS_API_KEY;
}

/**
 * Search for places using Google Places Text Search API
 * Results are filtered to Nagoya city bounds
 * @param query Search query (supports Japanese)
 * @param limit Maximum number of results (default 10)
 * @returns Array of place results within Nagoya bounds
 */
export async function searchPlaces(
  query: string,
  limit: number = 10
): Promise<PlaceSearchResult[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  if (!query || query.trim().length === 0) {
    return [];
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query.trim());
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  url.searchParams.set('language', 'ja');
  url.searchParams.set('region', 'jp');
  // Bias results toward Nagoya center
  url.searchParams.set('location', `${NAGOYA_CENTER.lat},${NAGOYA_CENTER.lng}`);
  url.searchParams.set('radius', NAGOYA_SEARCH_RADIUS.toString());

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Google Places API error: ${response.status}`);
  }

  const data: PlacesTextSearchResponse = await response.json();

  if (data.status === 'ZERO_RESULTS') {
    return [];
  }

  if (data.status !== 'OK') {
    throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
  }

  // Filter to Nagoya bounds and transform results
  const results: PlaceSearchResult[] = [];
  for (const place of data.results) {
    const lng = place.geometry.location.lng;
    const lat = place.geometry.location.lat;

    // Skip places outside Nagoya bounds
    if (!isWithinNagoyaBounds(lng, lat)) {
      continue;
    }

    results.push({
      placeId: place.place_id,
      name: place.name,
      address: place.formatted_address,
      coordinates: [lng, lat],
      types: place.types,
    });

    // Respect limit
    if (results.length >= limit) {
      break;
    }
  }

  return results;
}
