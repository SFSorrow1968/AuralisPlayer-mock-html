const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const jsDir = path.join(root, 'src', 'js', 'auralis-core');
const cssDir = path.join(root, 'src', 'styles');

const requiredFiles = [
  'src/js/auralis-core/00a-runtime-logger.js',
  'src/js/auralis-core/00b-strings.js',
  'docs/runtime-architecture.md',
  'scripts/verify-criteria.js'
];

const results = [];

function add(status, code, message, details = '') {
  results.push({ status, code, message, details });
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function listFiles(dir, extension) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(extension))
    .map((name) => path.join(dir, name));
}

function countLines(text) {
  return text.split(/\r?\n/).length;
}

function checkRequiredFiles() {
  requiredFiles.forEach((file) => {
    const exists = fs.existsSync(path.join(root, file));
    add(exists ? 'PASS' : 'FAIL', 'FOUNDATION_FILE', `${file} exists`);
  });
}

function appearsBefore(text, firstMarker, secondMarker) {
  const first = text.indexOf(firstMarker);
  const second = text.indexOf(secondMarker);
  return first !== -1 && second !== -1 && first < second;
}

function checkRuntimeFoundationDefinitions() {
  const shell = read('src/js/auralis-core/00-shell-state-helpers.js');
  const loggerPath = 'src/js/auralis-core/00a-runtime-logger.js';
  const stringsPath = 'src/js/auralis-core/00b-strings.js';
  const loggerText = fs.existsSync(path.join(root, loggerPath)) ? read(loggerPath) : '';
  const stringsText = fs.existsSync(path.join(root, stringsPath)) ? read(stringsPath) : '';
  add(
    shell.includes('const AuralisDiagnostics') || loggerText.includes('const AuralisDiagnostics')
      ? 'PASS' : 'FAIL',
    'FOUNDATION_LOGGER',
    'runtime diagnostics are defined'
  );
  add(
    shell.includes('const AuralisStrings') || loggerText.includes('const AuralisStrings') || stringsText.includes('const AuralisStrings')
      ? 'PASS' : 'FAIL',
    'FOUNDATION_STRINGS',
    'shared runtime strings are defined'
  );
}

function checkShardSizes() {
  listFiles(jsDir, '.js').forEach((file) => {
    const lines = countLines(fs.readFileSync(file, 'utf8'));
    const relative = path.relative(root, file);
    add(
      lines <= 500 ? 'PASS' : 'WARN',
      'S7_SHARD_SIZE',
      `${relative} has ${lines} lines`,
      'North-star target is <= 500 lines.'
    );
  });
}

function checkCssImportant() {
  let count = 0;
  listFiles(cssDir, '.css').forEach((file) => {
    const text = fs.readFileSync(file, 'utf8');
    count += (text.match(/!important/g) || []).length;
  });
  add(
    count === 0 ? 'PASS' : 'WARN',
    'S34_IMPORTANT',
    `${count} CSS !important declarations found`,
    'Known future styling cleanup target.'
  );
}

function checkStorageGuard() {
  const shell = read('src/js/auralis-core/00-shell-state-helpers.js');
  const safeStorageStart = shell.indexOf('const safeStorage');
  const safeStorageEnd = shell.indexOf('function createEmitter', safeStorageStart);
  const safeStorageBlock = safeStorageStart === -1 || safeStorageEnd === -1
    ? ''
    : shell.slice(safeStorageStart, safeStorageEnd);
  const reporterStart = shell.indexOf('function reportStorageIssue');
  const reporterEnd = shell.indexOf('function warnIfLargeStorageWrite', reporterStart);
  const reporterBlock = reporterStart === -1 || reporterEnd === -1
    ? ''
    : shell.slice(reporterStart, reporterEnd);
  const storageReportCalls = safeStorageBlock.match(/reportStorageIssue\(/g) || [];
  add(
    shell.includes('LOCAL_STORAGE_WARN_BYTES') ? 'PASS' : 'FAIL',
    'S4_STORAGE_GUARD',
    'localStorage size warning guard is present'
  );
  add(
    shell.includes('warnIfLargeStorageWrite') ? 'PASS' : 'FAIL',
    'S4_STORAGE_WARN',
    'large localStorage writes are reported'
  );
  add(
    storageReportCalls.length >= 6
      && reporterBlock.includes('AuralisDiagnostics.error')
      && reporterBlock.includes('AuralisDiagnostics.warn') ? 'PASS' : 'FAIL',
    'S31_STORAGE_LOGGING',
    'safeStorage routes issues through diagnostics'
  );
}

function checkSilentCatchBlocks() {
  const offenders = [];
  listFiles(jsDir, '.js').forEach((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const matches = text.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) || [];
    if (matches.length) offenders.push(`${path.relative(root, file)} (${matches.length})`);
  });
  add(
    offenders.length === 0 ? 'PASS' : 'WARN',
    'S31_SILENT_CATCH',
    offenders.length ? offenders.join(', ') : 'No empty catch blocks found',
    'Known future robustness cleanup target.'
  );
}

function checkRuntimeHook() {
  const compat = read('src/js/auralis-core/11-events-compat.js');
  add(
    /window\.Auralis\.__runVerification\s*=/.test(compat) ? 'PASS' : 'FAIL',
    'RUNTIME_HOOK',
    'window.Auralis.__runVerification hook is present'
  );
}

function printResults() {
  const order = { FAIL: 0, WARN: 1, PASS: 2 };
  results.sort((a, b) => order[a.status] - order[b.status] || a.code.localeCompare(b.code));
  results.forEach((result) => {
    const detail = result.details ? ` (${result.details})` : '';
    console.log(`[${result.status}] ${result.code}: ${result.message}${detail}`);
  });
  const failures = results.filter((result) => result.status === 'FAIL');
  const warnings = results.filter((result) => result.status === 'WARN');
  console.log('');
  if (failures.length) {
    console.log(`VERIFICATION FAILED: ${failures.length} failure(s), ${warnings.length} warning(s).`);
    process.exitCode = 1;
    return;
  }
  console.log(`FOUNDATION CHECKS PASSED: ${warnings.length} north-star warning(s) remain.`);
}

checkRequiredFiles();
checkRuntimeFoundationDefinitions();
checkShardSizes();
checkCssImportant();
checkStorageGuard();
checkSilentCatchBlocks();
checkRuntimeHook();
printResults();
