import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { REPO_ROOT } from './shared.mjs';

const currentDir = path.join(REPO_ROOT, 'output', 'playwright', 'screen-fidelity');
const baselineDir = path.join(REPO_ROOT, 'scripts', 'qa', 'baselines', 'screen-fidelity');
const reportDir = path.join(REPO_ROOT, 'output', 'playwright', 'screen-baseline');
const reportPath = path.join(reportDir, 'screen-baseline-report.json');

await mkdir(reportDir, { recursive: true });

async function listPngs(dir) {
    try {
        return (await readdir(dir)).filter((name) => name.endsWith('.png')).sort();
    } catch (_) {
        return [];
    }
}

const baseline = await listPngs(baselineDir);
const current = await listPngs(currentDir);
const missing = baseline.filter((name) => !current.includes(name));
const added = current.filter((name) => !baseline.includes(name));
const changed = [];

for (const name of baseline.filter((entry) => current.includes(entry))) {
    const [left, right] = await Promise.all([
        readFile(path.join(baselineDir, name)),
        readFile(path.join(currentDir, name))
    ]);
    if (!left.equals(right)) changed.push(name);
}

const report = {
    generatedAt: new Date().toISOString(),
    baselineDir,
    currentDir,
    baselineCount: baseline.length,
    currentCount: current.length,
    missing,
    added,
    changed
};

await writeFile(reportPath, JSON.stringify(report, null, 2));

assert.ok(baseline.length > 0, `No baseline PNGs found in ${baselineDir}. Run npm run qa:screens:update-baseline first.`);
assert.deepEqual(missing, [], 'Current screen captures are missing baseline files.');
assert.deepEqual(added, [], 'Current screen captures include files not present in the baseline.');
assert.deepEqual(changed, [], 'Current screen captures differ from the baseline.');

console.log(`[qa:screens:compare] ${baseline.length} screen baselines match.`);
