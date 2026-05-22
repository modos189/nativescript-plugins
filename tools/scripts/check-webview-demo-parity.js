#!/usr/bin/env node
// Verifies that webview-x.xml and webview-x-gecko.xml demo pages are identical
// except for the xmlns:wv namespace line (the only intentional difference).

const fs = require('fs');
const path = require('path');

const DEMOS_DIR = path.join(__dirname, '../../apps/demo/src/plugin-demos');
const FILES = ['webview-x.xml', 'webview-x-gecko.xml'];
const XMLNS_WV_RE = /^\s*xmlns:wv="[^"]+"/;

function normalize(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => !XMLNS_WV_RE.test(line))
    .join('\n');
}

const [a, b] = FILES.map((f) => normalize(path.join(DEMOS_DIR, f)));

if (a !== b) {
  console.error(`\n✗ Demo parity check failed: ${FILES[0]} and ${FILES[1]} have diverged.\n` + `  These files must be identical except for the xmlns:wv namespace line.\n` + `  Update both files together to keep the API parity demonstration accurate.\n`);
  process.exit(1);
}

console.log(`✓ Demo parity OK: ${FILES.join(' == ')}`);
