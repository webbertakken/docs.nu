import { chromium } from '@playwright/test';
const base = 'http://localhost:4810';
const out = '/tmp/bp10-shots';
const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  try { localStorage.setItem('livedoc:quick-tour:pending', '0'); } catch {}
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
const mode = process.argv[2];
if (mode === 'guest') {
  await page.goto(`${base}/explorer/recent?settings=account`, { waitUntil: 'networkidle', timeout: 240000 });
  const dialog = page.getByRole('dialog').first();
  await dialog.waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  await dialog.screenshot({ path: `${out}/9d-account-guest-after.png` });
}
if (mode === 'signin') {
  const email = `ada${Date.now()}@example.com`;
  await page.goto(`${base}/get-started/`, { waitUntil: 'networkidle', timeout: 240000 });
  await page.getByLabel('Your name').fill('Ada Lovelace');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('6-digit code').waitFor({ timeout: 60000 });
  const res = await ctx.request.get(`${base}/api/preview/outbox?to=${encodeURIComponent(email)}`);
  const text = await res.text();
  const code = text.match(/\b(\d{6})\b/)?.[1];
  console.log('code', code);
  await page.getByLabel('6-digit code').fill(code);
  await page.waitForURL((u) => !u.pathname.startsWith('/get-started'), { timeout: 60000 });
  await page.goto(`${base}/explorer/recent?settings=account`, { waitUntil: 'networkidle', timeout: 240000 });
  const dialog = page.getByRole('dialog').first();
  await dialog.waitFor({ timeout: 120000 });
  await page.waitForTimeout(3000);
  await dialog.screenshot({ path: `${out}/9d-account-signed-in-after.png` });
  await page.getByRole('button', { name: /^Colour: / }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/9d-colour-picker-after.png` });
  await page.getByRole('group', { name: 'Your colour' }).getByRole('button', { name: 'Violet' }).click();
  await page.waitForTimeout(1500);
  await dialog.screenshot({ path: `${out}/9d-colour-picked-after.png` });
  // Scroll to Signing In.
  await page.getByText('Where You’re Signed In').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await dialog.screenshot({ path: `${out}/9d-signing-in-after.png` });
}
await browser.close();
