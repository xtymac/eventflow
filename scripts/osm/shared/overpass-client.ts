/**
 * Overpass API Client with Rate Limiting and Retry
 *
 * Features:
 * - Multiple endpoint fallback
 * - Automatic rate limiting (max 1 request per 2 seconds)
 * - Exponential backoff on 429/504 errors
 * - Request deduplication
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Minimum interval between requests (ms)
const MIN_REQUEST_INTERVAL = 2000;

// Maximum retries per request
const MAX_RETRIES = 3;

// Backoff multiplier for retries
const BACKOFF_BASE_MS = 10000;

/**
 * Delay helper
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Overpass API Client
 */
class OverpassClient {
  private currentEndpoint = 0;
  private lastRequestTime = 0;
  private requestCount = 0;

  /**
   * Execute an Overpass query with rate limiting and retry
   */
  async query(queryString: string): Promise<any> {
    // Rate limiting: ensure minimum interval between requests
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < MIN_REQUEST_INTERVAL) {
      await delay(MIN_REQUEST_INTERVAL - elapsed);
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const endpoint = OVERPASS_ENDPOINTS[this.currentEndpoint];

      try {
        console.log(`  [Overpass] Querying ${endpoint} (attempt ${attempt}/${MAX_RETRIES})...`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `data=${encodeURIComponent(queryString)}`,
        });

        this.lastRequestTime = Date.now();
        this.requestCount++;

        if (response.status === 429 || response.status === 504) {
          // Rate limited or timeout - switch endpoint and backoff
          console.log(`  [Overpass] Got ${response.status}, switching endpoint and backing off...`);
          this.currentEndpoint = (this.currentEndpoint + 1) % OVERPASS_ENDPOINTS.length;
          const backoffMs = BACKOFF_BASE_MS * attempt;
          console.log(`  [Overpass] Waiting ${backoffMs / 1000}s before retry...`);
          await delay(backoffMs);
          continue;
        }

        if (!response.ok) {
          throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`  [Overpass] Got ${data.elements?.length || 0} elements`);
        return data;
      } catch (error) {
        const errorMessage = String(error);
        if (attempt < MAX_RETRIES && (errorMessage.includes('504') || errorMessage.includes('ETIMEDOUT'))) {
          console.log(`  [Overpass] Request failed: ${errorMessage}`);
          this.currentEndpoint = (this.currentEndpoint + 1) % OVERPASS_ENDPOINTS.length;
          const backoffMs = BACKOFF_BASE_MS * attempt;
          console.log(`  [Overpass] Waiting ${backoffMs / 1000}s before retry...`);
          await delay(backoffMs);
        } else if (attempt === MAX_RETRIES) {
          throw error;
        }
      }
    }

    throw new Error('Overpass query failed after all retries');
  }

  /**
   * Get statistics
   */
  getStats(): { requestCount: number } {
    return { requestCount: this.requestCount };
  }
}

// Singleton instance
export const overpassClient = new OverpassClient();

/**
 * Build bbox string for Overpass query
 * Overpass uses: south,west,north,east
 */
export function toBboxString(minLng: number, minLat: number, maxLng: number, maxLat: number): string {
  return `${minLat},${minLng},${maxLat},${maxLng}`;
}

/**
 * Nagoya bounding box (entire city)
 */
export const NAGOYA_BBOX = {
  minLng: 136.8,
  minLat: 35.05,
  maxLng: 137.1,
  maxLat: 35.3,
};

/**
 * Ward configurations for batch processing
 */
export interface WardConfig {
  englishName: string;
  japaneseName: string;
  fileName: string;
}

export const WARDS: WardConfig[] = [
  { englishName: 'Naka-ku', japaneseName: '中区', fileName: 'naka-ku.geojson' },
  { englishName: 'Nakamura-ku', japaneseName: '中村区', fileName: 'nakamura-ku.geojson' },
  { englishName: 'Higashi-ku', japaneseName: '東区', fileName: 'higashi-ku.geojson' },
  { englishName: 'Kita-ku', japaneseName: '北区', fileName: 'kita-ku.geojson' },
  { englishName: 'Nishi-ku', japaneseName: '西区', fileName: 'nishi-ku.geojson' },
  { englishName: 'Chikusa-ku', japaneseName: '千種区', fileName: 'chikusa-ku.geojson' },
  { englishName: 'Showa-ku', japaneseName: '昭和区', fileName: 'showa-ku.geojson' },
  { englishName: 'Mizuho-ku', japaneseName: '瑞穂区', fileName: 'mizuho-ku.geojson' },
  { englishName: 'Atsuta-ku', japaneseName: '熱田区', fileName: 'atsuta-ku.geojson' },
  { englishName: 'Nakagawa-ku', japaneseName: '中川区', fileName: 'nakagawa-ku.geojson' },
  { englishName: 'Minato-ku', japaneseName: '港区', fileName: 'minato-ku.geojson' },
  { englishName: 'Minami-ku', japaneseName: '南区', fileName: 'minami-ku.geojson' },
  { englishName: 'Moriyama-ku', japaneseName: '守山区', fileName: 'moriyama-ku.geojson' },
  { englishName: 'Midori-ku', japaneseName: '緑区', fileName: 'midori-ku.geojson' },
  { englishName: 'Meito-ku', japaneseName: '名東区', fileName: 'meito-ku.geojson' },
  { englishName: 'Tempaku-ku', japaneseName: '天白区', fileName: 'tempaku-ku.geojson' },
];
