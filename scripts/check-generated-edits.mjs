import { execFileSync } from 'node:child_process';

function changedFiles(args) {
    const output = execFileSync('git', args, { encoding: 'utf8' }).trim();
    return output ? output.split(/\r?\n/).map(line => line.trim()).filter(Boolean) : [];
}

const files = new Set([
    ...changedFiles(['diff', '--name-only']),
    ...changedFiles(['diff', '--cached', '--name-only'])
]);

const bundleChanged = files.has('auralis-core.js');
const sourceChanged = Array.from(files).some(file => file.startsWith('src/js/auralis-core/'));

if (bundleChanged && !sourceChanged) {
    console.error('auralis-core.js changed without a matching source shard change.');
    console.error('Edit src/js/auralis-core/* first, then rebuild with npm run build.');
    process.exit(1);
}

console.log('Generated-file guard passed.');
