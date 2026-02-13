/**
 * GIS benchmark comparison report generator.
 *
 * Reads gis-*.json reports and produces a decision matrix markdown report
 * following the Go/No-Go criteria from the test plan.
 *
 * Usage:
 *   npx tsx poc-mongo/benchmark/gis-compare.ts
 *   npx tsx poc-mongo/benchmark/gis-compare.ts --reports-dir poc/reports --output poc/reports/GIS-DECISION-REPORT.md
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name: string, defaultVal: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const REPORTS_DIR = getArg('reports-dir', 'poc/reports');
const OUTPUT = getArg('output', 'poc/reports/GIS-DECISION-REPORT.md');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface QueryResult {
  name: string;
  label: string;
  samples: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  avgRowCount: number;
  threshold: number | null;
  pass: boolean | null;
}

interface GisReport {
  env: string;
  tier: string;
  timestamp: string;
  indexConfig: string;
  mode: string;
  concurrency?: number;
  summary: {
    totalQueries: number;
    passed: number;
    failed: number;
    skipped: number;
    verdict: string;
  };
  results: QueryResult[];
  pgComparison?: QueryResult[];
}

// ---------------------------------------------------------------------------
// Report loading
// ---------------------------------------------------------------------------
function loadReports(): GisReport[] {
  const files = readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith('gis-') && f.endsWith('.json'))
    .sort();

  return files.map(f => {
    const content = readFileSync(join(REPORTS_DIR, f), 'utf-8');
    return JSON.parse(content) as GisReport;
  });
}

function median(values: number[]): number {
  if (values.length === 0) return Infinity;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Decision Matrix (per-query PASS/FAIL across tiers)
// ---------------------------------------------------------------------------
function generateDecisionMatrix(reports: GisReport[]): string {
  // Filter single-mode, config B reports
  const singleB = reports.filter(r => r.mode === 'single' && r.indexConfig === 'B');
  const tiers = ['S', 'M', 'L', 'XL'];
  const queryNames = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];

  const thresholds: Record<string, number> = {
    G1: 50, G2: 100, G3: 200, G4: 30,
    G5: 100, G6: 100, G7: 200, G8: 100,
    G9: 100, G10: 50, G11: 200, G12: 500,
  };

  let md = `## 1. Decision Matrix (Config B: 2dsphere, Single-user)\n\n`;
  md += `| Query | Threshold | ${tiers.join(' | ')} |\n`;
  md += `|-------|-----------|${tiers.map(() => '--------').join('|')}|\n`;

  for (const qName of queryNames) {
    const cells = tiers.map(tier => {
      const tierReports = singleB.filter(r => r.tier === tier);
      if (tierReports.length === 0) return '-';
      const p95Values = tierReports.map(r => r.results.find(q => q.name === qName)?.p95 ?? Infinity);
      const p95 = median(p95Values);
      if (p95 === 0 && tierReports[0]?.results.find(q => q.name === qName)?.samples === 0) return 'SKIP';
      const threshold = thresholds[qName];
      const pass = p95 <= threshold;
      return `${pass ? 'PASS' : '**FAIL**'} ${p95.toFixed(1)}ms`;
    });
    md += `| ${qName} | ${thresholds[qName]}ms | ${cells.join(' | ')} |\n`;
  }

  return md;
}

// ---------------------------------------------------------------------------
// Index Configuration Comparison
// ---------------------------------------------------------------------------
function generateIndexComparison(reports: GisReport[]): string {
  // Filter single-mode reports, prefer L tier, fallback to largest available
  const singleReports = reports.filter(r => r.mode === 'single');
  const configs = ['A', 'B', 'C'];
  const queryNames = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];

  // Find the largest tier with all configs
  const tiers = ['XL', 'L', 'M', 'S'];
  let useTier = 'S';
  for (const t of tiers) {
    const hasAll = configs.every(c => singleReports.some(r => r.tier === t && r.indexConfig === c));
    if (hasAll) { useTier = t; break; }
  }

  let md = `## 2. Index Configuration Comparison (Tier ${useTier}, Single-user)\n\n`;
  md += `| Query | No Index (A) | 2dsphere (B) | Compound (C) |\n`;
  md += `|-------|-------------|-------------|-------------|\n`;

  for (const qName of queryNames) {
    const cells = configs.map(config => {
      const rep = singleReports.find(r => r.tier === useTier && r.indexConfig === config);
      if (!rep) return '-';
      const q = rep.results.find(r => r.name === qName);
      if (!q || q.samples === 0) return 'SKIP';
      return `${q.p95.toFixed(1)}ms`;
    });
    md += `| ${qName} | ${cells.join(' | ')} |\n`;
  }

  return md;
}

// ---------------------------------------------------------------------------
// Concurrency Results
// ---------------------------------------------------------------------------
function generateConcurrencyResults(reports: GisReport[]): string {
  const concurrentReports = reports.filter(r => r.mode === 'concurrent');
  const mixedReports = reports.filter(r => r.mode === 'mixed');

  if (concurrentReports.length === 0 && mixedReports.length === 0) {
    return '## 3. Concurrency Results\n\nNo concurrency test data available.\n';
  }

  let md = `## 3. Concurrency Results\n\n`;
  md += `| Mode | Tier | G1 p95 | G5 p95 | G9 p95 |\n`;
  md += `|------|------|--------|--------|--------|\n`;

  for (const r of concurrentReports) {
    const g1 = r.results.find(q => q.name === 'G1')?.p95;
    const g5 = r.results.find(q => q.name === 'G5')?.p95;
    const g9 = r.results.find(q => q.name === 'G9')?.p95;
    const modeLabel = `Concurrent (${r.concurrency ?? '?'})`;
    md += `| ${modeLabel} | ${r.tier} | ${g1?.toFixed(1) ?? '-'}ms | ${g5?.toFixed(1) ?? '-'}ms | ${g9?.toFixed(1) ?? '-'}ms |\n`;
  }

  for (const r of mixedReports) {
    const g1 = r.results.find(q => q.name === 'G1')?.p95;
    const g5 = r.results.find(q => q.name === 'G5')?.p95;
    const g9 = r.results.find(q => q.name === 'G9')?.p95;
    const write = r.results.find(q => q.name === 'WRITE')?.p95;
    md += `| Mixed (R+W) | ${r.tier} | ${g1?.toFixed(1) ?? '-'}ms | ${g5?.toFixed(1) ?? '-'}ms | ${g9?.toFixed(1) ?? '-'}ms |`;
    if (write) md += ` Write p95: ${write.toFixed(1)}ms`;
    md += '\n';
  }

  return md;
}

// ---------------------------------------------------------------------------
// PostGIS vs MongoDB Comparison
// ---------------------------------------------------------------------------
function generatePgComparison(reports: GisReport[]): string {
  // Find reports with pgComparison data
  const withPg = reports.filter(r => r.pgComparison && r.pgComparison.length > 0);
  if (withPg.length === 0) {
    return '## 4. PostGIS vs MongoDB\n\nNo PostGIS comparison data available.\n';
  }

  const pairs = [
    { mongo: 'G1', pg: "G1'", label: 'Proximity 500m' },
    { mongo: 'G9', pg: "G9'", label: 'Polygon intersection' },
    { mongo: 'G11', pg: "G11'", label: 'Buffer + intersect' },
  ];

  let md = `## 4. PostGIS vs MongoDB (Config B)\n\n`;
  md += `| Query | MongoDB p95 | PostGIS p95 | Winner | Ratio |\n`;
  md += `|-------|------------|------------|--------|-------|\n`;

  for (const pair of pairs) {
    const mongoP95s = withPg.map(r => r.results.find(q => q.name === pair.mongo)?.p95 ?? Infinity);
    const pgP95s = withPg.map(r => r.pgComparison!.find(q => q.name === pair.pg)?.p95 ?? Infinity);

    const mongoP95 = median(mongoP95s);
    const pgP95 = median(pgP95s);

    let winner: string;
    let ratio: string;
    if (Math.abs(mongoP95 - pgP95) < 0.5) {
      winner = 'Tie';
      ratio = 'within 0.5ms';
    } else if (pgP95 < mongoP95) {
      winner = 'PG';
      ratio = `PG ${(mongoP95 / pgP95).toFixed(1)}x faster`;
    } else {
      winner = 'Mongo';
      ratio = `Mongo ${(pgP95 / mongoP95).toFixed(1)}x faster`;
    }

    md += `| ${pair.label} (${pair.mongo}/${pair.pg}) | ${mongoP95.toFixed(1)}ms | ${pgP95.toFixed(1)}ms | ${winner} | ${ratio} |\n`;
  }

  return md;
}

// ---------------------------------------------------------------------------
// Go/No-Go Decision
// ---------------------------------------------------------------------------
function generateDecision(reports: GisReport[]): string {
  const thresholds: Record<string, number> = {
    G1: 50, G2: 100, G3: 200, G4: 30,
    G5: 100, G6: 100, G7: 200, G8: 100,
    G9: 100, G10: 50, G11: 200, G12: 500,
  };

  const singleB = reports.filter(r => r.mode === 'single' && r.indexConfig === 'B');

  // Check M tier
  const mReports = singleB.filter(r => r.tier === 'M');
  const mFails = new Set<string>();
  for (const r of mReports) {
    for (const q of r.results) {
      if (q.samples > 0 && q.threshold != null && !q.pass) mFails.add(q.name);
    }
  }

  // Check L tier
  const lReports = singleB.filter(r => r.tier === 'L');
  const lFails = new Set<string>();
  for (const r of lReports) {
    for (const q of r.results) {
      if (q.samples > 0 && q.threshold != null && !q.pass) lFails.add(q.name);
    }
  }

  let md = `## 5. Go/No-Go Decision\n\n`;

  md += `### Decision Matrix Rules\n\n`;
  md += `| Condition | Action |\n`;
  md += `|-----------|--------|\n`;
  md += `| L all PASS | Maintain MongoDB, GIS not split |\n`;
  md += `| L 1 FAIL | Optimize indexes/queries, retest |\n`;
  md += `| L >= 2 FAIL | Trigger Condition C: introduce PostGIS |\n`;
  md += `| M FAIL | Immediate PostGIS introduction |\n\n`;

  if (mFails.size > 0) {
    md += `### Result: FAIL at M tier\n\n`;
    md += `MongoDB fails at M-tier (10K assets): ${[...mFails].join(', ')}\n\n`;
    md += `**Recommendation: Immediate PostGIS introduction.** MongoDB spatial capabilities are insufficient even at single-ward scale.\n`;
  } else if (lReports.length === 0) {
    md += `### Result: Pending L-tier data\n\n`;
    md += `M-tier results all PASS. L-tier benchmarks not yet available.\n`;
    md += `Run: \`./poc-mongo/scripts/run-gis-benchmark.sh --tier L\` to complete the evaluation.\n`;
  } else if (lFails.size === 0) {
    md += `### Result: PASS\n\n`;
    md += `All queries PASS at L-tier (50K assets).\n\n`;
    md += `**Recommendation: Maintain MongoDB for GIS. No need to introduce PostGIS for spatial queries.**\n`;
  } else if (lFails.size === 1) {
    md += `### Result: MARGINAL (1 failure)\n\n`;
    md += `L-tier failure: ${[...lFails].join(', ')}\n\n`;
    md += `**Recommendation: Optimize indexes/queries for the failing query and retest.**\n`;
    md += `Consider compound indexes or query restructuring before escalating to PostGIS.\n`;
  } else {
    md += `### Result: FAIL at L tier (${lFails.size} failures)\n\n`;
    md += `L-tier failures: ${[...lFails].join(', ')}\n\n`;
    md += `**Recommendation: Trigger Condition C — introduce dedicated PostGIS instance for spatial queries.**\n`;
    md += `MongoDB 2dsphere indexes are insufficient for city-wide spatial workloads.\n`;
  }

  return md;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('=== GIS Benchmark Comparison Report ===\n');

  const reports = loadReports();
  console.log(`  Loaded ${reports.length} GIS reports from ${REPORTS_DIR}`);

  if (reports.length === 0) {
    console.error('\nNo GIS reports found! Run gis-runner.ts first.');
    process.exit(1);
  }

  // Summary
  const tiers = [...new Set(reports.map(r => r.tier))].sort();
  const configs = [...new Set(reports.map(r => r.indexConfig))].sort();
  const modes = [...new Set(reports.map(r => r.mode))];
  console.log(`  Tiers: ${tiers.join(', ')}`);
  console.log(`  Configs: ${configs.join(', ')}`);
  console.log(`  Modes: ${modes.join(', ')}`);

  // Generate markdown
  let md = `# GIS Spatial Benchmark Report\n\n`;
  md += `> Generated: ${new Date().toISOString()}\n`;
  md += `> Reports: ${reports.length} from ${REPORTS_DIR}\n`;
  md += `> Tiers: ${tiers.join(', ')} | Configs: ${configs.join(', ')} | Modes: ${modes.join(', ')}\n\n`;

  md += generateDecisionMatrix(reports);
  md += '\n';
  md += generateIndexComparison(reports);
  md += '\n';
  md += generateConcurrencyResults(reports);
  md += '\n';
  md += generatePgComparison(reports);
  md += '\n';
  md += generateDecision(reports);

  // Write output
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, md);
  console.log(`\nReport saved to: ${OUTPUT}`);
}

main();
