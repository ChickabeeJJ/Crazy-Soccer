// Post-build: report bundle size / file count (CrazyGames limits: <=250MB total, <=1500 files, <=50MB initial)
// and package dist/ into crazy-soccer-html5.zip ready for upload.
import { readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const dist = 'dist';
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
try {
  execSync(`cd ${dist} && zip -qr ../${zip} .`, { stdio: 'inherit' });
} catch (e) {
  execSync(`python3 -c "import shutil; shutil.make_archive('crazy-soccer-html5', 'zip', '${dist}')"`, { stdio: 'inherit' });
}
console.log(`Packaged ${zip} (upload this to the CrazyGames developer portal).`);
