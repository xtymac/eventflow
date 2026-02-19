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

  test('6 - Click row navigates to park detail', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');
    await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

    // Click first data row
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();
    await page.waitForTimeout(1500);

    // URL should change to a park detail page
    const url = page.url();
    console.log(`  → Navigated to: ${url}`);
    expect(url).toContain('/assets/parks/');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-list-06-detail-nav.png`, fullPage: false });
  });
});
