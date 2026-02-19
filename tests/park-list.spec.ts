import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = 'tests/screenshots';

test.use({ baseURL: 'http://localhost:5173' });

async function loginAndNavigate(page: import('@playwright/test').Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  // If redirected to login, submit the form (empty fields default to admin)
  const loginButton = page.locator('button[type="submit"]:has-text("ログイン")');
  if (await loginButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginButton.click();
    await page.waitForTimeout(500);
    // After login, navigate to the target path
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForTimeout(1000);
}

test.describe('Park List Page', () => {

  test('1 - Page renders with title and table', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');

    // Title should be visible
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Table should have header row
    const headerCells = page.locator('thead th');
    await expect(headerCells.first()).toBeVisible({ timeout: 10_000 });

    // Should have data rows
    const dataRows = page.locator('tbody tr');
    const rowCount = await dataRows.count();
    console.log(`  → Park list: ${rowCount} rows`);
    expect(rowCount).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-01-overview.png`, fullPage: false });
  });

  test('2 - Filter bar has search and dropdowns', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');

    // Search input
    const searchInput = page.locator('input[placeholder*="No"]');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // Three filter dropdowns (区, 種別, 取得方法)
    const selectTriggers = page.locator('button[role="combobox"]');
    const selectCount = await selectTriggers.count();
    console.log(`  → Select dropdowns: ${selectCount}`);
    expect(selectCount).toBeGreaterThanOrEqual(3);

    // Icon buttons (gear, sliders, X)
    const iconButtons = page.locator('button').filter({ has: page.locator('svg') });
    const iconCount = await iconButtons.count();
    console.log(`  → Icon buttons: ${iconCount}`);
    expect(iconCount).toBeGreaterThanOrEqual(3);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-02-filters.png`, fullPage: false });
  });

  test('3 - Search filters table rows', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    const initialRows = await page.locator('tbody tr').count();

    // Type a search term
    const searchInput = page.locator('input[placeholder*="No"]');
    await searchInput.fill('鶴舞');
    await page.waitForTimeout(500);

    const filteredRows = await page.locator('tbody tr').count();
    console.log(`  → Before filter: ${initialRows}, after: ${filteredRows}`);
    expect(filteredRows).toBeLessThan(initialRows);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-03-search.png`, fullPage: false });
  });

  test('4 - Pagination renders with numbered pages', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Pagination should show 前へ and 次へ buttons
    const prevButton = page.getByRole('button', { name: '前へ' });
    const nextButton = page.getByRole('button', { name: '次へ' });
    await expect(prevButton).toBeVisible({ timeout: 10_000 });
    await expect(nextButton).toBeVisible({ timeout: 10_000 });

    // Should have numbered page buttons
    const pageOneButton = page.getByRole('button', { name: '1', exact: true });
    await expect(pageOneButton).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-04-pagination.png`, fullPage: false });
  });

  test('5 - Row height and spacing match design', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Check row height is ~40px (h-10)
    const firstDataRow = page.locator('tbody tr').first();
    const rowBox = await firstDataRow.boundingBox();
    expect(rowBox).not.toBeNull();
    console.log(`  → Row height: ${rowBox!.height}px`);
    expect(rowBox!.height).toBeGreaterThanOrEqual(36);
    expect(rowBox!.height).toBeLessThanOrEqual(44);

    // Table should NOT have a rounded border card wrapper
    // The table's parent should not have rounded-2xl or visible border
    const tableEl = page.locator('table').first();
    const tableParent = tableEl.locator('..');
    const parentClasses = await tableParent.getAttribute('class');
    console.log(`  → Table parent classes: ${parentClasses}`);
    // Should not contain rounded-2xl (no card wrapper)
    expect(parentClasses).not.toContain('rounded-2xl');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-05-layout.png`, fullPage: false });
  });

  test('6 - Click row opens preview panel', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Preview panel should not be visible initially
    const panel = page.locator('[data-testid="park-preview-panel"]');
    await expect(panel).not.toBeVisible();

    // Click first data row (東山公園)
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();
    await page.waitForTimeout(500);

    // URL should stay on /assets/parks (with ?selected= param)
    expect(page.url()).toMatch(/\/assets\/parks\/?(\?|$)/);

    // Preview panel should now be visible with tabs
    await expect(panel).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('基本情報')).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-06-preview-panel.png`, fullPage: false });
  });

  test('7 - Preview panel shows correct park data', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Click 名城公園 row (second row)
    const secondRow = page.locator('tbody tr').nth(1);
    await secondRow.click();
    await page.waitForTimeout(500);

    const panel = page.locator('[data-testid="park-preview-panel"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Should show the park name in the panel
    await expect(panel.getByText('名城公園')).toBeVisible();
    // Should show the ward (exact match to avoid matching address containing 北区)
    await expect(panel.getByText('北区', { exact: true })).toBeVisible();
    // Should show section headers
    await expect(panel.getByText('計画・規模・履歴')).toBeVisible();
    await expect(panel.getByText('施設・備考')).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-07-preview-data.png`, fullPage: false });
  });

  test('8 - 公園詳細 button navigates to detail page', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Click first row to open panel
    await page.locator('tbody tr').first().click();
    await page.waitForTimeout(500);

    // Click the 公園詳細 button in the panel
    const detailButton = page.locator('[data-testid="park-detail-link"]');
    await expect(detailButton).toBeVisible({ timeout: 5_000 });
    await detailButton.click();
    await page.waitForTimeout(1500);

    // Should navigate to park detail page
    const url = page.url();
    console.log(`  → Navigated to: ${url}`);
    expect(url).toContain('/assets/parks/');
    expect(url).not.toMatch(/\/assets\/parks\/?$/);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-08-detail-nav.png`, fullPage: false });
  });

  test('9 - Close button closes the preview panel', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Click first row to open panel
    await page.locator('tbody tr').first().click();
    await page.waitForTimeout(500);

    const panel = page.locator('[data-testid="park-preview-panel"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Click the close button (X)
    const closeButton = panel.locator('button[aria-label="閉じる"]');
    await closeButton.click();
    await page.waitForTimeout(500);

    // Panel should be hidden
    await expect(panel).not.toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-09-panel-closed.png`, fullPage: false });
  });

  test('10 - CircleArrowRight navigates directly to detail', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Click the CircleArrowRight icon in the first row's actions column
    const firstRowArrow = page.locator('tbody tr').first().locator('svg.lucide-circle-arrow-right');
    await expect(firstRowArrow).toBeVisible({ timeout: 5_000 });
    await firstRowArrow.click();
    await page.waitForTimeout(1500);

    // Should navigate directly to park detail page
    const url = page.url();
    console.log(`  → Navigated to: ${url}`);
    expect(url).toContain('/assets/parks/');
    expect(url).not.toMatch(/\/assets\/parks\/?$/);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-10-arrow-nav.png`, fullPage: false });
  });

  test('11 - Facilities tab shows facility list with headers', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Click 鶴舞公園 row (first row) to open panel
    await page.locator('tbody tr').first().click();
    await page.waitForTimeout(500);

    const panel = page.locator('[data-testid="park-preview-panel"]');
    await expect(panel).toBeVisible({ timeout: 5_000 });

    // Click 施設 tab
    await panel.getByRole('tab', { name: '施設' }).click();
    await page.waitForTimeout(500);

    // Should show column headers
    await expect(panel.getByText('状態')).toBeVisible();
    await expect(panel.getByText('施設ID')).toBeVisible();
    await expect(panel.getByText('施設分類')).toBeVisible();

    // Should show facility rows
    const facilityRows = panel.locator('[data-testid="facility-row"]');
    const count = await facilityRows.count();
    console.log(`  → Facility rows: ${count}`);
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-11-facilities-tab.png`, fullPage: false });
  });

  test('12 - Facilities tab shows status badges and category labels', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Click 鶴舞公園 row (has facilities)
    await page.locator('tbody tr', { hasText: '鶴舞公園' }).click();
    await page.waitForTimeout(500);

    const panel = page.locator('[data-testid="park-preview-panel"]');
    await panel.getByRole('tab', { name: '施設' }).click();
    await page.waitForTimeout(500);

    // Should show at least one status badge (使用中 is the most common)
    await expect(panel.getByText('使用中').first()).toBeVisible();

    // Should show facility names
    const facilityRows = panel.locator('[data-testid="facility-row"]');
    const count = await facilityRows.count();
    console.log(`  → Facility rows with statuses: ${count}`);
    expect(count).toBeGreaterThan(0);

    // Each row should have a category label and facility ID
    const firstRow = facilityRows.first();
    const rowText = await firstRow.textContent();
    console.log(`  → First row text: ${rowText}`);
    expect(rowText).toBeTruthy();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-12-status-badges.png`, fullPage: false });
  });

  test('13 - Facility arrow navigates to facility detail', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Click first row to open panel
    await page.locator('tbody tr').first().click();
    await page.waitForTimeout(500);

    const panel = page.locator('[data-testid="park-preview-panel"]');
    await panel.getByRole('tab', { name: '施設' }).click();
    await page.waitForTimeout(500);

    // Click the arrow button on the first facility row
    const firstFacilityArrow = panel.locator('[data-testid="facility-row"]').first().locator('button[aria-label="施設詳細"]');
    await expect(firstFacilityArrow).toBeVisible({ timeout: 5_000 });
    await firstFacilityArrow.click();
    await page.waitForTimeout(1500);

    // Should navigate to facility detail page
    const url = page.url();
    console.log(`  → Navigated to: ${url}`);
    expect(url).toContain('/assets/facilities/');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-13-facility-nav.png`, fullPage: false });
  });
});
