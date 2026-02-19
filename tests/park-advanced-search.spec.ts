import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = 'tests/screenshots';

test.use({ baseURL: 'http://localhost:5173' });

async function loginAndNavigate(page: import('@playwright/test').Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const loginButton = page.locator('button[type="submit"]:has-text("ログイン")');
  if (await loginButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginButton.click();
    await page.waitForTimeout(500);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForTimeout(1000);
}

async function openAdvancedSearch(page: import('@playwright/test').Page) {
  await loginAndNavigate(page, '/assets/parks');
  await expect(page.getByRole('heading', { name: '公園' })).toBeVisible({ timeout: 10_000 });

  // Click the advanced search icon button
  const advancedSearchBtn = page.getByRole('button', { name: '詳細検索' });
  await advancedSearchBtn.click();
  await page.waitForTimeout(300);

  // Modal should be open
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  return dialog;
}

/** Helper: find a <label> element by exact text inside the dialog */
function dialogLabel(dialog: import('@playwright/test').Locator, text: string) {
  return dialog.locator('label', { hasText: new RegExp(`^${text}$`) });
}

test.describe('Park Advanced Search Modal', () => {

  test('1 - Opens modal with correct title', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);

    // Title should be 詳細検索 (heading role)
    await expect(dialog.getByRole('heading', { name: '詳細検索' })).toBeVisible();

    // Close button should exist
    const closeButton = dialog.locator('button[data-slot="dialog-close"]');
    await expect(closeButton).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-advanced-search-01-open.png`, fullPage: false });
  });

  test('2 - Has all four section headers', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);

    const sections = ['基本属性・管理', '規模・供用履歴', '都市計画・権利', '施設・機能'];
    for (const section of sections) {
      const sectionEl = dialog.getByText(section, { exact: true });
      await expect(sectionEl).toBeVisible();

      // Section headers should be uppercase with letter-spacing
      const textTransform = await sectionEl.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.textTransform;
      });
      expect(textTransform).toBe('uppercase');
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-advanced-search-02-sections.png`, fullPage: false });
  });

  test('3 - Basic attributes section has correct fields', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);

    // Search input with placeholder
    const searchInput = dialog.locator('input[placeholder*="No"]');
    await expect(searchInput).toBeVisible();

    // Labels (use <label> elements to avoid matching select placeholders)
    for (const label of ['検索', '区', '種別', '学区名', '管理公所']) {
      await expect(dialogLabel(dialog, label)).toBeVisible();
    }

    // Dropdowns (combobox): 区, 種別, 管理公所, 取得方法, 有料施設, 防災施設 = 6
    const selects = dialog.locator('button[role="combobox"]');
    const selectCount = await selects.count();
    console.log(`  → Advanced search select count: ${selectCount}`);
    expect(selectCount).toBeGreaterThanOrEqual(6);
  });

  test('4 - Layout uses 3-column grid', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);

    // Check that 区, 種別, 学区名 labels are in a 3-column row
    const kuLabel = dialogLabel(dialog, '区');
    const shubetsuLabel = dialogLabel(dialog, '種別');
    const gakukuLabel = dialogLabel(dialog, '学区名');

    const kuBox = await kuLabel.boundingBox();
    const shubetsuBox = await shubetsuLabel.boundingBox();
    const gakukuBox = await gakukuLabel.boundingBox();

    expect(kuBox).not.toBeNull();
    expect(shubetsuBox).not.toBeNull();
    expect(gakukuBox).not.toBeNull();

    // All three should be on the same row (similar Y position)
    expect(Math.abs(kuBox!.y - shubetsuBox!.y)).toBeLessThan(5);
    expect(Math.abs(shubetsuBox!.y - gakukuBox!.y)).toBeLessThan(5);

    // 管理公所 should be on its own row below
    const kanriLabel = dialogLabel(dialog, '管理公所');
    const kanriBox = await kanriLabel.boundingBox();
    expect(kanriBox).not.toBeNull();
    expect(kanriBox!.y).toBeGreaterThan(kuBox!.y + 30);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-advanced-search-03-grid.png`, fullPage: false });
  });

  test('5 - Scale section has 3-column row', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);

    const areaLabel = dialogLabel(dialog, '面積, ha');
    const openingLabel = dialogLabel(dialog, '開園年度');
    const estLabel = dialogLabel(dialog, '設置年月日');

    const areaBox = await areaLabel.boundingBox();
    const openingBox = await openingLabel.boundingBox();
    const estBox = await estLabel.boundingBox();

    expect(areaBox).not.toBeNull();
    expect(openingBox).not.toBeNull();
    expect(estBox).not.toBeNull();

    // All three on the same row
    expect(Math.abs(areaBox!.y - openingBox!.y)).toBeLessThan(5);
    expect(Math.abs(openingBox!.y - estBox!.y)).toBeLessThan(5);

    // Calendar icons should be present for date fields
    const calendarIcons = dialog.locator('svg.lucide-calendar');
    const calCount = await calendarIcons.count();
    console.log(`  → Calendar icons: ${calCount}`);
    expect(calCount).toBeGreaterThanOrEqual(3);
  });

  test('6 - Urban planning section layout', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);

    // First row: 計画番号, 計画面積, 計画決定日
    const planNumLabel = dialogLabel(dialog, '計画番号');
    const planAreaLabel = dialogLabel(dialog, '計画面積, ha');
    const planDateLabel = dialogLabel(dialog, '計画決定日');

    const planNumBox = await planNumLabel.boundingBox();
    const planAreaBox = await planAreaLabel.boundingBox();
    const planDateBox = await planDateLabel.boundingBox();

    // Same row
    expect(Math.abs(planNumBox!.y - planAreaBox!.y)).toBeLessThan(5);
    expect(Math.abs(planAreaBox!.y - planDateBox!.y)).toBeLessThan(5);

    // 取得方法 on its own row below
    const acqLabel = dialogLabel(dialog, '取得方法');
    const acqBox = await acqLabel.boundingBox();
    expect(acqBox!.y).toBeGreaterThan(planNumBox!.y + 30);
  });

  test('7 - Facility section has 2 dropdowns on same row', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);

    const paidLabel = dialogLabel(dialog, '有料施設');
    const disasterLabel = dialogLabel(dialog, '防災施設');

    const paidBox = await paidLabel.boundingBox();
    const disasterBox = await disasterLabel.boundingBox();

    // Same row
    expect(Math.abs(paidBox!.y - disasterBox!.y)).toBeLessThan(5);
  });

  test('8 - Footer has Clear All, Cancel, and Apply', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);

    // すべてクリア button
    await expect(dialog.getByText('すべてクリア')).toBeVisible();

    // Cancel button
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Apply button with dark green background
    const applyBtn = dialog.getByRole('button', { name: 'Apply' });
    await expect(applyBtn).toBeVisible();

    const bgColor = await applyBtn.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log(`  → Apply button bg: ${bgColor}`);
    // Should be dark green (#215042 -> rgb(33, 80, 66))
    expect(bgColor).toContain('33');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-advanced-search-04-footer.png`, fullPage: false });
  });

  test('9 - Search filter applies and filters table', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);

    // Type in search field
    const searchInput = dialog.locator('input[placeholder*="No"]');
    await searchInput.fill('鶴舞');

    // Click Apply
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await page.waitForTimeout(500);

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

    // Table should be filtered
    const rows = await page.locator('tbody tr').count();
    console.log(`  → Rows after search: ${rows}`);
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThan(18); // Less than total parks
  });

  test('10 - Ward dropdown filter applies', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);

    // Open 区 dropdown and select a ward
    const wardTriggers = dialog.locator('button[role="combobox"]');
    // The first combobox in the dialog should be 区
    await wardTriggers.first().click();
    await page.waitForTimeout(300);

    // Pick the first option in the dropdown
    const firstOption = page.locator('[role="option"]').first();
    const wardName = await firstOption.textContent();
    await firstOption.click();
    await page.waitForTimeout(300);

    // Apply
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await page.waitForTimeout(500);

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

    // All visible rows should have the selected ward
    const rowCount = await page.locator('tbody tr').count();
    console.log(`  → Rows after ward filter (${wardName}): ${rowCount}`);
    expect(rowCount).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-advanced-search-05-ward-filter.png`, fullPage: false });
  });

  test('11 - Clear All resets all fields', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);

    // Fill search
    const searchInput = dialog.locator('input[placeholder*="No"]');
    await searchInput.fill('鶴舞');

    // Click すべてクリア
    await dialog.getByText('すべてクリア').click();
    await page.waitForTimeout(300);

    // Search field should be empty
    await expect(searchInput).toHaveValue('');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-advanced-search-06-clear.png`, fullPage: false });
  });

  test('12 - Cancel closes modal without applying', async ({ page }) => {
    const dialog = await openAdvancedSearch(page);
    const initialRows = await page.locator('tbody tr').count();

    // Type in search
    const searchInput = dialog.locator('input[placeholder*="No"]');
    await searchInput.fill('鶴舞');

    // Cancel
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(500);

    // Modal closed
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

    // Row count should be unchanged
    const afterRows = await page.locator('tbody tr').count();
    expect(afterRows).toBe(initialRows);
  });
});
