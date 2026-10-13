// Post-build: report bundle size / file count (CrazyGames limits: <=250MB total, <=1500 files, <=50MB initial)
// and package dist/ into crazy-soccer-html5.zip ready for upload.
import { readdirSync, statSync, existsSync, rmSync, renameSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const dist = 'dist';
// The source page is game.html: CrazyGames (and Vercel) need it to be index.html
if (existsSync(join(dist, 'game.html'))) renameSync(join(dist, 'game.html'), join(dist, 'index.html'));
let files = 0, bytes = 0;
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else { files++; bytes += st.size; }
  }
};
walk(dist);
console.log(`\nCrazy Soccer build: ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
if (files > 1500 || bytes > 50 * 1024 * 1024) { console.error('Build exceeds CrazyGames limits!'); process.exit(1); }

const zip = 'crazy-soccer-html5.zip';
if (existsSync(zip)) rmSync(zip);
// Packaging is a convenience only: never fail the build (e.g. on hosts without zip/python).
let packaged = false;
for (const cmd of [`cd ${dist} && zip -qr ../${zip} .`, `python3 -c "import shutil; shutil.make_archive('crazy-soccer-html5', 'zip', '${dist}')"`]) {
  try { execSync(cmd, { stdio: 'ignore' }); packaged = true; break; } catch (e) { /* try next */ }
}
console.log(packaged ? `Packaged ${zip} (upload this to the CrazyGames developer portal).` : 'Skipped zip packaging (no zip tool available). Upload the dist/ folder contents.');

// Publish the finished game at the repo root too (index.html + assets + music + favicon), so a plain
// GitHub "Download ZIP" of the repository can be uploaded to CrazyGames as it is.
for (const f of ['index.html', 'favicon.png', 'assets', 'music']) {
  if (existsSync(f)) rmSync(f, { recursive: true, force: true });
  if (existsSync(join(dist, f))) cpSync(join(dist, f), f, { recursive: true });
}
console.log('Copied the built game to the repo root (index.html, assets/, music/).');
