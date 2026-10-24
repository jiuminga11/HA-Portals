'use strict';
// Requires the runner's synthetic fixture and dynamic preview; no fallback service.
// GET faults only: /api/pages list and the fixture gallery image. No CMS writes.
const assert = require('node:assert/strict');
assert(process.env.REMEDIATION_RUN && process.env.REMEDIATION_ORIGIN, 'Isolated runner environment required');
const { harness, BASE, ORIGIN } = require('./browser-states.cjs');
const zh = require('../../frontend/src/locales/a11y.zh.json');
const en = require('../../frontend/src/locales/a11y.en.json');

(async () => {
  const h = await harness('browser-public-experience');
  let failure;
  let heldImage;
  try {
    const page = await h.context.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const ready = async (slug, locale = 'zh') => {
      const expected = h.pages.find(item => item.slug === slug)[`title_${locale}`];
      await h.wait(async () => await page.title() === expected && await page.locator('.public-page').count() === 1);
    };
    const clickNavigation = async target => {
      const desktop = page.locator(`.site-header nav a[href="${target}"]`);
      await desktop.waitFor({ state: 'attached' });
      if (await desktop.isVisible()) await desktop.click();
      else {
        await page.locator('button[aria-controls="mobile-navigation"]').click();
        await page.locator(`.mobile-navigation-dialog[open] a[href="${target}"]`).click();
      }
    };
    await h.check('navigation-failure-retry-home-entry', async () => {
      let requests = 0;
      const list = url => url.origin === ORIGIN && url.pathname === '/ha/api/pages';
      await page.route(list, async route => {
        h.guard(route.request().url());
        if (++requests === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
        return route.continue();
      });
      await page.goto(BASE + '/projects');
      await ready('projects');
      await page.locator('.navigation-feedback-bar').getByText(zh.navigationFailed, { exact: true }).waitFor();
      const homeEntry = page.locator('.site-brand');
      assert(await homeEntry.isVisible());
      assert.equal(new URL(await homeEntry.getAttribute('href') || '', ORIGIN).pathname.replace(/\/$/, ''), '/ha');
      await page.getByRole('button', { name: zh.retryNavigation, exact: true }).click();
      await page.locator('.site-header nav a[href="/ha/research"]').waitFor({ state: 'attached' });
      assert.equal(requests, 2);
      assert.equal(await page.getByText(zh.navigationFailed, { exact: true }).count(), 0);
      await page.unroute(list);
    });

    await h.check('skip-current-page-and-push-focus', async () => {
      const current = page.locator('.site-header nav a[aria-current="page"]');
      assert.equal(await current.getAttribute('href'), '/ha/projects');
      const skip = page.getByRole('link', { name: zh.skipToContent, exact: true });
      await skip.focus();
      await page.keyboard.press('Enter');
      await h.wait(() => page.locator('#main-content').evaluate(node => document.activeElement === node));
      // Start a clean history entry after independently exercising the skip link.
      await page.goto(BASE + '/projects');
      await ready('projects');
      await page.locator('.site-header nav a[href="/ha/about"]').waitFor({ state: 'attached' });
      await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
      await h.wait(() => page.evaluate(() => scrollY > 300));
      await clickNavigation('/ha/about');
      await ready('about');
      await h.wait(() => page.evaluate(() => scrollY === 0 && document.activeElement === document.querySelector('main h1')));
      assert.equal(await page.locator('.site-header nav a[aria-current="page"]').getAttribute('href'), '/ha/about');
    });

    await h.check('pop-and-language-preserve-reading-position', async () => {
      await page.goBack();
      await ready('projects');
      await h.wait(() => page.evaluate(() => scrollY > 300));
      const before = await page.evaluate(() => scrollY);
      await page.locator('.site-header').getByRole('button', { name: 'EN', exact: true }).click();
      await ready('projects', 'en');
      await h.wait(() => page.evaluate(top => Math.abs(scrollY - top) < 3, before));
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    });

    await h.check('print-content-heading-and-hidden-reveals', async () => {
      await page.goto(BASE + '/about');
      await ready('about');
      assert(await page.locator('.reveal').count() > 0);
      assert(await page.locator('.reveal-x').count() > 0);
      await page.emulateMedia({ reducedMotion: 'no-preference', media: 'print' });
      await page.locator('.reveal, .reveal-x').evaluateAll(nodes => nodes.forEach(node => node.classList.remove('visible')));
      assert(await page.locator('main > .public-page > header h1').isVisible());
      assert(await page.locator('.reveal, .reveal-x').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === '1')));
      assert.equal(await page.locator('.site-header').evaluate(node => getComputedStyle(node).display), 'none');
      await page.emulateMedia({ reducedMotion: 'reduce', media: 'screen' });
    });

    await h.check('mobile-modal-theme-language-and-focus', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      const trigger = page.locator('button[aria-controls="mobile-navigation"]');
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: zh.navigation, exact: true });
      await dialog.waitFor();
      const dark = await page.locator('html').evaluate(node => node.classList.contains('dark'));
      await dialog.getByRole('button', { name: dark ? zh.switchToLight : zh.switchToDark, exact: true }).click();
      await h.wait(async () => await page.locator('html').evaluate(node => node.classList.contains('dark')) !== dark);
      assert(await dialog.isVisible());
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press('Tab');
        assert(await dialog.evaluate(node => node.contains(document.activeElement)));
      }
      await dialog.getByRole('button', { name: zh.switchLanguage, exact: true }).click();
      await ready('about', 'en');
      await h.wait(async () => await trigger.getAttribute('aria-expanded') === 'false');
      assert(await trigger.evaluate(node => document.activeElement === node));
      await trigger.click();
      await page.getByRole('dialog', { name: en.navigation, exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await h.wait(() => trigger.evaluate(node => document.activeElement === node));
    });

    await h.check('desktop-system-theme-control', async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const control = page.getByRole('button', { name: en.useSystemTheme, exact: true });
      await control.click();
      assert.equal(await control.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'system');
    });

    await h.check('long-navigation-collapses-without-overflow', async () => {
      const publicPages = h.pages.filter(item => item.visible);
      const expanded = [...publicPages, ...Array.from({ length: 18 }, (_, index) => ({
        ...publicPages[0], id: 900000 + index, slug: `synthetic-${index}`,
        title_zh: `合成测试长导航名称 ${index}`, title_en: `Synthetic long navigation label ${index}`,
      }))];
      const list = url => url.origin === ORIGIN && url.pathname === '/ha/api/pages';
      await page.route(list, async route => {
        h.guard(route.request().url());
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(expanded) });
      });
      for (const locale of ['zh', 'en']) for (const width of [768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(BASE + (locale === 'en' ? '/en' : '') + '/projects');
        await ready('projects', locale);
        // DOM-only brand stress probe; this does not claim CMS persistence coverage.
        await page.locator('.site-brand span').evaluate(node => { node.textContent = 'Synthetic long site title '.repeat(12); });
        const trigger = page.locator('button[aria-controls="mobile-navigation"]');
        await trigger.waitFor();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        assert(await page.locator('.site-brand').evaluate(node => node.getBoundingClientRect().height <= 64));
        await trigger.click();
        const dialog = page.locator('.mobile-navigation-dialog[open]');
        await dialog.waitFor();
        assert.equal(await dialog.locator('nav a').count(), expanded.length);
        assert(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
        await page.keyboard.press('Escape');
      }
      await page.unroute(list);
    });

    await h.check('gallery-disabled-focus-retry-and-thumbnail-failure', async () => {
      let mode = 'fail';
      const image = BASE + '/uploads/test-gallery.png';
      await page.route(image, route => {
        assert.equal(new URL(route.request().url()).origin, ORIGIN);
        if (mode === 'hold') { heldImage = route; return; }
        if (mode === 'fail') return route.fulfill({ status: 404, headers: { 'cache-control': 'no-store' }, body: '' });
        return route.continue();
      });
      await page.goto(BASE + '/projects');
      await ready('projects');
      const thumbnail = page.locator('.gallery-thumbnail').first();
      await thumbnail.scrollIntoViewIfNeeded();
      await thumbnail.getByText(zh.thumbnailFailed, { exact: true }).waitFor();
      await thumbnail.click();
      const dialog = page.getByRole('dialog', { name: zh.gallery, exact: true });
      await dialog.getByText(zh.imageFailed, { exact: true }).waitFor();
      const previous = dialog.getByRole('button', { name: zh.previousImage, exact: true });
      const next = dialog.getByRole('button', { name: zh.nextImage, exact: true });
      assert.equal(await previous.getAttribute('aria-disabled'), 'true');
      assert.equal(await next.getAttribute('aria-disabled'), 'true');
      await next.focus();
      await page.keyboard.press('Enter');
      assert(await next.evaluate(node => node === document.activeElement));
      assert(await dialog.getByRole('status').filter({ hasText: zh.position.replace('{current}', '1').replace('{total}', '1') }).isVisible());
      mode = 'hold';
      const retry = dialog.getByRole('button', { name: zh.retryImage, exact: true });
      await retry.click();
      await h.wait(async () => Boolean(heldImage));
      assert.equal(await retry.getAttribute('aria-disabled'), 'true');
      assert(await retry.evaluate(node => node === document.activeElement));
      await page.keyboard.press('Enter');
      assert(await retry.evaluate(node => node === document.activeElement));
      mode = 'pass';
      await heldImage.continue();
      heldImage = null;
      await h.wait(() => page.locator('.gallery-preview-image').evaluate(node => node.complete && node.naturalWidth > 0));
      await h.wait(async () => await retry.getAttribute('aria-disabled') !== 'true');
      assert(await retry.evaluate(node => node === document.activeElement));
      assert(await dialog.getByText(zh.captionScrollHint, { exact: true }).isVisible());
      await page.keyboard.press('Escape');
      await h.wait(() => thumbnail.evaluate(node => document.activeElement === node));
      await page.unroute(image);
    });
  } catch (error) {
    failure = error;
    console.error('browser-public-experience detail: ' + String(error.stack || error.name).split('\n').slice(0, 6).join(' | '));
  }
  finally {
    if (heldImage) { try { await heldImage.abort(); } catch { /* Browser cleanup still runs. */ } }
    await h.finish(failure);
  }
})().catch(error => {
  // Never print request details, credentials, content, or raw exception messages.
  console.error('browser-public-experience: failed ' + error.name);
  process.exitCode = 1;
});
