// Run: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/add-data-modal.browser.mjs
// Add MODAL_BASELINE=1 to replay 2017b26 (expected geometry failures).
// Real form + Radix + app CSS; no auth, submissions, or API writes.
// Headless engines cannot reproduce native Safari chrome/keyboard/pinch gestures.
// Inject their VisualViewport contract and independently model dvh/safe areas.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import tailwindcss from 'tailwindcss';
import loadTailwindConfig from 'tailwindcss/loadConfig.js';
import autoprefixer from 'autoprefixer';
const baselineForm = process.env.MODAL_BASELINE === '1' ? execFileSync('git', ['show', '2017b26:src/components/AddDataForm.tsx'], { encoding: 'utf8' }) : null;
const tailwindConfig = baselineForm ? loadTailwindConfig(new URL('../tailwind.config.ts', import.meta.url).pathname) : null;
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await createServer({
  server: { port: 0 },
  // Replay the baseline component with its generated utilities as well as JSX.
  // Reading historical JSX alone misses classes no longer present on disk.
  ...(baselineForm ? { css: { postcss: { plugins: [tailwindcss({ ...tailwindConfig, content: [...tailwindConfig.content, { raw: baselineForm, extension: 'tsx' }] }), autoprefixer()] } } } : {}),
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
      if (baselineForm && id.split('?')[0].endsWith('/src/components/AddDataForm.tsx')) return baselineForm;
      if (id === '/__modal-test.tsx') return `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {AddDataForm} from '/src/components/AddDataForm.tsx';
        import '/src/index.css';
        function Harness(){const [open,setOpen]=React.useState(true);return <><button onClick={()=>setOpen(true)}>Reopen</button><AddDataForm open={open} onOpenChange={setOpen} onSuccess={()=>{}}/></>}
        createRoot(document.getElementById('root')).render(<Harness/>);`;
    },
  }],
});
await server.listen();
const failures = [];
let checks = 0;
try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 3 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/rest/v1/**', route => route.abort());
      await page.addInitScript(() => {
        const viewport = Object.assign(new EventTarget(), { width: 390, height: 844, offsetTop: 0, offsetLeft: 0, scale: 1 });
        Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
        window.setTestViewport = (values, event) => {
          Object.assign(viewport, values);
          if (!event || event === 'resize') viewport.dispatchEvent(new Event('resize'));
          if (!event || event === 'scroll') viewport.dispatchEvent(new Event('scroll'));
        };
      });
      await page.goto(`${server.resolvedUrls.local[0]}__modal-test.html`);
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await page.getByPlaceholder('150.0', { exact: true }).fill('150');
      await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(el => el.textContent === 'Save Data')?.disabled);
      await page.waitForTimeout(400);
      const scenarios = [
        { label: 'expanded chrome', width: 390, layoutHeight: 844, height: 664, dvh: 664, offsetTop: 0, safeTop: 0, safeBottom: 34 },
        { label: 'collapsed chrome', width: 390, layoutHeight: 844, height: 844, dvh: 844, offsetTop: 0, safeTop: 0, safeBottom: 34 },
        { label: 'panned visual viewport', width: 390, layoutHeight: 844, height: 600, dvh: 744, offsetTop: 80, safeTop: 0, safeBottom: 34 },
        { label: 'screenshot-shaped top + button-edge clipping', width: 390, layoutHeight: 844, height: 560, dvh: 744, offsetTop: 50, safeTop: 0, safeBottom: 34 },
        { label: 'keyboard focused + panned', width: 390, layoutHeight: 844, height: 300, dvh: 744, offsetTop: 140, safeTop: 0, safeBottom: 0, focus: true },
        { label: 'keyboard dismissed', width: 390, layoutHeight: 844, height: 744, dvh: 744, offsetTop: 0, safeTop: 0, safeBottom: 34 },
        { label: 'zoom 150% + horizontal pan', width: 390, visualWidth: 260, layoutHeight: 844, height: 440, dvh: 744, offsetTop: 100, offsetLeft: 40, scale: 1.5, safeTop: 0, safeBottom: 0 },
        { label: 'below sm breakpoint', width: 639, layoutHeight: 700, height: 500, dvh: 600, offsetTop: 70, safeTop: 20, safeBottom: 20 },
        { label: 'at sm breakpoint', width: 640, layoutHeight: 700, height: 500, dvh: 600, offsetTop: 70, safeTop: 20, safeBottom: 20 },
        { label: 'landscape short viewport', width: 844, layoutHeight: 390, height: 260, dvh: 350, offsetTop: 40, safeTop: 0, safeBottom: 20 },
        { label: 'desktop centered', width: 1024, layoutHeight: 900, height: 900, dvh: 900, offsetTop: 0, safeTop: 0, safeBottom: 0 },
      ];
      for (const scenario of scenarios) {
        const { width, layoutHeight } = scenario;
        await page.setViewportSize({ width, height: layoutHeight });
        await page.evaluate(s => {
          document.querySelector('#viewport-probe')?.remove();
          // Substitute only viewport units and safe areas. Preserve media queries
          // and var() expressions, so no production positioning policy is mocked.
          const style = document.createElement('style');
          style.id = 'viewport-probe';
          function walk(rules) {
            let result = '';
            for (const rule of rules) {
              if (rule.selectorText && rule.style) {
                const css = rule.style.cssText.replace(/([\d.]+)dvh/g, (_, n) => `${Number(n) * s.dvh / 100}px`)
                  .replace(/([\d.]+)vh/g, (_, n) => `${Number(n) * s.layoutHeight / 100}px`)
                  .replace(/env\(safe-area-inset-top(?:,[^)]*)?\)/g, `${s.safeTop}px`)
                  .replace(/env\(safe-area-inset-bottom(?:,[^)]*)?\)/g, `${s.safeBottom}px`);
                result += `${rule.selectorText}{${css}}`;
              } else if (rule.cssRules && rule.conditionText) {
                result += `@media ${rule.conditionText}{${walk(rule.cssRules)}}`;
              } else {
                result += rule.cssText;
              }
            }
            return result;
          }
          style.textContent = [...document.styleSheets].map(sheet => walk(sheet.cssRules)).join('');
          document.head.append(style);
          window.setTestViewport({ width: s.visualWidth || s.width, height: s.height, offsetTop: s.offsetTop, offsetLeft: s.offsetLeft || 0, scale: s.scale || 1 });
          for (const el of document.querySelectorAll('.chrome-mask')) el.remove();
          for (const [top, height] of [[0, s.offsetTop], [s.offsetTop + s.height, s.layoutHeight - s.offsetTop - s.height]]) {
            if (height <= 0) continue;
            const mask = document.createElement('div');
            mask.className = 'chrome-mask';
            mask.style.cssText = `position:fixed;left:0;top:${top}px;height:${height}px;width:100%;z-index:99999;background:black;pointer-events:auto`;
            document.body.append(mask);
          }
          const input = document.querySelector('textarea');
          if (s.focus) input.focus(); else input.blur();
        }, scenario);
        await page.waitForTimeout(350);
        await dialog.evaluate(el => { el.scrollTop = 0; });
        const top = await dialog.evaluate(el => {
          const d = el.getBoundingClientRect(), title = el.querySelector('h2').getBoundingClientRect();
          const css = getComputedStyle(el);
          return { top: d.top, bottom: d.bottom, left: d.left, right: d.right, titleTop: title.top, titleBottom: title.bottom, transform: css.transform, cssTop: css.top, maxHeight: css.maxHeight, classes: el.className };
        });
        await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
        const bottom = await dialog.evaluate(el => {
          const d = el.getBoundingClientRect();
          return { scrollTop: el.scrollTop, dialogBottom: d.bottom, buttons: [...el.querySelectorAll('button')].filter(b => ['Save Data', 'Cancel'].includes(b.textContent.trim())).map(b => {
            const r = b.getBoundingClientRect();
            const points = [[r.left+8,r.top+1],[r.right-8,r.top+1],[r.left+8,r.bottom-1],[r.right-8,r.bottom-1]];
            return { name: b.textContent.trim(), top: r.top, bottom: r.bottom, hit: points.every(([x,y]) => { const hit = document.elementFromPoint(x,y);return b === hit || b.contains(hit); }) };
          }) };
        });
        const check = (condition, message) => { checks++; if (!condition) failures.push(`${name} ${scenario.label}: ${message}`); };
        check(top.top >= scenario.offsetTop + 16 + scenario.safeTop - 1, `dialog top ${top.top} outside visible start ${scenario.offsetTop}`);
        check(top.titleTop >= Math.max(top.top, scenario.offsetTop) && top.titleBottom <= scenario.offsetTop + scenario.height, `title clipped (${top.titleTop}..${top.titleBottom})`);
        check(top.bottom <= scenario.offsetTop + scenario.height - 16 - scenario.safeBottom + 1, `dialog bottom ${top.bottom} outside visible end ${scenario.offsetTop + scenario.height}`);
        check(top.left >= (scenario.offsetLeft || 0) - 1 && top.right <= (scenario.offsetLeft || 0) + (scenario.visualWidth || width) + 1, 'dialog overflows visual width');
        check(bottom.buttons.length === 2, 'both actions must exist');
        for (const b of bottom.buttons) {
          check(b.top >= Math.max(top.top, scenario.offsetTop) && b.bottom <= Math.min(bottom.dialogBottom, scenario.offsetTop + scenario.height) - scenario.safeBottom, `${b.name} clipped (${b.top}..${b.bottom})`);
          check(b.hit, `${b.name} corners fail hit testing`);
        }
        if (width >= 640) check(Math.abs((top.top + top.bottom) / 2 - (scenario.offsetTop + (scenario.height + scenario.safeTop - scenario.safeBottom) / 2)) <= 1, 'desktop/breakpoint centering uses layout rather than safe visual viewport');
        console.log(name, scenario.label, JSON.stringify({ ...top, classes: undefined, ...bottom }));
      }
      // Event seams: panning can emit scroll without a resize; keyboard changes
      // can emit resize without a scroll. Exercise each independently.
      await page.evaluate(() => window.setTestViewport({ offsetTop: 20 }, 'scroll'));
      await page.waitForTimeout(250);
      const scrollOnly = await dialog.boundingBox();
      checks++;
      if (Math.abs(scrollOnly.y - 41) > 1) failures.push(`${name}: scroll-only viewport offset ignored`);
      await page.evaluate(() => window.setTestViewport({ height: 600 }, 'resize'));
      await page.waitForTimeout(250);
      const resizeOnly = await dialog.boundingBox();
      checks++;
      if (!(resizeOnly.y >= 36 && resizeOnly.y + resizeOnly.height <= 604)) failures.push(`${name}: resize-only viewport height ignored`);
      // Reopen in a reduced/panned viewport to cover initial measurement, not just events.
      await page.evaluate(() => window.setTestViewport({ width: 1024, height: 500, offsetTop: 100 }));
      await page.getByRole('button', { name: 'Close', exact: true }).evaluate(el => el.click());
      await page.getByRole('button', { name: 'Reopen', exact: true }).click();
      await dialog.waitFor();
      await page.waitForTimeout(350);
      const reopened = await dialog.boundingBox();
      checks++;
      if (!(reopened.y >= 116 && reopened.y + reopened.height <= 584)) failures.push(`${name}: reopened modal ignores visual viewport`);
      assert.deepEqual(errors, [], `${name}: browser runtime errors`);
      await page.close();
      // Real engine VisualViewport and the CSS-only fallback, without simulated
      // chrome. This also protects the no-VisualViewport compatibility path.
      for (const fallback of [false, true]) {
        const native = await browser.newPage({ viewport: { width: 390, height: 664 }, isMobile: true });
        if (fallback) await native.addInitScript(() => Object.defineProperty(window, 'visualViewport', { value: null }));
        await native.goto(`${server.resolvedUrls.local[0]}__modal-test.html`);
        const modal = native.getByRole('dialog');
        await modal.waitFor();
        await native.waitForTimeout(350);
        const title = await native.getByRole('heading', { name: 'Add Fitness Data' }).boundingBox();
        checks++;
        if (!(title.y >= 16 && title.y + title.height <= 648)) failures.push(`${name}: native/fallback title clipped`);
        await modal.evaluate(el => { el.scrollTop = el.scrollHeight; });
        for (const action of ['Cancel', 'Save Data']) {
          const box = await native.getByRole('button', { name: action, exact: true }).boundingBox();
          checks++;
          if (!(box.y >= 16 && box.y + box.height <= 648)) failures.push(`${name}: native/fallback ${action} clipped`);
        }
        console.log(name, fallback ? 'CSS fallback (no VisualViewport)' : 'native engine VisualViewport', 'title and both buttons visible');
        await native.close();
      }
    } finally { await browser.close(); }
  }
} finally { await server.close(); }
console.log(`${checks} geometry assertions; ${failures.length} failures`);
assert.deepEqual(failures, [], failures.join('\n'));
