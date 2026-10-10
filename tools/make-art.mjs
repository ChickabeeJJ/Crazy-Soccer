// Renders the CrazyGames submission art with the real game engine.
//   1) npx vite --port 5199   (in another terminal)
//   2) node tools/make-art.mjs [covers|videos|preview]
// Output: art/ (cover-landscape.png 1920x1080, cover-portrait.png 800x1200, cover-square.png 800x800,
//         preview-landscape.mp4 1920x1080, preview-portrait.mp4 1080x1620 — silent H.264, 30 fps, 18 s)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const BASE = process.env.ART_URL || 'http://localhost:5199/tools/art.html';
const OUT = process.env.ART_OUT || 'art';
mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] || 'covers';
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function cover(shot, w, h) {
  const browser = await launch();
  // Render at 2x and let the browser downsample for smooth edges
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}?shot=${shot}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.evaluate(() => window.__render());
  const buf = await page.locator('#stage').screenshot({ type: 'png' });
  await browser.close();
  // Downscale to the exact required size
  await new Promise((res, rej) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-i', '-', '-vf', `scale=${w}:${h}:flags=lanczos`, `${OUT}/${shot}.png`]);
    ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`))));
    ff.stdin.end(buf);
  });
  console.log(`✓ ${OUT}/${shot}.png (${w}x${h})`);
}

async function video(shot, w, h, file, sample = 0) {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`${BASE}?shot=${shot}`);
  await page.waitForFunction(() => window.__ready === true && window.__frames > 0, null, { timeout: 180000 });
  const frames = await page.evaluate(() => window.__frames);
  const args = sample
    ? ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-vf', `select='not(mod(n\\,${sample}))',scale=480:-2,tile=6x3`, '-frames:v', '1', `${OUT}/${file}`]
    : ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', `${OUT}/${file}`];
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate(() => window.__step());
    const buf = await page.locator('#stage').screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`${shot}: frame ${i}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log(`✓ ${OUT}/${file}`);
}

if (mode === 'covers') {
  await cover('cover-landscape', 1920, 1080);
  await cover('cover-portrait', 800, 1200);
  await cover('cover-square', 800, 800);
} else if (mode === 'preview') {
  await video('video-landscape', 1920, 1080, 'preview-sheet.jpg', 30);
} else if (mode === 'videos') {
  await video('video-landscape', 1920, 1080, 'preview-landscape.mp4');
  await video('video-portrait', 1080, 1620, 'preview-portrait.mp4');
} else if (mode === 'video-landscape') {
  await video('video-landscape', 1920, 1080, 'preview-landscape.mp4');
} else if (mode === 'video-portrait') {
  await video('video-portrait', 1080, 1620, 'preview-portrait.mp4');
}
