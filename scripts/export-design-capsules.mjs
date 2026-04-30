import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { createAuralisServer } from '../server/app.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const DESIGN_CAPSULE_SCREENS = Object.freeze([
  'home',
  'library',
  'search',
  'player',
  'album-detail',
  'artist-detail',
  'playlist-detail',
  'queue',
  'settings',
  'setup'
]);

export function resolveScreens(value = 'all') {
  const raw = String(value || 'all').trim().toLowerCase();
  if (!raw || raw === 'all') return [...DESIGN_CAPSULE_SCREENS];

  const requested = raw.split(',').map((item) => item.trim()).filter(Boolean);
  const unknown = requested.filter((item) => !DESIGN_CAPSULE_SCREENS.includes(item));
  if (unknown.length) {
    throw new Error(`Unknown screen "${unknown[0]}". Use one of: ${DESIGN_CAPSULE_SCREENS.join(', ')}, all`);
  }
  return requested;
}

export function buildStandaloneHtml({ screen, appMarkup, cssText, sourceUrl }) {
  const title = `${toTitle(screen)} standalone design capsule`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
${cssText}

/* Design capsule wrapper: keeps the exported app centered when opened alone. */
html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  min-height: 100vh;
  display: grid;
  place-items: center;
  overflow: hidden;
}
  </style>
</head>
<body data-design-capsule="${escapeHtml(screen)}">
  <!--
    Source: ${escapeHtml(sourceUrl)}
    This file is a static one-file snapshot for AI Studio design exploration.
    Bring approved design changes back into the real repo source files.
  -->
${appMarkup}
</body>
</html>
`;
}

async function exportScreen({ browser, origin, screen, outputRoot }) {
  const page = await browser.newPage({ viewport: { width: 620, height: 1210 }, deviceScaleFactor: 1 });
  const sourceUrl = `${origin}/Auralis_mock_zenith.html?designSandbox=${encodeURIComponent(screen)}&capsule=1`;

  await page.goto(sourceUrl, { waitUntil: 'load' });
  await page.waitForTimeout(900);

  const snapshot = await page.evaluate((targetScreen) => {
    const cssText = Array.from(document.styleSheets).map((sheet) => {
      try {
        return Array.from(sheet.cssRules || []).map((rule) => rule.cssText).join('\n');
      } catch {
        return '';
      }
    }).filter(Boolean).join('\n\n');

    function screenToDomId(screen) {
      if (screen === 'album-detail') return 'album_detail';
      if (screen === 'artist-detail') return 'artist_profile';
      if (screen === 'playlist-detail') return 'playlist_detail';
      if (screen === 'setup') return 'first-time-setup';
      if (screen === 'search') return 'library';
      return screen || 'home';
    }

    function pruneInactiveChrome(emulator, screenName) {
      const key = String(screenName || '').toLowerCase();
      const keepScreenIds = new Set([screenToDomId(key)]);
      if (key === 'search') keepScreenIds.add('library');

      emulator.querySelectorAll('.screen').forEach((screenEl) => {
        const id = screenEl.id || '';
        const isSetup = id === 'first-time-setup' && key === 'setup';
        const shouldKeep = keepScreenIds.has(id) || isSetup || screenEl.classList.contains('active');
        if (!shouldKeep) screenEl.remove();
      });

      emulator.querySelectorAll('.player-overlay').forEach((overlay) => {
        if ((key !== 'player' && key !== 'queue') || !overlay.classList.contains('active')) {
          overlay.remove();
        }
      });

      emulator.querySelectorAll('.sheet-scrim, .confirm-scrim, .modal-scrim').forEach((overlay) => {
        const visible = overlay.classList.contains('active') || overlay.style.display === 'block';
        if (!visible) overlay.remove();
      });

      emulator.querySelectorAll('[style*="display: none"], [hidden]').forEach((node) => {
        if (!node.classList?.contains('screen')) node.remove();
      });

      return emulator;
    }

    const emulator = document.querySelector('.emulator');
    return {
      appMarkup: emulator ? pruneInactiveChrome(emulator.cloneNode(true), targetScreen).outerHTML : document.body.innerHTML,
      cssText
    };
  }, screen);

  await page.close();

  const html = buildStandaloneHtml({
    screen,
    appMarkup: snapshot.appMarkup,
    cssText: snapshot.cssText,
    sourceUrl
  });

  const outDir = path.join(outputRoot, screen);
  const outFile = path.join(outDir, `${screen}-standalone.html`);
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, html, 'utf8');
  return outFile;
}

async function exportDesignCapsules({ screens, outputRoot }) {
  const backend = createAuralisServer({
    rootDir,
    dataDir: path.join(rootDir, '.tmp-design-export'),
    port: 0,
    quiet: true
  });
  const started = await backend.start();
  const browser = await chromium.launch();

  try {
    const files = [];
    for (const screen of screens) {
      files.push(await exportScreen({
        browser,
        origin: started.origin,
        screen,
        outputRoot
      }));
    }
    return files;
  } finally {
    await browser.close();
    await backend.stop();
  }
}

function readCliOptions(argv) {
  const options = {
    screen: 'all',
    output: path.join(rootDir, 'design-exports')
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--screen' || arg === '-s') {
      options.screen = argv[index + 1] || 'all';
      index += 1;
    } else if (arg === '--out' || arg === '-o') {
      options.output = path.resolve(rootDir, argv[index + 1] || 'design-exports');
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }
  return options;
}

function printHelp() {
  console.log(`Export one-file design capsules for AI Studio.

Usage:
  node scripts/export-design-capsules.mjs --screen library
  node scripts/export-design-capsules.mjs --screen all
  node scripts/export-design-capsules.mjs --screen home,library,player --out design-exports

Screens:
  ${DESIGN_CAPSULE_SCREENS.join(', ')}`);
}

function toTitle(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


if (path.resolve(process.argv[1] || '') === __filename) {
  const options = readCliOptions(process.argv.slice(2));
  if (options.help) {
    printHelp();
  } else {
    const screens = resolveScreens(options.screen);
    const files = await exportDesignCapsules({ screens, outputRoot: options.output });
    files.forEach((file) => console.log(`Exported ${path.relative(rootDir, file)}`));
  }
}
