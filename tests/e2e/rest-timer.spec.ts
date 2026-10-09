import { expect, test } from '@playwright/test';

test('approved rest arc preserves controls and stops flashing after completion', async ({ page }) => {
  await page.goto('/?demo=1');
  const timer = page.getByLabel('休憩タイマー');
  await expect(timer).toBeVisible();
  await expect(timer.locator('.rest-arc-track')).toHaveAttribute('stroke-dasharray', '75 25');
  const clock = timer.locator('.rest-time');
  expect(await clock.evaluate(element => getComputedStyle(element).fontStyle)).toBe('italic');
  expect(await clock.evaluate(element => getComputedStyle(element).fontSynthesis)).not.toBe('none');
  const before = await clock.textContent();
  await timer.getByRole('button', { name: '＋15秒', exact: true }).click();
  await expect(clock).not.toHaveText(before!);
  await timer.getByRole('button', { name: '−15秒', exact: true }).click();
  await page.reload();
  await expect(timer).toBeVisible();
  await page.getByRole('button', { name: '休憩終了の光り方を見る' }).click();
  await expect(timer).toHaveClass(/rest-finished/);
  await expect(timer.locator('.rest-arc-progress')).toHaveAttribute('stroke-dasharray', '0 100');
  await expect(clock).toHaveText('0:00');
  const animation = await timer.evaluate(element => {
    const style = getComputedStyle(element, '::before');
    return { duration: style.animationDuration, iterations: style.animationIterationCount };
  });
  expect(animation).toEqual({ duration: '3s', iterations: '1' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await timer.evaluate(element => getComputedStyle(element, '::before').animationName)).toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const next = timer.getByRole('button', { name: '次のセットへ', exact: true });
  const box = await next.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await next.click();
  await expect(page.locator('.live-set:not(.completed)').first()).toBeVisible();
});
