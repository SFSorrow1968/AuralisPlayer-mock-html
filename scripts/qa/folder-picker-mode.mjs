import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const sourcePath = path.join(repoRoot, 'src', 'js', 'auralis-core', '06-setup-init-a11y.js');
const folderSourcePath = path.join(repoRoot, 'src', 'js', 'auralis-core', '05-media-folder-idb.js');
const source = await readFile(sourcePath, 'utf8');
const folderSource = await readFile(folderSourcePath, 'utf8');

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

assert.doesNotMatch(
    folderSource,
    /window\.addEventListener\(\s*['"]focus['"]/,
    'The fallback folder picker must not cancel from a focus heuristic while the OS folder dialog is still open.'
);

assert.match(
    folderSource,
    /const\s+hasReadPermission\s*=\s*await\s+verifyPermission\(handle\)[\s\S]*pickerPermissionGrantedHandles\.add\(handle\)/,
    'Native folder permission should be verified immediately after the picker returns, while the selected handle is still fresh.'
);

assert.match(
    source,
    /runSynchronousFallbackFolderPick\(\{[\s\S]*triggerEl:\s+setupAddBtn,[\s\S]*scanAfterAdd:\s+true/,
    'The first-run setup picker should scan immediately after folder selection so browser File objects are not lost.'
);
