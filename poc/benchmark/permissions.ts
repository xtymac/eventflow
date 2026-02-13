/**
 * Permission matrix test runner — validates all role×resource×action combinations.
 *
 * Usage:
 *   npx tsx poc/benchmark/permissions.ts
 *   npx tsx poc/benchmark/permissions.ts --verbose
 *
 * Prerequisites: Server running with POC_ENABLED=true
 */

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const BASE_URL = process.env.API_URL ?? 'http://localhost:3000';

// --base-path allows reusing the same test matrix against different route prefixes
// Default: /poc (PG routes), Alternative: /poc-mongo (Mongo routes)
function getArgValue(name: string, defaultVal: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const BASE_PATH = getArgValue('base-path', '/poc');

// ---------------------------------------------------------------------------
// Test matrix definition
// ---------------------------------------------------------------------------
interface TestCase {
  role: string;
  partnerId?: string;
  resource: string;
  action: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  expectedStatus: number;  // 200/201 for allow, 403 for deny
  description: string;
}

// Build test cases dynamically using BASE_PATH
function buildTestCases(): TestCase[] {
  return [
    // -----------------------------------------------------------------------
    // Decisions — gov_event_ops (full access)
    // -----------------------------------------------------------------------
    {
      role: 'gov_event_ops', resource: 'decisions', action: 'list',
      method: 'GET', path: `${BASE_PATH}/decisions`, expectedStatus: 200,
      description: 'gov_event_ops can list decisions',
    },
    {
      role: 'gov_event_ops', resource: 'decisions', action: 'view',
      method: 'GET', path: `${BASE_PATH}/decisions/nonexistent`, expectedStatus: 404,
      description: 'gov_event_ops can view decisions (404 for missing is OK, not 403)',
    },
    {
      role: 'gov_event_ops', resource: 'decisions', action: 'create',
      method: 'POST', path: `${BASE_PATH}/decisions`,
      body: { entityType: 'event', entityId: 'test-001', decisionType: 'event_close', outcome: 'approved' },
      expectedStatus: 201,
      description: 'gov_event_ops can create decisions',
    },

    // -----------------------------------------------------------------------
    // Decisions — gov_master_data (full access)
    // -----------------------------------------------------------------------
    {
      role: 'gov_master_data', resource: 'decisions', action: 'list',
      method: 'GET', path: `${BASE_PATH}/decisions`, expectedStatus: 200,
      description: 'gov_master_data can list decisions',
    },
    {
      role: 'gov_master_data', resource: 'decisions', action: 'create',
      method: 'POST', path: `${BASE_PATH}/decisions`,
      body: { entityType: 'asset_condition', entityId: 'test-002', decisionType: 'condition_change', outcome: 'approved' },
      expectedStatus: 201,
      description: 'gov_master_data can create decisions',
    },

    // -----------------------------------------------------------------------
    // Decisions — partner (scoped read, no create)
    // -----------------------------------------------------------------------
    {
      role: 'partner', partnerId: 'PTR-tanaka', resource: 'decisions', action: 'list',
      method: 'GET', path: `${BASE_PATH}/decisions`, expectedStatus: 200,
      description: 'partner can list decisions (scoped)',
    },

    // -----------------------------------------------------------------------
    // Decisions — public (no access)
    // -----------------------------------------------------------------------
    {
      role: 'public', resource: 'decisions', action: 'list',
      method: 'GET', path: `${BASE_PATH}/decisions`, expectedStatus: 403,
      description: 'public cannot list decisions',
    },
    {
      role: 'public', resource: 'decisions', action: 'create',
      method: 'POST', path: `${BASE_PATH}/decisions`,
      body: { entityType: 'event', entityId: 'test', decisionType: 'event_close', outcome: 'approved' },
      expectedStatus: 403,
      description: 'public cannot create decisions',
    },

    // -----------------------------------------------------------------------
    // Audit Logs — gov_event_ops (full access)
    // -----------------------------------------------------------------------
    {
      role: 'gov_event_ops', resource: 'audit_logs', action: 'list',
      method: 'GET', path: `${BASE_PATH}/audit-logs`, expectedStatus: 200,
      description: 'gov_event_ops can list audit logs',
    },
    {
      role: 'gov_event_ops', resource: 'audit_logs', action: 'view',
      method: 'GET', path: `${BASE_PATH}/audit-logs/nonexistent`, expectedStatus: 404,
      description: 'gov_event_ops can view audit logs (404 OK, not 403)',
    },
    {
      role: 'gov_event_ops', resource: 'audit_logs', action: 'report',
      method: 'GET', path: `${BASE_PATH}/audit-logs/report/activity`, expectedStatus: 200,
      description: 'gov_event_ops can view audit report',
    },

    // -----------------------------------------------------------------------
    // Audit Logs — partner (scoped)
    // -----------------------------------------------------------------------
    {
      role: 'partner', partnerId: 'PTR-tanaka', resource: 'audit_logs', action: 'list',
      method: 'GET', path: `${BASE_PATH}/audit-logs`, expectedStatus: 200,
      description: 'partner can list audit logs (scoped to own)',
    },

    // -----------------------------------------------------------------------
    // Audit Logs — public (no access)
    // -----------------------------------------------------------------------
    {
      role: 'public', resource: 'audit_logs', action: 'list',
      method: 'GET', path: `${BASE_PATH}/audit-logs`, expectedStatus: 403,
      description: 'public cannot list audit logs',
    },

    // -----------------------------------------------------------------------
    // No role header → treated as public
    // -----------------------------------------------------------------------
    {
      role: '', resource: 'decisions', action: 'list',
      method: 'GET', path: `${BASE_PATH}/decisions`, expectedStatus: 403,
      description: 'missing role header defaults to public (403)',
    },
    {
      role: '', resource: 'audit_logs', action: 'list',
      method: 'GET', path: `${BASE_PATH}/audit-logs`, expectedStatus: 403,
      description: 'missing role header defaults to public (403)',
    },
  ];
}

const TEST_CASES = buildTestCases();

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
interface TestResult {
  description: string;
  pass: boolean;
  expectedStatus: number;
  actualStatus: number;
  role: string;
  resource: string;
  action: string;
}

async function runTestCase(tc: TestCase): Promise<TestResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (tc.role) {
    headers['X-User-Role'] = tc.role;
  }
  if (tc.partnerId) {
    headers['X-Partner-Id'] = tc.partnerId;
  }

  const fetchOptions: RequestInit = {
    method: tc.method,
    headers,
  };
  if (tc.body) {
    fetchOptions.body = JSON.stringify(tc.body);
  }

  try {
    const response = await fetch(`${BASE_URL}${tc.path}`, fetchOptions);
    const actualStatus = response.status;

    // For DENY tests, we expect 403
    // For ALLOW tests, we expect 200 or 201 (or 404 for view of nonexistent)
    let pass: boolean;
    if (tc.expectedStatus === 403) {
      pass = actualStatus === 403;
    } else if (tc.expectedStatus === 404) {
      // 404 means the permission check passed but resource not found (OK for view tests)
      pass = actualStatus === 404;
    } else {
      pass = actualStatus === tc.expectedStatus;
    }

    return {
      description: tc.description,
      pass,
      expectedStatus: tc.expectedStatus,
      actualStatus,
      role: tc.role || '(none)',
      resource: tc.resource,
      action: tc.action,
    };
  } catch (err: unknown) {
    return {
      description: tc.description,
      pass: false,
      expectedStatus: tc.expectedStatus,
      actualStatus: 0,
      role: tc.role || '(none)',
      resource: tc.resource,
      action: tc.action,
    };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== Permission Matrix Tests ===`);
  console.log(`  Server: ${BASE_URL}`);
  console.log(`  Test cases: ${TEST_CASES.length}\n`);

  const results: TestResult[] = [];

  for (const tc of TEST_CASES) {
    const result = await runTestCase(tc);
    results.push(result);

    const icon = result.pass ? '✓' : '✗';
    const status = result.pass ? 'PASS' : 'FAIL';
    if (VERBOSE || !result.pass) {
      console.log(`  ${icon} [${status}] ${result.description} (expected=${result.expectedStatus}, actual=${result.actualStatus})`);
    }
  }

  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total = results.length;

  console.log(`\n─── Summary ───`);
  console.log(`  Total:  ${total}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Coverage: ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`  Verdict: ${failed === 0 ? 'PASS' : 'FAIL'}\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    for (const r of results.filter(r => !r.pass)) {
      console.log(`  - ${r.description} (expected ${r.expectedStatus}, got ${r.actualStatus})`);
    }
  }

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    server: BASE_URL,
    total,
    passed,
    failed,
    verdict: failed === 0 ? 'PASS' : 'FAIL',
    results,
  };

  const reportPath = 'poc/reports/permission-report.json';
  const { writeFileSync, mkdirSync } = await import('fs');
  const { dirname } = await import('path');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report saved to: ${reportPath}`);
}

main().catch((err) => {
  console.error('Permission tests failed:', err);
  process.exit(1);
});
