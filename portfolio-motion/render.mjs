// Usage: node render.mjs stills 1.0 3.0 ...   |   node render.mjs video out.mp4 [fps]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const [mode, ...args] = process.argv.slice(2);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => { window.__RENDER__ = true; });
await page.route('**/*', route => {
  const url = route.request().url();
  if (url.includes('cdnjs.cloudflare.com/ajax/libs/gsap')) {
    return route.fulfill({ contentType: 'text/javascript', body: readFileSync(path.join(dir, 'node_modules/gsap/dist/gsap.min.js')) });
  }
  if (url.startsWith('https://fonts.googleapis.com/css2')) {
    return route.fulfill({ contentType: 'text/css', body: readFileSync(path.join(dir, 'fonts.css')) });
  }
  if (url.startsWith('https://fonts.gstatic.com/')) {
    const f = path.join(dir, 'fonts', url.replace('https://fonts.gstatic.com/', '').replaceAll('/', '_'));
    if (existsSync(f)) return route.fulfill({ contentType: 'font/woff2', body: readFileSync(f) });
  }
  if (url.startsWith('file://')) return route.continue();
  return route.abort();
});
await page.goto('file://' + path.join(dir, 'joshua-motion.html'));
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => typeof window.__seek === 'function');
await page.waitForTimeout(300);

if (mode === 'stills') {
  for (const t of args) {
    await page.evaluate(t => window.__seek(t), Number(t));
    await page.screenshot({ path: path.join(dir, `still-${t}.png`) });
  }
} else {
  const out = args[0], fps = Number(args[1] || 30);
  const dur = await page.evaluate(() => window.__DUR);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(dur * fps);
  for (let i = 0; i <= n; i++) {
    await page.evaluate(t => window.__seek(t), i / fps);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${n}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
if (errors.length) console.log('PAGE ERRORS:', errors);
await browser.close();
