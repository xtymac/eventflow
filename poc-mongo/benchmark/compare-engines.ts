/**
 * PG vs MongoDB comparison report generator.
 *
 * Reads benchmark JSON reports from both engines, calculates median p95
 * across multiple runs, and produces a unified comparison markdown report.
 *
 * Usage:
 *   npx tsx poc-mongo/benchmark/compare-engines.ts
 *   npx tsx poc-mongo/benchmark/compare-engines.ts --pg-dir poc/reports --mongo-dir poc/reports
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const args = process.argv.slice(2);
function getArg(name: string, defaultVal: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const REPORTS_DIR = getArg('reports-dir', 'poc/reports');
const OUTPUT = getArg('output', 'poc/reports/MONGO-VS-POSTGRES.md');
const TIER = getArg('tier', '50x');

interface BenchmarkResult {
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

interface BenchmarkReport {
  env: string;
  tier: string;
  timestamp: string;
  summary: {
    totalQueries: number;
    passed: number;
    failed: number;
    skipped: number;
    verdict: string;
  };
  results: BenchmarkResult[];
}

function loadReports(pattern: string): BenchmarkReport[] {
  const files = readdirSync(REPORTS_DIR)
    .filter(f => f.includes(pattern) && f.endsWith('.json'))
    .sort();

  return files.map(f => {
    const content = readFileSync(join(REPORTS_DIR, f), 'utf-8');
    return JSON.parse(content) as BenchmarkReport;
  });
}

function median(values: number[]): number {
  if (values.length === 0) return Infinity;  // No data = worst possible
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface QueryComparison {
  name: string;
  label: string;
  threshold: number | null;
  pgP95: number;
  pgP99: number;
  pgPass: boolean | null;
  mongoP95: number;
  mongoP99: number;
  mongoPass: boolean | null;
  winner: 'PG' | 'Mongo' | 'Tie';
  ratio: string;  // e.g., "PG 2.3x faster"
}

function compareQueries(pgReports: BenchmarkReport[], mongoReports: BenchmarkReport[]): QueryComparison[] {
  // Get all query names from the first PG report
  const pgFirst = pgReports[0];
  if (!pgFirst) return [];

  return pgFirst.results.map(pgResult => {
    const name = pgResult.name;

    // Collect p95 and p99 values across all runs
    const pgP95s = pgReports.map(r => r.results.find(q => q.name === name)?.p95 ?? Infinity);
    const pgP99s = pgReports.map(r => r.results.find(q => q.name === name)?.p99 ?? Infinity);
    const mongoP95s = mongoReports.map(r => r.results.find(q => q.name === name)?.p95 ?? Infinity);
    const mongoP99s = mongoReports.map(r => r.results.find(q => q.name === name)?.p99 ?? Infinity);

    const pgP95 = median(pgP95s);
    const pgP99 = median(pgP99s);
    const mongoP95 = median(mongoP95s);
    const mongoP99 = median(mongoP99s);

    const threshold = pgResult.threshold;
    const pgPass = threshold != null ? pgP95 <= threshold : null;
    const mongoPass = threshold != null ? mongoP95 <= threshold : null;

    // Winner determination
    let winner: 'PG' | 'Mongo' | 'Tie';
    let ratio: string;

    if (pgPass !== null && mongoPass !== null) {
      if (pgPass && !mongoPass) {
        winner = 'PG';
        ratio = `Mongo FAIL (${mongoP95.toFixed(1)}ms > ${threshold}ms)`;
      } else if (!pgPass && mongoPass) {
        winner = 'Mongo';
        ratio = `PG FAIL (${pgP95.toFixed(1)}ms > ${threshold}ms)`;
      } else {
        // Both pass or both fail — compare p95
        if (Math.abs(pgP95 - mongoP95) < 0.5) {
          winner = 'Tie';
          ratio = 'within 0.5ms';
        } else if (pgP95 < mongoP95) {
          winner = 'PG';
          ratio = `PG ${(mongoP95 / pgP95).toFixed(1)}x faster`;
        } else {
          winner = 'Mongo';
          ratio = `Mongo ${(pgP95 / mongoP95).toFixed(1)}x faster`;
        }
      }
    } else {
      if (pgP95 < mongoP95) { winner = 'PG'; } else if (mongoP95 < pgP95) { winner = 'Mongo'; } else { winner = 'Tie'; }
      ratio = `PG=${pgP95.toFixed(1)}ms, Mongo=${mongoP95.toFixed(1)}ms`;
    }

    return {
      name,
      label: pgResult.label,
      threshold,
      pgP95, pgP99, pgPass,
      mongoP95, mongoP99, mongoPass,
      winner, ratio,
    };
  });
}

function generateMarkdown(
  comparisons: QueryComparison[],
  pgReports: BenchmarkReport[],
  mongoReports: BenchmarkReport[],
): string {
  const pgWins = comparisons.filter(c => c.winner === 'PG').length;
  const mongoWins = comparisons.filter(c => c.winner === 'Mongo').length;
  const ties = comparisons.filter(c => c.winner === 'Tie').length;

  const pgVerdict = pgReports.length > 0 ? pgReports[0].summary.verdict : 'N/A';
  const mongoVerdict = mongoReports.length > 0 ? mongoReports[0].summary.verdict : 'N/A';

  const overallWinner = pgWins > mongoWins ? 'PostgreSQL' :
    mongoWins > pgWins ? 'MongoDB' : 'Tie';

  let md = `# MongoDB vs PostgreSQL Comparison Report

> Generated: ${new Date().toISOString()}
> Data tier: ${TIER}
> PG runs: ${pgReports.length}, Mongo runs: ${mongoReports.length}

## Overall Verdict

| Metric | PostgreSQL | MongoDB |
|--------|-----------|---------|
| Threshold compliance | ${pgVerdict} | ${mongoVerdict} |
| Queries won | ${pgWins} | ${mongoWins} |
| Ties | ${ties} | ${ties} |
| **Recommended** | ${overallWinner === 'PostgreSQL' ? '**Winner**' : ''} | ${overallWinner === 'MongoDB' ? '**Winner**' : ''} |

## Per-Query Comparison (median p95 across ${Math.max(pgReports.length, mongoReports.length)} runs)

| Query | Description | Threshold | PG p95 | Mongo p95 | Winner | Notes |
|-------|-------------|-----------|--------|-----------|--------|-------|
`;

  for (const c of comparisons) {
    const thStr = c.threshold != null ? `${c.threshold}ms` : '-';
    const pgStr = `${c.pgP95.toFixed(1)}ms ${c.pgPass === false ? 'FAIL' : ''}`;
    const mongoStr = `${c.mongoP95.toFixed(1)}ms ${c.mongoPass === false ? 'FAIL' : ''}`;
    const winnerEmoji = c.winner === 'PG' ? 'PG' : c.winner === 'Mongo' ? 'Mongo' : 'Tie';
    md += `| ${c.name} | ${c.label} | ${thStr} | ${pgStr} | ${mongoStr} | ${winnerEmoji} | ${c.ratio} |\n`;
  }

  // Category analysis
  md += `
## Category Analysis

### Simple Reads (Q1, Q2)
`;
  const simpleReads = comparisons.filter(c => ['Q1', 'Q2'].includes(c.name));
  for (const c of simpleReads) {
    md += `- **${c.name}** (${c.label}): PG=${c.pgP95.toFixed(1)}ms, Mongo=${c.mongoP95.toFixed(1)}ms → **${c.winner}**\n`;
  }

  md += `
### Join-Heavy Reads (Q3-Q5, Q9-Q10)
`;
  const joinReads = comparisons.filter(c => ['Q3', 'Q4', 'Q5', 'Q9', 'Q10'].includes(c.name));
  for (const c of joinReads) {
    md += `- **${c.name}** (${c.label}): PG=${c.pgP95.toFixed(1)}ms, Mongo=${c.mongoP95.toFixed(1)}ms → **${c.winner}**\n`;
  }

  md += `
### Spatial Queries (Q6, Q12)
`;
  const spatialReads = comparisons.filter(c => ['Q6', 'Q12'].includes(c.name));
  for (const c of spatialReads) {
    md += `- **${c.name}** (${c.label}): PG=${c.pgP95.toFixed(1)}ms, Mongo=${c.mongoP95.toFixed(1)}ms → **${c.winner}**\n`;
  }

  md += `
### Polymorphic/Audit (Q7, Q8, Q11)
`;
  const auditReads = comparisons.filter(c => ['Q7', 'Q8', 'Q11'].includes(c.name));
  for (const c of auditReads) {
    md += `- **${c.name}** (${c.label}): PG=${c.pgP95.toFixed(1)}ms, Mongo=${c.mongoP95.toFixed(1)}ms → **${c.winner}**\n`;
  }

  md += `
## Recommendation

**${overallWinner}** wins ${overallWinner === 'PostgreSQL' ? pgWins : mongoWins}/${comparisons.length} queries at the ${TIER} data tier.

`;

  if (overallWinner === 'PostgreSQL') {
    md += `PostgreSQL's relational JOINs outperform MongoDB's \\$lookup aggregation pipelines for the normalized data model used by EventFlow. The PostGIS GIST indexes also provide competitive spatial query performance.\n`;
  } else if (overallWinner === 'MongoDB') {
    md += `MongoDB's aggregation pipeline handles the query patterns in EventFlow more efficiently than PostgreSQL's JOIN-based approach at this data scale.\n`;
  } else {
    md += `Both engines perform comparably at the ${TIER} data tier. Consider other factors (operational complexity, team expertise, existing infrastructure) for the final decision.\n`;
  }

  return md;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('=== PG vs MongoDB Comparison Report ===\n');

  // Load PG reports (files matching benchmark-local-50x*.json but NOT mongo)
  const pgReports = loadReports(`benchmark-local-${TIER}`)
    .filter(r => !r.env.includes('mongo'));
  console.log(`  PG reports: ${pgReports.length}`);

  // Load Mongo reports (files matching benchmark-mongo-50x*.json)
  const mongoReports = loadReports(`benchmark-mongo-${TIER}`);
  console.log(`  Mongo reports: ${mongoReports.length}`);

  if (pgReports.length === 0 && mongoReports.length === 0) {
    console.error('\nNo reports found! Run benchmarks first.');
    process.exit(1);
  }
  if (pgReports.length === 0) {
    console.error('\nNo PG reports found! Run PG benchmarks first.');
    process.exit(1);
  }
  if (mongoReports.length === 0) {
    console.error('\nNo Mongo reports found! Run Mongo benchmarks first.');
    process.exit(1);
  }

  // Compare
  const comparisons = compareQueries(pgReports, mongoReports);

  // Generate markdown
  const markdown = generateMarkdown(comparisons, pgReports, mongoReports);

  // Write output
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, markdown);
  console.log(`\nReport saved to: ${OUTPUT}`);

  // Print summary
  const pgWins = comparisons.filter(c => c.winner === 'PG').length;
  const mongoWins = comparisons.filter(c => c.winner === 'Mongo').length;
  console.log(`\nPG wins: ${pgWins}, Mongo wins: ${mongoWins}, Ties: ${comparisons.length - pgWins - mongoWins}`);
}

main();
