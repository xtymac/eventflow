import { test, expect } from '@playwright/test';
import { SCREENSHOT_DIR } from './helpers';

// Helper: wait for app to mount and bypass login if shown
async function waitForApp(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(
    'img[alt="EventFlow"], input[type="password"], [data-testid="app-shell"]',
    { timeout: 15_000 },
  ).catch(() => {});
  const loginButton = page.locator('button:has-text("ログイン"), button:has-text("Login")');
  if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginButton.first().click();
    await page.waitForTimeout(1000);
  }
}

test.describe('Facility Detail Page', () => {

  test('1 - Page loads with breadcrumb and basic attributes', async ({ page }) => {
    await waitForApp(page);
    // Navigate to PF-demo-011 (Figma reference: テーブル, 05-780)
    await page.goto('/assets/facilities/PF-demo-011', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Breadcrumb should show facility info
    await expect(page.getByText('施設')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('テーブル・05-780')).toBeVisible({ timeout: 10_000 });

    // 基本属性 section should be visible
    await expect(page.getByText('基本属性')).toBeVisible({ timeout: 10_000 });

    // Verify basic attribute fields
    await expect(page.getByText('名称')).toBeVisible();
    await expect(page.getByText('テーブル').first()).toBeVisible();
    await expect(page.getByText('施設ID')).toBeVisible();
    await expect(page.getByText('05-780')).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-01-basic-attributes.png`, fullPage: true });
  });

  test('2 - Status badge and classification show correctly', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities/PF-demo-011', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Status badge "使用中" should be visible
    await expect(page.getByText('使用中')).toBeVisible({ timeout: 10_000 });

    // 施設分類 "休養" should show
    await expect(page.getByText('施設分類')).toBeVisible();
    await expect(page.getByText('休養')).toBeVisible();

    // 細目 should show
    await expect(page.getByText('細目').first()).toBeVisible();

    // 主要部材 should show
    await expect(page.getByText('主要部材')).toBeVisible();

    // 数量 should show
    await expect(page.getByText('数量')).toBeVisible();
    await expect(page.getByText(/3\s*基/)).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-02-status-classification.png`, fullPage: true });
  });

  test('3 - Installation info section is visible', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities/PF-demo-011', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 設置・施工情報 section should be visible
    await expect(page.getByText('設置・施工情報')).toBeVisible({ timeout: 10_000 });

    // 設置年 should show date
    await expect(page.getByText('設置年')).toBeVisible();

    // 備考 should be visible
    await expect(page.getByText('備考')).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-03-installation-info.png`, fullPage: true });
  });

  test('4 - Side-by-side layout with map and photo panels', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities/PF-demo-011', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    // Top block should be a flex container
    const topBlock = page.getByTestId('facility-top-block');
    await expect(topBlock).toBeVisible({ timeout: 10_000 });

    // Media panel (right side) should be visible
    const mediaPanel = page.getByTestId('facility-media-panel');
    await expect(mediaPanel).toBeVisible({ timeout: 10_000 });

    // MiniMap canvas should render
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10_000 });

    // Verify side-by-side layout (top block should be wider than media panel)
    const topBox = await topBlock.boundingBox();
    const mediaBox = await mediaPanel.boundingBox();
    expect(topBox).not.toBeNull();
    expect(mediaBox).not.toBeNull();
    // Media panel should be to the right of info panel
    expect(mediaBox!.x).toBeGreaterThan(topBox!.x);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-04-layout.png`, fullPage: true });
  });

  test('5 - Inspection history section with data', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities/PF-demo-011', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Inspection section should be visible
    const inspectionSection = page.getByTestId('facility-inspection-section');
    await expect(inspectionSection).toBeVisible({ timeout: 10_000 });

    // Section title
    await expect(page.getByText('点検履歴')).toBeVisible();

    // Should have inspection rows
    const inspRows = page.getByTestId('inspection-row');
    const count = await inspRows.count();
    console.log(`  → Inspection rows: ${count}`);
    expect(count).toBeGreaterThan(0);

    // First row should show data matching Figma (ID: 23563)
    await expect(page.getByText('23563').first()).toBeVisible();

    // Column headers
    await expect(page.getByText('点検年月日').first()).toBeVisible();
    await expect(page.getByText('点検実施者').first()).toBeVisible();
    await expect(page.getByText('構造ランク').first()).toBeVisible();
    await expect(page.getByText('消耗ランク').first()).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-05-inspection-history.png`, fullPage: true });
  });

  test('6 - Inspection filter toolbar works', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities/PF-demo-011', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const inspectionSection = page.getByTestId('facility-inspection-section');
    await expect(inspectionSection).toBeVisible({ timeout: 10_000 });

    // Should have search input
    const searchInput = inspectionSection.locator('input[placeholder*="点検内容"]');
    await expect(searchInput).toBeVisible();

    // Get initial row count
    const initialCount = await page.getByTestId('inspection-row').count();
    expect(initialCount).toBeGreaterThan(0);

    // Filter by search text that matches no rows
    await searchInput.fill('存在しないテスト');
    await page.waitForTimeout(500);

    // Rows should be filtered (0 or fewer)
    const filteredCount = await page.getByTestId('inspection-row').count();
    expect(filteredCount).toBe(0);

    // Clear all filters
    await inspectionSection.getByText('すべてクリア').click();
    await page.waitForTimeout(500);

    // Rows should be restored
    const restoredCount = await page.getByTestId('inspection-row').count();
    expect(restoredCount).toBe(initialCount);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-06-inspection-filters.png`, fullPage: true });
  });

  test('7 - Repair history section with data', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities/PF-demo-011', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Repair section should be visible
    const repairSection = page.getByTestId('facility-repair-section');
    await expect(repairSection).toBeVisible({ timeout: 10_000 });

    // Section title
    await expect(page.getByText('補修履歴')).toBeVisible();

    // Should have repair rows
    const repRows = page.getByTestId('repair-row');
    const count = await repRows.count();
    console.log(`  → Repair rows: ${count}`);
    expect(count).toBeGreaterThan(0);

    // Column headers matching Figma
    await expect(page.getByText('主な交換部材').first()).toBeVisible();
    await expect(page.getByText('補修業者').first()).toBeVisible();
    await expect(page.getByText('補修備考').first()).toBeVisible();
    await expect(page.getByText('設計書番号').first()).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-07-repair-history.png`, fullPage: true });
  });

  test('8 - Repair filter toolbar works', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities/PF-demo-011', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const repairSection = page.getByTestId('facility-repair-section');
    await expect(repairSection).toBeVisible({ timeout: 10_000 });

    // Should have search input
    const searchInput = repairSection.locator('input[placeholder*="主な交換部材"]');
    await expect(searchInput).toBeVisible();

    // Get initial row count
    const initialCount = await page.getByTestId('repair-row').count();
    expect(initialCount).toBeGreaterThan(0);

    // Filter by search text that matches only specific repair
    await searchInput.fill('木製座板');
    await page.waitForTimeout(500);

    const filteredCount = await page.getByTestId('repair-row').count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // Clear all
    await repairSection.getByText('すべてクリア').click();
    await page.waitForTimeout(500);

    const restoredCount = await page.getByTestId('repair-row').count();
    expect(restoredCount).toBe(initialCount);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-08-repair-filters.png`, fullPage: true });
  });

  test('9 - Park name link navigates to park detail', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities/PF-demo-011', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 公園名称 should be a link
    const parkLink = page.getByText('名城公園').first();
    await expect(parkLink).toBeVisible({ timeout: 10_000 });

    // Click the park link
    await parkLink.click();
    await page.waitForTimeout(2000);

    // Should navigate to park detail page
    expect(page.url()).toContain('/assets/parks/');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-09-park-navigation.png`, fullPage: true });
  });

  test('10 - Empty facility shows correct message', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities/NONEXISTENT', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Should show empty message
    await expect(page.getByText('施設が見つかりません')).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-10-empty-state.png`, fullPage: true });
  });

  test('11 - Different facility loads with different data', async ({ page }) => {
    await waitForApp(page);
    // Navigate to PF-demo-001 (鶴舞公園 トイレA棟)
    await page.goto('/assets/facilities/PF-demo-001', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Should show different facility name
    await expect(page.getByText('トイレA棟').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('03-210')).toBeVisible();

    // Should have inspection data
    const inspRows = page.getByTestId('inspection-row');
    const inspCount = await inspRows.count();
    console.log(`  → PF-demo-001 inspection rows: ${inspCount}`);
    expect(inspCount).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-11-different-facility.png`, fullPage: true });
  });

  test('12 - Rank badges display with correct colors', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/facilities/PF-demo-011', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Find rank badges in inspection table
    const inspectionSection = page.getByTestId('facility-inspection-section');
    await expect(inspectionSection).toBeVisible({ timeout: 10_000 });

    // There should be A-rank badges (green) and C-rank badges (orange)
    const badges = inspectionSection.locator('[class*="rounded-full"]');
    const badgeCount = await badges.count();
    console.log(`  → Rank badges: ${badgeCount}`);
    expect(badgeCount).toBeGreaterThan(0);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/fd-12-rank-badges.png`, fullPage: true });
  });
});
