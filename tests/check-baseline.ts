import { readFileSync } from 'fs';
import { resolve } from 'path';

interface Baseline {
  totalTests: number;
  browsers: string[];
  totalRuns: number;
  skipped: number;
}

interface ReportSuite {
  specs: { tests: { results: { status: string }[] }[] }[];
  suites?: ReportSuite[];
}

interface Report {
  suites: ReportSuite[];
}

function countResults(suites: ReportSuite[]) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const suite of suites) {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        const lastResult = test.results[test.results.length - 1];
        if (!lastResult) continue;
        if (lastResult.status === 'passed' || lastResult.status === 'expected') passed++;
        else if (lastResult.status === 'skipped') skipped++;
        else failed++;
      }
    }
    if (suite.suites) {
      const nested = countResults(suite.suites);
      passed += nested.passed;
      failed += nested.failed;
      skipped += nested.skipped;
    }
  }

  return { passed, failed, skipped };
}

const baselinePath = resolve(__dirname, 'baseline.json');
const reportPath = resolve(__dirname, 'test-results/report.json');

const baseline: Baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
const report: Report = JSON.parse(readFileSync(reportPath, 'utf-8'));

const { passed, failed, skipped } = countResults(report.suites);
const total = passed + failed + skipped;

const errors: string[] = [];

if (total !== baseline.totalRuns) {
  errors.push(`Total runs: expected ${baseline.totalRuns}, got ${total}`);
}

if (skipped > baseline.skipped) {
  errors.push(`Skipped count increased: baseline ${baseline.skipped}, got ${skipped}`);
}

if (failed > 0) {
  errors.push(`${failed} test(s) failed`);
}

if (errors.length > 0) {
  console.error('❌ Baseline check FAILED:');
  for (const err of errors) console.error(`  - ${err}`);
  console.error(`\n  Summary: ${passed} passed, ${failed} failed, ${skipped} skipped (total ${total})`);
  process.exit(1);
} else {
  console.log(`✅ Baseline check passed: ${passed} passed, ${skipped} skipped (total ${total})`);
}
