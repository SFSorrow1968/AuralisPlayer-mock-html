import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStandaloneHtml,
  resolveScreens
} from '../scripts/export-design-capsules.mjs';

test('resolveScreens supports all screens and rejects unknown names', () => {
  assert.deepEqual(resolveScreens('library'), ['library']);
  assert.ok(resolveScreens('all').includes('player'));
  assert.throws(() => resolveScreens('made-up-screen'), /Unknown screen/);
});

test('buildStandaloneHtml produces a single-file design capsule shell', () => {
  const html = buildStandaloneHtml({
    screen: 'library',
    appMarkup: '<div class="emulator"><div id="library" class="screen active">Library</div></div>',
    cssText: '.screen{color:white;}',
    sourceUrl: 'http://127.0.0.1:8787/Auralis_mock_zenith.html?designSandbox=library'
  });

  assert.match(html, /Library standalone design capsule/);
  assert.match(html, /\.screen\{color:white;\}/);
  assert.match(html, /<div class="emulator">/);
  assert.doesNotMatch(html, /<script src=/);
  assert.doesNotMatch(html, /<link rel="stylesheet"/);
});
