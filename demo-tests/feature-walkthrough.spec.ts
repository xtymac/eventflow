/**
 * EventFlow Feature Walkthrough — Demo Recording
 *
 * Records a paced walkthrough of 6 core features on the production map view:
 *   1. App Shell  → Login (if needed) → map loads
 *   2. Events List → Events tab showing event cards
 *   3. Event Detail → Click event card → right panel
 *   4. Switch to Assets → Click "Assets" tab, show road categories
 *   5. Asset List → Browse roads with filter bar
 *   6. Inspections → Switch to Inspections tab
 *
 * Read-only: all POST/PUT/PATCH/DELETE requests abort + fail the test.
 *
 * Run: npm run demo:record
 * Config: playwright.demo.config.ts  (testDir: ./demo-tests)
 */

import { test, expect } from '@playwright/test';

const PAUSE = {
  SHORT: 3000,
  MEDIUM: 5000,
  LONG: 8000,
  TRANSITION: 2000,
};

test('EventFlow Feature Walkthrough', async ({ page }) => {

  // ── READ-ONLY GUARD ──────────────────────────────────────────────────
  const violations: string[] = [];

  await page.route('**/*', (route, request) => {
    const method = request.method().toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const msg = `${method} ${request.url()}`;
      violations.push(msg);
      return route.abort('failed');
    }
    return route.continue();
  });

  function assertReadOnly() {
    if (violations.length > 0) {
      throw new Error(
        `[READ-ONLY GUARD] Mutating requests detected:\n${violations.join('\n')}`
      );
    }
  }

  // ── STEP 1: APP SHELL ────────────────────────────────────────────────
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Handle both: login page or already-authenticated map view
  const loginSubmit = page.locator('button[type="submit"]');
  const mapCanvas = page.locator('canvas').first();

  await expect(loginSubmit.or(mapCanvas)).toBeVisible({ timeout: 30_000 });

  if (await loginSubmit.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.waitForTimeout(PAUSE.MEDIUM);
    await loginSubmit.click();
    await expect(mapCanvas).toBeVisible({ timeout: 30_000 });
  }

  // Let map tiles load
  await page.waitForTimeout(PAUSE.LONG);
  assertReadOnly();

  // ── STEP 2: EVENTS LIST ──────────────────────────────────────────────
  // Events tab is active by default. Verify event list header.
  await expect(page.getByText(/^Events \(\d+\)$/)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(PAUSE.LONG);
  assertReadOnly();

  // ── STEP 3: EVENT DETAIL ─────────────────────────────────────────────
  // Click a specific event card (dummy data is stable)
  await page.getByText('Tsurumai Park Access Road Widening').click();

  // Wait for event detail panel heading
  await expect(
    page.getByText('Event Details', { exact: true })
  ).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(PAUSE.LONG);
  assertReadOnly();

  // ── STEP 4: SWITCH TO ASSETS ─────────────────────────────────────────
  // Click "Assets" label in SegmentedControl (radio input is hidden)
  await page.getByRole('radiogroup').getByText('Assets').click();
  await page.waitForTimeout(PAUSE.TRANSITION);

  // Wait for asset tabs — production shows "Roads (N)", "Green (N)", "Lights (N)"
  await expect(
    page.getByRole('tab', { name: /Roads/ })
  ).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(PAUSE.LONG);
  assertReadOnly();

  // ── STEP 5: ASSET LIST ───────────────────────────────────────────────
  // Roads tab is active by default with road cards.
  // Verify a named road is visible to confirm data loaded.
  await expect(
    page.getByText('松ヶ枝老松町線', { exact: false }).first()
  ).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(PAUSE.LONG);
  assertReadOnly();

  // ── STEP 6: INSPECTIONS ──────────────────────────────────────────────
  // Switch to Inspections tab to show the third data domain
  await page.getByRole('radiogroup').getByText('Inspections').click();
  await page.waitForTimeout(PAUSE.TRANSITION);

  // Wait for inspections content to appear
  await expect(
    page.getByText(/Inspections/i).first()
  ).toBeVisible({ timeout: 10_000 });

  // Final pause — viewer sees the inspections view
  await page.waitForTimeout(PAUSE.LONG);
  assertReadOnly();
});
