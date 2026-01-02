/**
 * Google Maps API service for road name lookup
 * Uses Reverse Geocoding API to get road names from coordinates
 */

interface ReverseGeocodeResult {
  roadName: string | null;
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
    return { roadName: null, formattedAddress: null, placeId: null };
  }

  if (data.status !== 'OK') {
    throw new Error(`Google Maps API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
  }

  // Find the route result
  const routeResult = data.results.find(r => r.types.includes('route'));

  if (!routeResult) {
    // Fallback to first result
    const firstResult = data.results[0];
    if (!firstResult) {
      return { roadName: null, formattedAddress: null, placeId: null };
    }

    // Try to extract route from address components
    const routeComponent = firstResult.address_components.find(c =>
      c.types.includes('route')
    );

    return {
      roadName: routeComponent?.long_name || null,
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
    return { roadName: null, formattedAddress: null, placeId: null };
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
    return { roadName: null, formattedAddress: null, placeId: null };
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
