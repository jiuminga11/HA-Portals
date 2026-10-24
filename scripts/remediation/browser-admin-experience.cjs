/* Isolated admin UX checks. Registered/run by the verification owner after build.
 * No real file deletion or settings writes: file requests use a synthetic route mock.
 * No credentials, screenshots, traces, request payloads or DOM dumps are reported. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  // Never fall back to a historical fixture or a normal development service.
  assert(process.env.REMEDIATION_RUN && process.env.REMEDIATION_ORIGIN);
  const { harness, ROOT, BASE } = require('./browser-states.cjs');
  const h = await harness('browser-admin-experience');
  let failure;
  try {
    const page = await h.context.newPage();
    const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/src/locales/zh.json'), 'utf8'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + '/admin/login');
    await page.locator('input[autocomplete="username"]').fill(h.secrets.ADMIN_USERNAME);
    await page.locator('input[autocomplete="current-password"]').fill(h.secrets.ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.getByRole('button', { name: t.admin.newSection, exact: true }).waitFor();

    await h.check('admin-mobile-navigation-and-width', async () => {
      const main = page.locator('.admin-main');
      const bounds = await main.boundingBox();
      assert(bounds && bounds.width >= 380 && bounds.x >= 0 && bounds.x + bounds.width <= 391);
      assert(await main.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const trigger = page.getByRole('button', { name: t.admin.openMenu, exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: t.admin.menu, exact: true });
      await dialog.waitFor();
      assert(await dialog.evaluate(node => node.matches(':modal')));
      assert(await dialog.getByRole('button', { name: t.admin.closeMenu, exact: true }).evaluate(node => node === document.activeElement));
      assert.equal(await dialog.getByRole('link').count(), 5);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert(await trigger.evaluate(node => node === document.activeElement));
      await trigger.click();
      await dialog.getByRole('link', { name: t.admin.navigation.files, exact: true }).click();
      await page.waitForURL(url => url.pathname === '/ha/admin/files');
      await dialog.waitFor({ state: 'hidden' });
      await trigger.click();
      await dialog.getByRole('link', { name: t.admin.navigation.content, exact: true }).click();
      await page.getByRole('button', { name: t.admin.newSection, exact: true }).waitFor();
    });

    await h.check('admin-shell-independent-of-public-dark', async () => {
      const styles = () => page.locator('.admin-shell').evaluate(shell => {
        const header = shell.querySelector('.admin-topbar');
        const main = shell.querySelector('.admin-main');
        return [getComputedStyle(shell).backgroundColor, getComputedStyle(shell).color,
          getComputedStyle(header).backgroundColor, getComputedStyle(main).color,
          getComputedStyle(shell).colorScheme];
      });
      await page.evaluate(() => { document.documentElement.dataset.theme = 'cyber-purple'; document.documentElement.classList.remove('dark'); });
      const light = await styles();
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      assert.deepEqual(await styles(), light);
      assert.equal(light[0], 'rgb(248, 250, 252)');
      assert.equal(light[1], 'rgb(30, 41, 59)');
      assert.equal(light[4], 'light');
    });

    await h.check('admin-new-section-modal-keyboard', async () => {
      const trigger = page.getByRole('button', { name: t.admin.newSection, exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: t.admin.chooseSectionType, exact: true });
      await dialog.waitFor();
      assert(await dialog.evaluate(node => node.matches(':modal')));
      const first = dialog.getByRole('button').first();
      const last = dialog.getByRole('button', { name: t.admin.cancel, exact: true });
      assert(await first.evaluate(node => node === document.activeElement));
      await page.keyboard.press('Shift+Tab');
      assert(await last.evaluate(node => node === document.activeElement));
      await page.keyboard.press('Tab');
      assert(await first.evaluate(node => node === document.activeElement));
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert(await trigger.evaluate(node => node === document.activeElement));
    });

    await h.check('admin-file-delete-pending-lock', async () => {
      const syntheticId = 987654321;
      const matcher = url => url.pathname === '/ha/api/files' || url.pathname === `/ha/api/files/${syntheticId}`;
      let release;
      let deletes = 0;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route(matcher, async route => {
        h.guard(route.request().url());
        if (route.request().method() === 'DELETE') {
          deletes++;
          await gate;
          await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ detail: 'Synthetic reference conflict' }) });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
            { id: syntheticId, filename: 'synthetic-admin-check.pdf', file_url: '/uploads/synthetic-admin-check.pdf', mime_type: 'application/pdf', file_size: 1024, created_at: '2026-01-01T00:00:00Z' },
          ]) });
        }
      });
      try {
        await page.goto(BASE + '/admin/files');
        await page.getByTitle(t.files.deleteTitle, { exact: true }).click();
        const dialog = page.getByRole('dialog', { name: t.files.deleteTitle, exact: true });
        await dialog.waitFor();
        const cancel = dialog.getByRole('button', { name: t.admin.cancel, exact: true });
        assert(await cancel.evaluate(node => node === document.activeElement));
        // Two same-turn activations exercise the synchronous lock as well as busy rendering.
        await dialog.getByRole('button', { name: t.admin.delete, exact: true }).evaluate(button => { button.click(); button.click(); });
        await h.wait(async () => deletes === 1 && await dialog.getAttribute('aria-busy') === 'true');
        const pending = dialog.getByRole('button', { name: t.files.deleting, exact: true });
        assert.equal(await pending.getAttribute('aria-disabled'), 'true');
        await pending.evaluate(button => { button.focus(); button.click(); });
        await page.keyboard.press('Enter');
        await page.keyboard.press('Escape');
        await cancel.evaluate(button => button.click());
        assert(await dialog.isVisible());
        assert(await dialog.evaluate(node => node.contains(document.activeElement)));
        assert.equal(deletes, 1);
        release();
        await dialog.waitFor({ state: 'hidden' });
        await page.getByRole('alert').filter({ hasText: t.files.inUse }).waitFor();
        assert.equal(deletes, 1);
      } finally {
        release();
        await page.unroute(matcher);
      }
    });

    await h.check('admin-preview-shared-palette-and-system-mode', async () => {
      await page.goto(BASE + '/admin/site-settings');
      const preview = page.locator('.settings-preview');
      await preview.waitFor();
      const mode = page.getByLabel(t.settings.defaultTheme, { exact: false });
      const preset = page.getByLabel(t.settings.preset, { exact: false });
      for (const id of ['teal-amber', 'deep-indigo', 'forest-terracotta']) {
        await preset.selectOption(id);
        for (const appearance of ['light', 'dark']) {
          await mode.selectOption(appearance);
          assert.equal(await preview.getAttribute('data-theme'), id);
          assert.equal(await preview.evaluate(node => node.classList.contains('dark')), appearance === 'dark');
          // A sibling probe resolves the public CSS itself, outside the admin token scope.
          assert(await preview.evaluate(node => {
            const probe = document.createElement('div');
            probe.dataset.theme = node.dataset.theme;
            probe.classList.toggle('dark', node.classList.contains('dark'));
            probe.style.background = 'var(--color-bg)';
            probe.style.color = 'var(--color-text)';
            document.body.append(probe);
            try {
              return ['--color-bg', '--color-text', '--color-border'].every(key => getComputedStyle(node).getPropertyValue(key) === getComputedStyle(probe).getPropertyValue(key))
                && getComputedStyle(node).backgroundColor === getComputedStyle(probe).backgroundColor
                && getComputedStyle(node).color === getComputedStyle(probe).color
                && !node.style.getPropertyValue('--bg-base');
            } finally { probe.remove(); }
          }));
        }
      }
      await page.getByLabel(t.settings.labels.primary_color, { exact: true }).fill('#123456');
      await page.getByLabel(t.settings.labels.gradient_color, { exact: true }).fill('#345678');
      await page.getByLabel(t.settings.labels.accent_color, { exact: true }).fill('#567890');
      await page.getByLabel(t.settings.fontSize, { exact: false }).selectOption('extra-large');
      assert.deepEqual(await preview.evaluate(node => [node.style.getPropertyValue('--color-primary'), node.style.getPropertyValue('--color-gradient'), node.style.getPropertyValue('--color-accent'), getComputedStyle(node).fontSize]), ['#123456', '#345678', '#567890', '20px']);
      await mode.selectOption('system');
      await page.emulateMedia({ colorScheme: 'light' });
      await h.wait(async () => !(await preview.evaluate(node => node.classList.contains('dark'))));
      await page.emulateMedia({ colorScheme: 'dark' });
      await h.wait(async () => await preview.evaluate(node => node.classList.contains('dark')));
    });
  } catch (error) {
    failure = error;
    console.error('browser-admin-experience detail: ' + String(error.stack || error.name).split('\n').slice(0, 6).join(' | '));
  }
  finally { await h.finish(failure); }
}
main().catch(error => { console.error(`bootstrap: ${error.name || 'Error'}`); process.exitCode = 1; });
