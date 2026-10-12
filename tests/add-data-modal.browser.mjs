// Run: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/add-data-modal.browser.mjs
// Uses the real form, Radix dialog, and application CSS without authentication or API writes.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await createServer({
  server: { port: 0 },
  plugins: [{
    name: 'add-data-modal-regression-harness',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === '/__modal-test.html') {
          res.setHeader('Content-Type', 'text/html');
          const html = '<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/__modal-test.tsx"></script></body></html>';
          server.transformIndexHtml('/__modal-test.html', html).then(html => res.end(html)).catch(next);
        } else next();
      });
    },
    resolveId(id) { if (id === '/__modal-test.tsx') return id; },
    load(id) {
      if (id === '/__modal-test.tsx') return `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {AddDataForm} from '/src/components/AddDataForm.tsx';
        import '/src/index.css';
        createRoot(document.getElementById('root')).render(<AddDataForm open={true} onOpenChange={()=>{}} onSuccess={()=>{}}/>);`;
    },
  }],
});
await server.listen();
try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 3 });
      page.on('pageerror', error => console.error('pageerror:', error.message));
      page.on('console', message => { if (message.type() === 'error') console.error('browser:', message.text()); });
      await page.goto(`${server.resolvedUrls.local[0]}__modal-test.html`);
      await page.getByRole('dialog').waitFor();
      await page.getByPlaceholder('150.0', { exact: true }).fill('150');
      await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(el => el.textContent === 'Save Data')?.disabled);
      await page.waitForTimeout(400);
      // Native Safari chrome isn't available headless. Explicitly model a 100px
      // toolbar: the large viewport stays 844px while the dynamic viewport is 744px.
      // Override viewport units, not the modal's size/position/overflow policies.
      await page.evaluate(() => {
        const style = document.createElement('style');
        let rules = '';
        function walk(list) {
          for (const rule of list) {
            if (rule.cssRules) walk(rule.cssRules);
            if (rule.selectorText && rule.style && /(?:d?vh|safe-area-inset)/.test(rule.style.cssText)) {
              const css = rule.style.cssText.replace(/([\d.]+)dvh/g, (_, n) => `${Number(n) * 7.44}px`)
                .replace(/([\d.]+)vh/g, (_, n) => `${Number(n) * 8.44}px`)
                .replace(/env\(safe-area-inset-top(?:,[^)]*)?\)/g, '0px')
                .replace(/env\(safe-area-inset-bottom(?:,[^)]*)?\)/g, '34px');
              rules += `${rule.selectorText}{${css.replace(/;/g, ' !important;')}}`;
            }
          }
        }
        for (const sheet of document.styleSheets) walk(sheet.cssRules);
        style.textContent = rules;
        document.head.append(style);
        const dialog = document.querySelector('[role="dialog"]');
        // Pin substituted values inline so Vite HMR cannot remove the probe style.
        for (const rule of style.sheet.cssRules) {
          if (dialog.matches(rule.selectorText)) {
            for (const property of rule.style) dialog.style.setProperty(property, rule.style.getPropertyValue(property), 'important');
          }
        }
        style.remove();
        const toolbar = document.createElement('div');
        toolbar.id = 'simulated-safari-toolbar';
        toolbar.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;height:100px;z-index:99999;background:black';
        document.body.append(toolbar);
      });
      await page.waitForTimeout(300);
      const dialog = page.getByRole('dialog');
      await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const geometry = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const button = [...dialog.querySelectorAll('button')].find(el => el.textContent === 'Save Data');
        const d = dialog.getBoundingClientRect(), b = button.getBoundingClientRect();
        const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return { top: d.top, bottom: d.bottom, saveBottom: b.bottom, scrollTop: dialog.scrollTop,
          clearance: 744 - b.bottom, reachable: button === hit || button.contains(hit) };
      });
      console.log(name, 'toolbar visible + 34px safe area', geometry);
      assert.ok(geometry.scrollTop > 0, `${name}: modal must scroll`);
      assert.ok(geometry.top >= 0, `${name}: modal top must remain visible`);
      assert.ok(geometry.bottom <= 744, `${name}: modal extends beneath Safari toolbar`);
      assert.ok(geometry.clearance >= 34, `${name}: Save Data needs safe-area clearance`);
      assert.ok(geometry.reachable, `${name}: Save Data is obscured`);
      // Reduced-height viewports cover toolbar/keyboard-size changes; scroll to
      // the final action after each resize and check hit testing, not just CSS.
      await page.evaluate(() => {
        document.querySelector('#simulated-safari-toolbar').remove();
        const dialog = document.querySelector('[role="dialog"]');
        for (const property of ['top', 'max-height', 'padding-bottom']) dialog.style.removeProperty(property);
      });
      for (const height of [664, 420, 300, 844]) {
        await page.setViewportSize({ width: 390, height });
        await page.waitForTimeout(300);
        await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
        const box = await page.getByRole('button', { name: 'Save Data', exact: true }).boundingBox();
        assert.ok(box.y >= 0 && box.y + box.height <= height, `${name}: save not visible at height ${height}`);
        assert.ok(await page.getByRole('button', { name: 'Save Data', exact: true }).evaluate(el => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return el === hit || el.contains(hit);
        }), `${name}: save not reachable at height ${height}`);
        console.log(name, `height=${height}: Save Data visible and hit-test reachable`);
      }
      await page.setViewportSize({ width: 1024, height: 900 });
      await page.waitForTimeout(300);
      await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
      const desktop = await dialog.boundingBox();
      assert.ok(Math.abs(desktop.y + desktop.height / 2 - 450) <= 2, `${name}: desktop dialog must remain centered`);
      assert.ok(desktop.width <= 425, `${name}: desktop width must remain bounded`);
      console.log(name, 'desktop: centered with 425px maximum width');
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
