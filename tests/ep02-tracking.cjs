// Run with Node.js and Playwright. Provider requests are intercepted.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { stops } = require('../docs/ep02-content.json');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    for (const [index, lang] of ['zh-Hant', 'zh-Hans', 'en'].entries()) {
      const context = await browser.newContext({
        viewport: index === 0 ? { width: 1440, height: 1000 } : { width: 390, height: 844 },
        reducedMotion: 'reduce',
      });
      const providers = new Set();
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (['www.googletagmanager.com', 'www.clarity.ms'].includes(url.hostname)) {
          providers.add(url.hostname);
          return route.fulfill({ contentType: 'text/javascript', body: '' });
        }
        const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (!['huxiago.com', 'preview.test'].includes(url.hostname) ||
            !file.startsWith(root + path.sep) || !fs.existsSync(file) ||
            !/\.(html|js|css)$/.test(file)) return route.abort();
        return route.fulfill({ path: file });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('https://huxiago.com/ep02-' + lang + '.html');
      const events = () => page.evaluate(() => window.dataLayer
        .filter(entry => entry[0] === 'event').map(entry => ({ name: entry[1], ...entry[2] })));
      assert.deepEqual([...providers].sort(), ['www.clarity.ms', 'www.googletagmanager.com']);
      for (const [position, stop] of stops.entries()) {
        await page.locator('.toc a[href="#' + stop.id + '"]').click();
        const event = (await events()).find(e => e.name === 'toc_item_click' && e.place_id === stop.id);
        assert.ok(event, stop.id);
        assert.equal(event.episode, 'EP.02');
        assert.equal(event.item_id, 'huxiago_vol02');
        assert.equal(event.content_language, lang);
        assert.equal(event.place_name, stop.name);
        assert.equal(event.position, position + 1);
      }
      assert.equal((await events()).filter(e => e.name === 'place_card_open').length, 0);
      await page.goto('https://huxiago.com/ep02-' + lang + '.html');
      const card = page.locator('#kushiro');
      await card.locator('summary').click();
      await card.locator('.story-copy p').first().evaluate(p => p.scrollIntoView({ block: 'center' }));
      await page.waitForFunction(() => window.dataLayer.some(e => e[1] === 'place_content_view' && e[2].place_id === 'kushiro'));
      assert.equal((await events()).filter(e => e.name === 'place_card_open' && e.place_id === 'kushiro').length, 1);
      assert.ok(await page.evaluate(() => window.clarity.q.some(e => e[0] === 'event' && e[1] === 'place_content_view')));
      assert.ok(await page.evaluate(() => window.clarity.q.some(e => e[0] === 'set' && e[1] === 'episode' && e[2] === 'EP.02')));
      assert.deepEqual(errors, []);
      await page.goto('https://preview.test/ep02-' + lang + '.html');
      assert.deepEqual(await page.evaluate(() => [window.huxiagoAnalytics.ga4Enabled, window.huxiagoAnalytics.clarityEnabled]), [false, false]);
      await page.goto('https://huxiago.com/HUXIAGO_Bangkok_EP02_' + lang + '.html');
      assert.equal(await page.evaluate(() => typeof window.huxiagoAnalytics), 'undefined');
      console.log(lang + ': seven stops, distinct funnel events, Clarity, preview and offline guard verified');
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
