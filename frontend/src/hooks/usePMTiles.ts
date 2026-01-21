/**
 * PMTiles Hook
 *
 * Handles loading and registering PMTiles protocol for MapLibre GL.
 * PMTiles allows serving pre-rendered vector tiles from a single file
 * with support for low zoom levels (overview).
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol, PMTiles } from 'pmtiles';

// PMTiles file configuration
const PMTILES_URL = '/tiles/nagoya-data.pmtiles';

interface UsePMTilesResult {
  isReady: boolean;
  isAvailable: boolean;
  error: string | null;
  sourceUrl: string;
}

/**
 * Hook to initialize PMTiles protocol and check availability
 *
 * @returns {UsePMTilesResult} PMTiles status and source URL
 */
export function usePMTiles(): UsePMTilesResult {
  const [isReady, setIsReady] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const protocolRef = useRef<Protocol | null>(null);

  useEffect(() => {
    // Register PMTiles protocol
    if (!protocolRef.current) {
      protocolRef.current = new Protocol();
      maplibregl.addProtocol('pmtiles', protocolRef.current.tile);
    }

    // Check if PMTiles file is available
    async function checkAvailability() {
      try {
        // Try to open the PMTiles file
        const pmtiles = new PMTiles(PMTILES_URL);
        const header = await pmtiles.getHeader();

        if (header) {
          console.log('[PMTiles] File available:', {
            minZoom: header.minZoom,
            maxZoom: header.maxZoom,
            centerLat: header.centerLat,
            centerLon: header.centerLon,
          });
          setIsAvailable(true);
        }
      } catch (err) {
        console.log('[PMTiles] File not available, using official MVT source');
        setIsAvailable(false);
        setError(err instanceof Error ? err.message : 'PMTiles not available');
      } finally {
        setIsReady(true);
      }
    }

    checkAvailability();

    // Cleanup
    return () => {
      // Note: Protocol removal is not typically needed as it persists
    };
  }, []);

  return {
    isReady,
    isAvailable,
    error,
    sourceUrl: `pmtiles://${window.location.origin}${PMTILES_URL}`,
  };
}

/**
 * Get the appropriate tile source configuration based on PMTiles availability
 *
 * @param pmtilesAvailable Whether PMTiles is available
 * @param pmtilesUrl The PMTiles URL
 * @returns Source configuration for MapLibre
 */
export function getNagoyaTileSource(
  pmtilesAvailable: boolean,
  pmtilesUrl: string
): maplibregl.SourceSpecification {
  if (pmtilesAvailable) {
    // Use PMTiles source (supports zoom 8-16)
    return {
      type: 'vector',
      url: pmtilesUrl,
    };
  }

  // Fallback to official MVT source (zoom 14-18 only)
  return {
    type: 'vector',
    tiles: ['https://www.shiteidourozu.city.nagoya.jp/mvt/data/shiteidouro/{z}/{x}/{y}.pbf'],
    minzoom: 14,
    maxzoom: 18,
    bounds: [136.790771, 35.034494, 137.059937, 35.260198],
  };
}

/**
 * Get the appropriate kenchiku (building) tile source
 */
export function getKenchikuTileSource(
  pmtilesAvailable: boolean,
  pmtilesUrl: string
): maplibregl.SourceSpecification {
  if (pmtilesAvailable) {
    // PMTiles includes kenchiku layer
    return {
      type: 'vector',
      url: pmtilesUrl,
    };
  }

  // Fallback to official MVT source
  return {
    type: 'vector',
    tiles: ['https://www.shiteidourozu.city.nagoya.jp/mvt/data/kenchiku/{z}/{x}/{y}.pbf'],
    minzoom: 14,
    maxzoom: 18,
    bounds: [136.790771, 35.034494, 137.059937, 35.260198],
  };
}
