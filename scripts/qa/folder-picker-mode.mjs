import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const sourcePath = path.join(repoRoot, 'src', 'js', 'auralis-core', '06-setup-init-a11y.js');
const source = await readFile(sourcePath, 'utf8');

assert.match(
    source,
    /function\s+shouldUseSynchronousFallbackPicker\s*\(\)\s*\{[\s\S]*hasFallbackFolderInput\(\)[\s\S]*!shouldUseNativePicker\(\)/,
    'Folder add buttons should use the fallback picker only when native folder access is unavailable.'
);

assert.doesNotMatch(
    source,
    /if\s*\(\s*hasFallbackFolderInput\(\)\s*\)\s*\{\s*console\.log\('\[Auralis\]\[FolderPicker\] (Settings|Setup) Add Folder using synchronous fallback path'/,
    'Folder add buttons must not force the fallback picker when the native picker is available.'
);
