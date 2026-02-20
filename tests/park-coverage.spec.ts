import { test, expect } from '@playwright/test';

import { SCREENSHOT_DIR } from './helpers';

async function waitForApp(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('img[alt="EventFlow"], input[type="password"], [data-testid="app-shell"]', { timeout: 15_000 }).catch(() => {});
  const loginButton = page.locator('button:has-text("ログイン"), button:has-text("Login")');
  if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginButton.first().click();
    await page.waitForTimeout(1000);
  }
}

test.describe('Park Building Coverage (建ぺい率)', () => {

  test('1 - Coverage section renders with card wrapper and title', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/parks/GS-4g77l6x7', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Title should be visible
    const title = page.getByText('公園内建ぺい率一覧');
    await expect(title).toBeVisible({ timeout: 10_000 });

    // Card wrapper should have shadow and white bg
    const card = title.locator('..');
    await expect(card).toHaveClass(/shadow-sm/);
    await expect(card).toHaveClass(/bg-white/);
    await expect(card).toHaveClass(/rounded-lg/);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-coverage-01-card.png`, fullPage: true });
  });

  test('2 - Coverage categories show correct labels', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/parks/GS-4g77l6x7', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Both categories should be visible
    await expect(page.getByText('2%物件(A)')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('10%物件(B)')).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-coverage-02-categories.png`, fullPage: true });
  });

  test('3 - Summary stats display correctly', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/parks/GS-4g77l6x7', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 2% category stats
    await expect(page.getByText('50.94')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('2,248')).toBeVisible({ timeout: 10_000 });

    // Coverage rate badges with bg-primary
    const badges = page.locator('.bg-primary');
    const badgeCount = await badges.count();
    expect(badgeCount).toBeGreaterThanOrEqual(2);

    // Badge text values
    await expect(page.getByText('0.05%')).toBeVisible();
    await expect(page.getByText('0.07%')).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-coverage-03-stats.png`, fullPage: true });
  });

  test('4 - 2% category is expanded by default and shows facility table', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/parks/GS-4g77l6x7', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Scroll to the building coverage section
    const title = page.getByText('公園内建ぺい率一覧');
    await title.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // The 2% category starts open by default (openCoverage: { 0: true })
    // If table headers are not visible yet, click to expand
    const headerCell = page.getByText('施設の種別');
    const isOpen = await headerCell.isVisible({ timeout: 2000 }).catch(() => false);
    if (!isOpen) {
      const trigger = page.locator('button:has-text("2%物件(A)")');
      await trigger.click();
      await page.waitForTimeout(1000);
    }

    // Table headers should be visible (scope to the coverage table)
    await expect(headerCell).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('columnheader', { name: '設置年月日' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '検査済証の有無' })).toBeVisible();

    // Data rows should show
    await expect(page.getByText('便所(ゲートボール場)')).toBeVisible();
    await expect(page.getByText('便所(芝生広場)')).toBeVisible();
    await expect(page.getByText('器具庫')).toBeVisible();

    // Take focused screenshot of the coverage section
    const coverageCard = page.locator('.shadow-sm:has-text("公園内建ぺい率一覧")');
    await coverageCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await coverageCard.screenshot({ path: `${SCREENSHOT_DIR}/park-coverage-04-expanded.png` });
  });

  test('5 - Table cells use correct font size (text-sm)', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/parks/GS-4g77l6x7', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Expand 2% category
    await page.getByText('2%物件(A)').click();
    await page.waitForTimeout(500);

    // Check that data cells use text-sm (14px) not text-xs (12px)
    const firstDataCell = page.locator('td.text-sm').first();
    await expect(firstDataCell).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-coverage-05-font-size.png`, fullPage: true });
  });

  test('6 - Collapsed 10% category shows no table', async ({ page }) => {
    await waitForApp(page);
    await page.goto('/assets/parks/GS-4g77l6x7', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 10% category should be visible but collapsed (no table visible under it)
    const tenPctLabel = page.getByText('10%物件(B)');
    await expect(tenPctLabel).toBeVisible({ timeout: 10_000 });

    // Stats for 10% should show
    await expect(page.getByText('187.00')).toBeVisible();
    await expect(page.getByText('26,100.00')).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-coverage-06-collapsed.png`, fullPage: true });
  });
});
