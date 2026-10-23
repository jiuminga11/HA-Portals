// Preserve the existing avatar crop/focus workflow using only a generated color-block fixture.
const assert = require('node:assert/strict');
const { harness, BASE } = require('./browser-states.cjs');
(async () => {
  const h = await harness('browser-avatar');
  const page = await h.context.newPage();
  let failure;
  try {
    const id = h.manifest.sections.hero;
    const original = (await h.api('GET', '/sections')).find(section => section.id === id);
    await h.remember(`/sections/${id}`, { content: original.content });
    await page.goto(BASE + '/admin/login');
    await page.evaluate(token => localStorage.setItem('token', token), h.token);
    await h.check('avatar-drag-save-reload-public-focus', async () => {
      await page.goto(BASE + `/admin/sections/${id}?page_id=1`);
      const crop = page.getByRole('img', { name: '头像取景调整', exact: true });
      await crop.waitFor(); await crop.scrollIntoViewIfNeeded();
      const image = crop.locator('img');
      assert(await image.evaluate(img => img.complete && img.naturalWidth > 0));
      const before = await image.evaluate(img => img.style.objectPosition);
      const box = await crop.boundingBox(); assert(box);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 24, box.y + box.height / 2 + 12, { steps: 5 });
      await page.mouse.up();
      const after = await image.evaluate(img => img.style.objectPosition);
      assert.notEqual(after, before);
      const response = page.waitForResponse(r => new URL(r.url()).pathname === `/ha/api/sections/${id}` && r.request().method() === 'PUT' && r.status() === 200);
      await page.getByRole('button', { name: '保存', exact: true }).click(); await response;
      await page.getByRole('status').filter({ hasText: '保存成功' }).waitFor();
      assert.equal((await h.api('GET', '/sections')).find(section => section.id === id).content.avatar_position, after);
      await page.reload(); await crop.waitFor();
      assert.equal(await image.evaluate(img => img.style.objectPosition), after);
      await page.goto(BASE + '/'); await page.locator('.profile-hero img').waitFor();
      assert.equal(await page.locator('.profile-hero img').evaluate(img => img.style.objectPosition), after);
      await page.goto(BASE + `/admin/sections/${id}?page_id=1`); await crop.waitFor();
      await page.getByRole('button', { name: '重置居中', exact: true }).click();
      assert.equal(await image.evaluate(img => img.style.objectPosition), '50% 50%');
    });
  } catch (error) { failure = error; }
  finally { await h.finish(failure); }
})().catch(error => { console.error(`bootstrap: ${error.name}`); process.exitCode = 1; });
