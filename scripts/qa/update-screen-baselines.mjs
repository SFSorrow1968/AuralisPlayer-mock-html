import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { REPO_ROOT } from './shared.mjs';

const sourceDir = path.join(REPO_ROOT, 'output', 'playwright', 'screen-fidelity');
const baselineDir = path.join(REPO_ROOT, 'scripts', 'qa', 'baselines', 'screen-fidelity');

await mkdir(baselineDir, { recursive: true });

const pngs = (await readdir(sourceDir)).filter((name) => name.endsWith('.png')).sort();
if (!pngs.length) {
    throw new Error(`No screen captures found in ${sourceDir}. Run npm run qa:screens first.`);
}

for (const name of pngs) {
    await copyFile(path.join(sourceDir, name), path.join(baselineDir, name));
}

await writeFile(path.join(baselineDir, 'manifest.json'), JSON.stringify({
    updatedAt: new Date().toISOString(),
    screens: pngs
}, null, 2));

console.log(`[qa:screens:update-baseline] Updated ${pngs.length} baselines.`);
