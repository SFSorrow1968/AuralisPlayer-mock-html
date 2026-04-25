import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssDir = path.join(repoRoot, 'src', 'styles');
const jsDir = path.join(repoRoot, 'src', 'js', 'auralis-core');

const dynamicTokens = new Set([
    'active',
    'behind',
    'show',
    'playing-row',
    'is-active',
    'is-hidden',
    'is-hidden-category',
    'is-editing',
    'is-playing',
    'is-swiping',
    'is-text',
    'is-dragging',
    'ready',
    'density-compact',
    'density-large',
    'queue-drop-before',
    'queue-drop-after',
    'control-icon',
    'repeat-one',
    'trace-box',
    'is-guessed',
    'is-user',
    'onboarding-layer',
    'video-cover',
    'artist-pill',
    'empty-state-cta'
]);

const dynamicPrefixes = [
    'search-',
    'media-',
    'detail-',
    'blueprint-preview',
    'col-',
    'pill-',
    'library-view-',
    'settings-choice',
    'album-artist-carousel',
    'queue-',
    'mini-',
    'player-',
    'sheet-',
    'zenith-',
    'swipe-'
];

function stripCssComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function collectSelectorTokens(css) {
    const tokens = new Set();
    const rulePattern = /([^{}]+)\{/g;
    let match;
    while ((match = rulePattern.exec(css))) {
        const selector = match[1];
        if (selector.includes('@')) continue;
        for (const part of selector.split(',')) {
            const tokenPattern = /([.#])([A-Za-z_][A-Za-z0-9_-]*)/g;
            let tokenMatch;
            while ((tokenMatch = tokenPattern.exec(part))) {
                tokens.add(tokenMatch[2]);
            }
        }
    }
    return tokens;
}

function isDynamicToken(token) {
    return dynamicTokens.has(token) || dynamicPrefixes.some(prefix => token.startsWith(prefix));
}

async function readFiles(dir, extension) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries
        .filter(entry => entry.isFile() && entry.name.endsWith(extension))
        .map(entry => path.join(dir, entry.name));
    const contents = await Promise.all(files.map(async file => ({ file, text: await readFile(file, 'utf8') })));
    return contents;
}

const cssFiles = await readFiles(cssDir, '.css');
const jsFiles = await readFiles(jsDir, '.js');
const html = await readFile(path.join(repoRoot, 'Auralis_mock_zenith.html'), 'utf8');
const qaFiles = await readFiles(path.join(repoRoot, 'scripts', 'qa'), '.mjs');
const sourceText = [html, ...jsFiles.map(file => file.text), ...qaFiles.map(file => file.text)].join('\n');

const findings = [];
for (const cssFile of cssFiles) {
    const tokens = collectSelectorTokens(stripCssComments(cssFile.text));
    for (const token of tokens) {
        if (isDynamicToken(token)) continue;
        assert.match(token, /^[A-Za-z_][A-Za-z0-9_-]*$/);
        if (!sourceText.includes(token)) {
            findings.push(`${path.relative(repoRoot, cssFile.file)}: ${token}`);
        }
    }
}

if (!findings.length) {
    console.log('No obvious dead selectors found.');
} else {
    console.log(`Possible dead selectors (${findings.length}):`);
    findings.slice(0, 40).forEach(item => console.log(`- ${item}`));
    if (findings.length > 40) console.log(`- ...and ${findings.length - 40} more`);
    if (process.env.STRICT_DEAD_SELECTORS === '1') process.exitCode = 1;
}
