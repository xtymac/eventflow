import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  searchPlaces,
  isWithinNagoyaBounds,
  isGoogleMapsConfigured,
} from '../services/google-maps.js';

// Coordinate detection regex - matches "lng,lat" or "lat,lng" formats
const COORD_REGEX = /^(-?\d{1,3}\.?\d*)\s*,\s*(-?\d{1,3}\.?\d*)$/;

/**
 * Parse coordinate input and determine if it's lng,lat or lat,lng format
 * Based on Nagoya's coordinates: lat ~35, lng ~137
 */
function parseCoordinates(input: string): { lng: number; lat: number } | null {
  const trimmed = input.trim();
  const match = trimmed.match(COORD_REGEX);
  if (!match) return null;

  const a = parseFloat(match[1]);
  const b = parseFloat(match[2]);

  // Validate both numbers are valid
  if (isNaN(a) || isNaN(b)) return null;

  // Heuristic: Nagoya latitude ~35, longitude ~137
  // If first number is in lng range (136-138) and second in lat range (34-36)
  if (a >= 136 && a <= 138 && b >= 34 && b <= 36) {
    return { lng: a, lat: b }; // lng,lat format
  }
  // If first number is in lat range and second in lng range
  if (b >= 136 && b <= 138 && a >= 34 && a <= 36) {
    return { lng: b, lat: a }; // lat,lng format
  }

  // If neither matches Nagoya ranges, still try to parse but may be out of bounds
  // Assume lng,lat if first number > 100 (typical for Japan longitude)
  if (a > 100) {
    return { lng: a, lat: b };
  }
  return { lng: b, lat: a };
}

// Search result type (places only)
const SearchResultSchema = Type.Object({
  id: Type.String(),
  type: Type.Literal('place'),
  name: Type.String(),
  address: Type.Optional(Type.String()),
  coordinates: Type.Tuple([Type.Number(), Type.Number()]), // [lng, lat]
  metadata: Type.Optional(Type.Object({
    placeId: Type.Optional(Type.String()),
  })),
});

const GeocodeResponseSchema = Type.Object({
  data: Type.Object({
    places: Type.Array(SearchResultSchema),
    searchCenter: Type.Optional(Type.Tuple([Type.Number(), Type.Number()])),
    isCoordinateSearch: Type.Boolean(),
  }),
  meta: Type.Object({
    query: Type.String(),
    processingTime: Type.Number(),
    error: Type.Optional(Type.String()),
    errorMessage: Type.Optional(Type.String()),
  }),
});

export async function searchRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /search/geocode - Map navigation search (Google Places + coordinates)
  app.get('/geocode', {
    schema: {
      querystring: Type.Object({
        q: Type.String({ minLength: 1 }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 10 })),
      }),
      response: {
        200: GeocodeResponseSchema,
      },
    },
  }, async (request) => {
    const startTime = Date.now();
    const { q: query, limit = 10 } = request.query;

    // Check for coordinate input
    const coords = parseCoordinates(query);

    if (coords) {
      // Coordinate search mode - just validate and return center
      if (!isWithinNagoyaBounds(coords.lng, coords.lat)) {
        return {
          data: {
            places: [],
            searchCenter: [coords.lng, coords.lat] as [number, number],
            isCoordinateSearch: true,
          },
          meta: {
            query,
            processingTime: Date.now() - startTime,
            error: 'OUTSIDE_BOUNDS',
            errorMessage: '指定された座標は名古屋市の範囲外です (Coordinates are outside Nagoya city limits)',
          },
        };
      }

      // Valid coordinates - return as search center for flyTo
      return {
        data: {
          places: [],
          searchCenter: [coords.lng, coords.lat] as [number, number],
          isCoordinateSearch: true,
        },
        meta: {
          query,
          processingTime: Date.now() - startTime,
        },
      };
    }

    // Text search mode - use Google Places API
    const places = await searchPlacesWithTransform(query, limit);

    return {
      data: {
        places,
        isCoordinateSearch: false,
      },
      meta: {
        query,
        processingTime: Date.now() - startTime,
      },
    };
  });
}

// Helper: Search places using Google Places API and transform to SearchResult
async function searchPlacesWithTransform(query: string, limit: number) {
  if (!isGoogleMapsConfigured()) {
    console.warn('[Search] Google Maps API key not configured');
    return [];
  }

  try {
    const places = await searchPlaces(query, limit);
    return places.map((place) => ({
      id: place.placeId,
      type: 'place' as const,
      name: place.name,
      address: place.address,
      coordinates: place.coordinates,
      metadata: {
        placeId: place.placeId,
      },
    }));
  } catch (error) {
    console.error('[Search] Google Places API error:', error);
    return [];
  }
}
