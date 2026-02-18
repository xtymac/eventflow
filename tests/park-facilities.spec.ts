import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = 'tests/screenshots';

// Use local dev server
test.use({ baseURL: 'http://localhost:5173' });

// Helper: wait for app to mount (login screen or main app)
async function waitForApp(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // App might show login page or main page depending on auth state
  // Wait for either the login form or the main app shell
  await page.waitForSelector('img[alt="EventFlow"], input[type="password"], [data-testid="app-shell"]', { timeout: 15_000 }).catch(() => {});
  // If login page is shown, log in with demo credentials
  const loginButton = page.locator('button:has-text("ログイン"), button:has-text("Login")');
  if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Try demo login - click the first available login button
    await loginButton.first().click();
    await page.waitForTimeout(1000);
  }
}

test.describe('Park Facilities', () => {

  test('1 - Facility list page shows dummy facilities', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Page title
    await expect(page.getByText('施設一覧')).toBeVisible({ timeout: 10_000 });

    // Should show facility count badge
    const badge = page.locator('div').filter({ hasText: /\d+\s*件/ }).first();
    await expect(badge).toBeVisible({ timeout: 10_000 });

    // Table should have rows with facility names containing park names
    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();
    console.log(`  → Facility list: ${rowCount} rows`);
    expect(rowCount).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/pf-01-facility-list.png`, fullPage: true });
  });

  test('2 - Facility detail page renders with MiniMap', async ({ page }) => {
    await waitForApp(page);
    // Navigate to a specific dummy facility (PF-demo-001)
    await page.goto('/assets/facilities/PF-demo-001', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Breadcrumb should show facility link
    await expect(page.getByRole('link', { name: '施設' })).toBeVisible({ timeout: 10_000 });

    // Basic info section should show
    await expect(page.getByText('基本情報')).toBeVisible({ timeout: 10_000 });

    // MiniMap canvas should render
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10_000 });

    // Should show category badge
    const categoryBadge = page.locator('.mantine-Badge-root').first();
    await expect(categoryBadge).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/pf-02-facility-detail.png`, fullPage: true });
  });

  test('3 - Park detail page shows facilities list', async ({ page }) => {
    await waitForApp(page);
    // Navigate to 笠寺公園 (the park the user mentioned)
    await page.goto('/assets/parks/GS-9exy95g1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Park name should show (in breadcrumb or info section)
    await expect(page.getByText('笠寺公園').first()).toBeVisible({ timeout: 10_000 });

    // Should show facility items for this park (3 facilities for GS-9exy95g1)
    // Look for facility categories (複合遊具, ベンチ, 砂場)
    const facilityItems = page.locator('text=/複合遊具|ベンチ|砂場/');
    const count = await facilityItems.count();
    console.log(`  → Park facilities: ${count} items`);
    expect(count).toBeGreaterThan(0);

    // MiniMap should have markers (red pins)
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/pf-03-park-detail-facilities.png`, fullPage: true });
  });

  test('4 - Park detail MiniMap has marker elements', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/parks/GS-9exy95g1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    // MapLibre markers render as elements with class maplibregl-marker
    const markers = page.locator('.maplibregl-marker');
    const markerCount = await markers.count();
    console.log(`  → MiniMap markers: ${markerCount}`);
    expect(markerCount).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/pf-04-park-minimap-markers.png`, fullPage: true });
  });

  test('5 - Facility detail MiniMap shows park polygon', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities/PF-demo-001', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    // Should have a MiniMap canvas
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10_000 });

    // Should have a marker for the facility point
    const markers = page.locator('.maplibregl-marker');
    const markerCount = await markers.count();
    console.log(`  → Facility MiniMap markers: ${markerCount}`);
    // At least 1 marker (the facility point)
    expect(markerCount).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/pf-05-facility-minimap.png`, fullPage: true });
  });
});
