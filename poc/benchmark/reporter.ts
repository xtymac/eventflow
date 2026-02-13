/**
 * Benchmark reporter — statistics calculation and output formatting.
 */

export interface TimingSample {
  queryName: string;
  durationMs: number;
  rowCount: number;
}

export interface QueryStats {
  name: string;
  label: string;
  samples: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  avgRowCount: number;
}

/**
 * Calculate percentile statistics from an array of timing samples.
 */
export function calculateStats(name: string, label: string, samples: TimingSample[]): QueryStats {
  if (samples.length === 0) {
    return { name, label, samples: 0, min: 0, p50: 0, p95: 0, p99: 0, max: 0, avgRowCount: 0 };
  }

  const durations = samples.map(s => s.durationMs).sort((a, b) => a - b);
  const rowCounts = samples.map(s => s.rowCount);

  return {
    name,
    label,
    samples: durations.length,
    min: durations[0],
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    max: durations[durations.length - 1],
    avgRowCount: rowCounts.reduce((a, b) => a + b, 0) / rowCounts.length,
  };
}

function percentile(sorted: number[], pct: number): number {
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/**
 * Print a summary table to console.
 */
export function printSummary(stats: QueryStats[], thresholds?: Record<string, number>) {
  console.log('\n┌─────┬──────────────────────────────────────────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐');
  console.log('│  #  │ Query                                        │  N     │ min    │ p50    │ p95    │ p99    │ max    │ Status │');
  console.log('├─────┼──────────────────────────────────────────────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤');

  for (const s of stats) {
    const threshold = thresholds?.[s.name];
    const status = threshold ? (s.p95 <= threshold ? ' PASS ' : ' FAIL ') : '  --  ';
    const label = s.label.padEnd(44).substring(0, 44);
    console.log(
      `│ ${s.name.padEnd(3)} │ ${label} │ ${pad(s.samples)} │ ${pad(s.min)} │ ${pad(s.p50)} │ ${pad(s.p95)} │ ${pad(s.p99)} │ ${pad(s.max)} │${status}│`,
    );
  }

  console.log('└─────┴──────────────────────────────────────────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘');
}

function pad(n: number): string {
  return n.toFixed(1).padStart(6);
}

/**
 * Generate a JSON report.
 */
export function generateReport(
  env: string,
  tier: string,
  stats: QueryStats[],
  thresholds: Record<string, number>,
): object {
  const results = stats.map(s => ({
    ...s,
    threshold: thresholds[s.name] ?? null,
    pass: thresholds[s.name] ? s.p95 <= thresholds[s.name] : null,
  }));

  const allPassed = results.every(r => r.pass === null || r.pass === true);

  return {
    env,
    tier,
    timestamp: new Date().toISOString(),
    summary: {
      totalQueries: results.length,
      passed: results.filter(r => r.pass === true).length,
      failed: results.filter(r => r.pass === false).length,
      skipped: results.filter(r => r.pass === null).length,
      verdict: allPassed ? 'PASS' : 'FAIL',
    },
    results,
  };
}
