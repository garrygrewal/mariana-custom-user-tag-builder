import { test, expect } from '@playwright/test';

test.describe('Text mode flow', () => {
  test('fills form, shows preview, downloads ZIP with correct filename', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /custom user tag/i })).toBeVisible();

    await page.fill('#tag-text', 'AB');

    // Preview SVG should be visible
    await expect(page.locator('[aria-label="Tag preview"] svg')).toBeVisible();

    // Filename label should reflect inputs
    await expect(page.locator('text=custom-tag_ab_text_')).toBeVisible();

    // Export button should be enabled
    const exportBtn = page.getByRole('button', { name: /download zip/i });
    await expect(exportBtn).toBeEnabled();

    // Trigger download and verify filename
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /^custom-tag_ab_text_[0-9a-f]{6}\.zip$/,
    );
  });

  test('auto-uppercases text input', async ({ page }) => {
    await page.goto('/');
    await page.fill('#tag-text', 'ab');

    const value = await page.inputValue('#tag-text');
    expect(value).toBe('AB');
  });

  test('shows validation error on invalid characters then clears', async ({
    page,
  }) => {
    await page.goto('/');

    await page.fill('#tag-text', 'A!');
    await expect(page.getByRole('alert')).toBeVisible();

    await page.fill('#tag-text', 'AB');
    await expect(page.getByRole('alert')).not.toBeVisible();
  });
});

test.describe('Icon mode flow', () => {
  test('selects icon, shows preview, downloads ZIP with correct filename', async ({
    page,
  }) => {
    await page.goto('/');

    // Switch to icon mode
    await page.getByRole('button', { name: /^Icon$/ }).click();

    // Open options and select the first available icon.
    await page.getByRole('button', { name: /select icon/i }).click();
    const firstOption = page.getByRole('option').first();
    await expect(firstOption).toBeVisible();
    await expect(firstOption.locator('svg')).toBeVisible();
    const selectedLabel = (await firstOption.textContent())?.trim() ?? '';
    await firstOption.click();
    await expect(page.getByRole('textbox', { name: /search icons/i })).toHaveAttribute(
      'placeholder',
      selectedLabel,
    );
    await expect(
      page.getByRole('button', { name: /clear selected icon/i }),
    ).toBeVisible();

    // Preview should be visible
    await expect(page.locator('[aria-label="Tag preview"] svg')).toBeVisible();

    // Download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /download zip/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /^custom-tag_[a-z0-9-]+_icon_[0-9a-f]{6}\.zip$/,
    );
  });

  test('shows no-match state when search query has no results', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^Icon$/ }).click();

    await page.getByRole('textbox', { name: /search icons/i }).fill('___no_icon_match___');
    await expect(page.getByText(/no matching icons/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /select icon/i })).toBeEnabled();
  });

  test('clears selected icon via x button', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^Icon$/ }).click();

    await page.getByRole('button', { name: /select icon/i }).click();
    await page.getByRole('option').first().click();
    await expect(page.getByRole('button', { name: /download zip/i })).toBeEnabled();

    await page.getByRole('button', { name: /clear selected icon/i }).click();
    await expect(page.getByRole('button', { name: /clear selected icon/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /download zip/i })).toBeDisabled();
  });
});

test.describe('Accessibility', () => {
  test('all form controls are keyboard-reachable via Tab', async ({ page }) => {
    await page.goto('/');

    // First tabbable is color or hex (WebKit may skip native color input).
    await page.keyboard.press('Tab');
    const colorPickerFocused = await page.locator('[aria-label="Color picker"]')
      .evaluate((el) => el === document.activeElement);
    const hexFocusedFromFirstTab = await page.locator('[aria-label="Hex color code"]')
      .evaluate((el) => el === document.activeElement);
    expect(colorPickerFocused || hexFocusedFromFirstTab).toBeTruthy();

    if (colorPickerFocused) {
      await page.keyboard.press('Tab');
    }

    await expect(page.locator('[aria-label="Hex color code"]')).toBeFocused();
  });

  test('contrast warnings have aria-live region', async ({ page }) => {
    await page.goto('/');

    // Set a very light background to trigger bg-vs-white warning
    await page.fill('[aria-label="Hex color code"]', '#FFFFFF');

    const warningRegion = page.locator('[aria-live="polite"]');
    await expect(warningRegion).toBeVisible();
    await expect(warningRegion).toContainText('hard to see');
  });
});

test.describe('Responsive layout', () => {
  test('card is usable at 360px mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /custom user tag/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /download zip/i })).toBeVisible();

    // Card should not overflow horizontally
    const card = page.locator('h1').locator('..');
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(360);
  });
});
