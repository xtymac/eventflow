const ERA_OFFSETS: Record<string, number> = {
  M: 1867,
  T: 1911,
  S: 1925,
  H: 1988,
  R: 2018,
};

/**
 * Parse a Japanese era date string into a Gregorian year and optional Date.
 *
 * Accepted formats:
 *   "S12"        → { year: 1937, date: null }
 *   "S12.03.28"  → { year: 1937, date: Date(1937-03-28T00:00:00Z) }
 *   "S元"        → { year: 1926, date: null }
 *   "S元.12.25"  → { year: 1926, date: Date(1926-12-25T00:00:00Z) }
 *
 * Returns { year: NaN, date: null } for unparseable input.
 */
export function parseJapaneseEraDate(s: string): { year: number; date: Date | null } {
  const INVALID = { year: NaN, date: null };
  if (!s || typeof s !== 'string') return INVALID;

  const trimmed = s.trim().toUpperCase();

  // Match: era letter + (digits or 元) + optional .MM.DD
  const match = trimmed.match(/^([MTSHR])(\d+|元)(?:\.(\d{1,2})\.(\d{1,2}))?$/);
  if (!match) return INVALID;

  const eraLetter = match[1];
  const offset = ERA_OFFSETS[eraLetter];
  if (offset === undefined) return INVALID;

  const eraYear = match[2] === '元' ? 1 : parseInt(match[2], 10);
  if (isNaN(eraYear) || eraYear < 1) return INVALID;

  const gregorianYear = offset + eraYear;

  const monthStr = match[3];
  const dayStr = match[4];

  if (monthStr && dayStr) {
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return INVALID;
    // UTC midnight to avoid timezone drift
    const date = new Date(Date.UTC(gregorianYear, month - 1, day));
    // Validate the date didn't roll over (e.g. Feb 30 → Mar 2)
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return INVALID;
    return { year: gregorianYear, date };
  }

  return { year: gregorianYear, date: null };
}

/** Normalize a Date to UTC midnight for date-only comparison. */
export function toUTCMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
