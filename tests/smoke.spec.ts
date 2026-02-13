import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = 'tests/screenshots';

// Helper: navigate and wait for the app shell to render (not networkidle — map tiles never stop)
async function loadApp(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Wait for the EventFlow logo which indicates the React app has mounted
  await expect(page.locator('img[alt="EventFlow"]')).toBeVisible({ timeout: 30_000 });
}

test.describe('EventFlow Production Smoke Test', () => {

  test('1 - Page loads successfully', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loadApp(page);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-page-load.png`, fullPage: true });

    // Filter out known non-critical console errors (map tile 404s, favicon, etc.)
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('tile') && !e.includes('404') && !e.includes('favicon') &&
      !e.includes('pbf') && !e.includes('Failed to fetch')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('2 - Events list renders with items', async ({ page }) => {
    await loadApp(page);

    // Wait for event cards to appear
    const eventCards = page.locator('.event-card-hover');
    await expect(eventCards.first()).toBeVisible({ timeout: 15_000 });

    const count = await eventCards.count();
    expect(count).toBeGreaterThan(0);
    console.log(`  → Found ${count} event cards`);

    // Search input should be present
    await expect(page.locator('input[placeholder="Search events..."]')).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-events-list.png`, fullPage: true });
  });

  test('3 - Map canvas renders', async ({ page }) => {
    await loadApp(page);

    // Wait for MapLibre canvas to render
    const canvas = page.locator('main canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    // Canvas should have non-zero dimensions
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);
    console.log(`  → Map canvas: ${box!.width}x${box!.height}px`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-map-canvas.png`, fullPage: true });
  });

  test('4 - Click event opens detail panel', async ({ page }) => {
    await loadApp(page);

    // Wait for events to load
    const eventCards = page.locator('.event-card-hover');
    await expect(eventCards.first()).toBeVisible({ timeout: 15_000 });

    // Click first event
    await eventCards.first().click();

    // Detail panel should appear in aside
    const aside = page.locator('aside');
    await expect(aside).toBeVisible({ timeout: 10_000 });

    // Should contain event-related content
    const asideText = await aside.textContent();
    expect(asideText).toBeTruthy();
    console.log(`  → Detail panel opened, content length: ${asideText!.length} chars`);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-event-detail.png`, fullPage: true });
  });

  test('5 - Switch to Assets tab', async ({ page }) => {
    await loadApp(page);

    // Mantine SegmentedControl: look for the label with "Assets" text
    const assetsLabel = page.getByText('Assets', { exact: true });
    await assetsLabel.click();

    // Wait for asset content to appear - look for asset tab buttons (Japanese names)
    const assetTabs = page.locator('button').filter({ hasText: /公園|街路樹|道路舗装|ポンプ施設/ });
    await expect(assetTabs.first()).toBeVisible({ timeout: 15_000 });

    const tabCount = await assetTabs.count();
    console.log(`  → Found ${tabCount} asset sub-tabs`);
    expect(tabCount).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-assets-tab.png`, fullPage: true });
  });

  test('6 - Click asset opens detail', async ({ page }) => {
    await loadApp(page);

    // Navigate to Assets tab
    await page.getByText('Assets', { exact: true }).click();

    // Wait for asset cards to appear
    const assetCards = page.locator('.asset-card-hover');
    await expect(assetCards.first()).toBeVisible({ timeout: 20_000 });

    const count = await assetCards.count();
    console.log(`  → Found ${count} asset cards`);

    // Click first asset
    await assetCards.first().click();

    // Wait for detail to render
    await page.waitForTimeout(1500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-asset-detail.png`, fullPage: true });
  });
});
