import { test, expect } from '@playwright/test';

import { SCREENSHOT_DIR } from './helpers';

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

test.describe('User Avatar on /assets/parks', () => {

  test('1 - Avatar section is visible with initials, name, and role', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');

    const avatar = page.getByTestId('user-avatar');
    await expect(avatar).toBeVisible({ timeout: 10_000 });

    // Avatar circle (first child div) should show initials
    const circle = avatar.locator('> div').first();
    await expect(circle).toBeVisible();
    const initials = await circle.textContent();
    expect(initials).toBeTruthy();
    expect(initials!.trim().length).toBeLessThanOrEqual(2);

    // Name should be displayed
    const name = avatar.locator('p').first();
    await expect(name).toBeVisible();
    const nameText = await name.textContent();
    expect(nameText!.length).toBeGreaterThan(0);

    // Role label should be displayed
    const role = avatar.locator('p').nth(1);
    await expect(role).toBeVisible();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-avatar-01-visible.png`, fullPage: false });
  });

  test('2 - Avatar styling matches Figma design tokens', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');

    const avatar = page.getByTestId('user-avatar');
    await expect(avatar).toBeVisible({ timeout: 10_000 });

    // Avatar circle should be 40x40 with #f5f5f5 background
    const circle = avatar.locator('> div').first();
    const circleBox = await circle.boundingBox();
    expect(circleBox).not.toBeNull();
    expect(circleBox!.width).toBeGreaterThanOrEqual(38);
    expect(circleBox!.width).toBeLessThanOrEqual(42);
    expect(circleBox!.height).toBeGreaterThanOrEqual(38);
    expect(circleBox!.height).toBeLessThanOrEqual(42);

    const bg = await circle.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(245, 245, 245)');

    // Circle border-radius should be fully round
    const borderRadius = await circle.evaluate(el => getComputedStyle(el).borderRadius);
    expect(parseInt(borderRadius)).toBeGreaterThanOrEqual(9999);

    // Initials font-weight should be semibold (600)
    const fontWeight = await circle.evaluate(el => getComputedStyle(el).fontWeight);
    expect(fontWeight).toBe('600');

    // Name font-size should be 14px
    const name = avatar.locator('p').first();
    const nameFontSize = await name.evaluate(el => getComputedStyle(el).fontSize);
    expect(nameFontSize).toBe('14px');

    // Role font-size should be 12px, color #737373
    const role = avatar.locator('p').nth(1);
    const roleFontSize = await role.evaluate(el => getComputedStyle(el).fontSize);
    expect(roleFontSize).toBe('12px');
    const roleColor = await role.evaluate(el => getComputedStyle(el).color);
    expect(roleColor).toBe('rgb(115, 115, 115)');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-avatar-02-styling.png`, fullPage: false });
  });

  test('3 - Clicking avatar opens dropdown with logout', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');

    const avatar = page.getByTestId('user-avatar');
    await expect(avatar).toBeVisible({ timeout: 10_000 });

    // Click the avatar to open dropdown
    await avatar.click();
    await page.waitForTimeout(300);

    // Dropdown should show logout option
    const logoutItem = page.getByText('ログアウト');
    await expect(logoutItem).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-avatar-03-dropdown.png`, fullPage: false });
  });

  test('4 - Chevron icon is present', async ({ page }) => {
    await loginAndNavigate(page, '/assets/parks');

    const avatar = page.getByTestId('user-avatar');
    await expect(avatar).toBeVisible({ timeout: 10_000 });

    // Should have an SVG chevron icon
    const chevron = avatar.locator('svg');
    await expect(chevron).toBeVisible();

    // Chevron should be 20x20
    const chevronBox = await chevron.boundingBox();
    expect(chevronBox).not.toBeNull();
    expect(chevronBox!.width).toBeGreaterThanOrEqual(18);
    expect(chevronBox!.width).toBeLessThanOrEqual(22);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/park-avatar-04-chevron.png`, fullPage: false });
  });
});
