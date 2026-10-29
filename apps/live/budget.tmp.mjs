import { chromium } from '@playwright/test';
const PROBE = `(() => { const w = window; w.__p = { click: null, ready: null };
 document.addEventListener('click', (e) => { w.__p = { click: e.timeStamp, ready: null }; }, true);
 const check = () => { const p = w.__p; if (p.click === null || p.ready !== null || p.pending) return;
  if (!/^\\/document\\//.test(location.pathname)) return; const r = document.querySelector('[data-canvas-a11y-root]');
  if (!r || !r.checkVisibility()) return; p.pending = true; requestAnimationFrame(() => setTimeout(() => { p.ready = performance.now(); }, 0)); };
 new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['style','hidden','class'] }); })()`;
const b = await chromium.launch();
const res = {};
for (const round of [0, 1]) for (const [name, port] of [['branch', 4602], ['main', 4702]]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await ctx.addInitScript(PROBE);
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  for (let i = 0; i < 3; i++) {
    await p.goto(`http://localhost:${port}/explorer/home`);
    const caret = p.getByRole('button', { name: 'More new document choices' });
    await caret.waitFor(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
    await caret.hover();
    await p.getByRole('button', { name: /^New / }).first().click();
    await p.waitForFunction(() => window.__p.ready !== null, null, { timeout: 30000 });
    const ms = await p.evaluate(() => Math.round(window.__p.ready - window.__p.click));
    (res[name] ??= []).push(ms);
  }
  await ctx.close();
}
console.log(JSON.stringify(res));
await b.close();
