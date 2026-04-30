import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'Auralis_mock_zenith.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const references = [];
const linkPattern = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
const scriptPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

for (const pattern of [linkPattern, scriptPattern]) {
  let match;
  while ((match = pattern.exec(html)) !== null) {
    references.push(match[1]);
  }
}

const localReferences = references
  .map((value) => value.split('?')[0].split('#')[0])
  .filter((value) => value && !/^(https?:)?\/\//i.test(value) && !value.startsWith('data:'));

const missing = localReferences.filter((value) => {
  const absolutePath = path.resolve(root, value.replaceAll('/', path.sep));
  return !absolutePath.startsWith(root) || !fs.existsSync(absolutePath);
});

if (missing.length > 0) {
  console.error('Missing static asset references:');
  for (const value of missing) console.error(`- ${value}`);
  process.exit(1);
}

console.log(`Verified ${localReferences.length} local static asset references.`);
