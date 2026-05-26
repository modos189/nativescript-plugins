#!/usr/bin/env node
// Generates README.md for both webview plugins from a single source of truth.
//
// "Implemented" = available in BOTH @modos189/nativescript-webview-x AND @modos189/nativescript-webview-x-gecko.
// "API Reference" = full upstream API from @nativescript-community/ui-webview (informational).
//
// Usage: node tools/scripts/generate-readme.js

const fs = require('fs');
const path = require('path');

// ─── Single source of truth ──────────────────────────────────────────────────

const IMPLEMENTED = {
  statics: [],
  properties: [
    { name: 'src', type: 'string', desc: 'URL to load (data-binding supported)' },
    { name: 'userAgent', type: 'string', desc: 'Set a custom User-Agent string' },
    { name: 'debugMode', type: 'boolean', desc: 'Enable remote WebView debugging' },
    { name: 'supportPopups', type: 'boolean', desc: 'Open `window.open()` / `target="_blank"` links in a native popup. Default: `true`' },
  ],
  methods: [
    { name: 'getTitle()', returns: 'Promise<string | undefined>', desc: 'Return the current page title' },
    { name: 'executeJavaScript(code: string)', returns: 'Promise<any>', desc: 'Execute JavaScript in the page context and return the JSON-serialised result' },
  ],
  events: [
    { name: 'loadStarted', desc: 'Navigation started. `args.url` contains the target URL' },
    { name: 'loadFinished', desc: 'Navigation finished. `args.error` is set on failure' },
    { name: 'loadProgress', desc: 'Android: page load progress. `args.progress` is 0–100' },
    { name: 'titleChanged', desc: 'Page title changed. `args.title` contains the new title' },
    { name: 'popupNavigate', desc: 'Android: fired on each navigation inside a popup; set `args.cancel = true` to intercept and dismiss the popup (e.g. capture OAuth redirect). `args.url` contains the target URL.' },
  ],
};

const API_REFERENCE = {
  properties: [
    { name: 'src', type: 'string', desc: 'URL to load' },
    { name: 'autoInjectJSBridge', type: 'boolean', desc: 'Inject `window.nsWebViewBridge` on load finished. Default: `true`' },
    { name: 'domStorage', type: 'boolean', desc: 'Android: enable DOM Storage API (e.g. `localStorage`)' },
    { name: 'databaseStorage', type: 'boolean', desc: 'Android: enable database storage API' },
    { name: 'builtInZoomControls', type: 'boolean', desc: 'Android: use built-in zoom mechanisms' },
    { name: 'displayZoomControls', type: 'boolean', desc: 'Android: show on-screen zoom controls' },
    { name: 'supportZoom', type: 'boolean', desc: 'Android: enable zoom support' },
    { name: 'cacheMode', type: 'string', desc: 'Android: `default`, `no_cache`, `cache_first`, or `cache_only`' },
    { name: 'debugMode', type: 'boolean', desc: 'Enable Chrome (Android) / Safari (iOS) remote debugger' },
    { name: 'scrollBounce', type: 'boolean', desc: 'iOS: scrollView bounce. Default: `true`' },
    { name: 'viewPortSize', type: 'boolean \\| string \\| ViewPortProperties', desc: 'Set viewport metadata after load' },
    { name: 'limitsNavigationsToAppBoundDomains', type: 'boolean', desc: 'iOS: enable Service Workers' },
    { name: 'supportPopups', type: 'boolean', desc: 'iOS: support `window.open` / `target="_blank"`. Default: `true`' },
    { name: 'scrollBarIndicatorVisible', type: 'boolean', desc: 'Show/hide scrollbars' },
  ],
  methods: [
    { name: 'loadUrl(src: string)', returns: 'Promise<LoadFinishedEventData>', desc: 'Load a URL, resolves when finished' },
    { name: 'executeJavaScript(code: string)', returns: 'Promise<any>', desc: 'Execute JavaScript and return the result' },
    { name: 'executePromise(code: string, timeout?: number)', returns: 'Promise<any>', desc: 'Run a promise inside the webview' },
    { name: 'getTitle()', returns: 'Promise<string>', desc: 'Return `document.title`' },
    { name: 'emitToWebView(eventName: string, data: any)', returns: 'void', desc: 'Emit an event into the webview' },
    { name: 'autoLoadJavaScriptFile(name: string, path: string)', returns: 'void', desc: 'Auto-inject a JS file on every `loadFinished`' },
    { name: 'autoLoadStyleSheetFile(name: string, path: string, insertBefore?: boolean)', returns: 'void', desc: 'Auto-inject a CSS file on every `loadFinished`' },
    { name: 'autoExecuteJavaScript(code: string, name: string)', returns: 'void', desc: 'Auto-execute a script on every `loadFinished`' },
  ],
  events: [
    { name: 'loadStarted', desc: 'Navigation started' },
    { name: 'loadFinished', desc: 'Navigation finished. `args.error` is set on failure' },
    { name: 'loadProgress', desc: 'Android: page load progress (`args.progress: number`)' },
    { name: 'shouldOverrideUrlLoading', desc: 'Raised before each navigation; set `args.cancel = true` to block' },
    { name: 'titleChanged', desc: '`document.title` changed' },
    { name: 'webAlert', desc: '`window.alert()` triggered; call `args.callback()` to dismiss' },
    { name: 'webConfirm', desc: '`window.confirm()` triggered; call `args.callback(boolean)` to dismiss' },
    { name: 'webPrompt', desc: '`window.prompt()` triggered; call `args.callback(string \\| null)` to dismiss' },
    { name: 'webConsole', desc: 'Android: a line was added to the web console' },
  ],
};

const BRIDGE_SNIPPET = `
When \`autoInjectJSBridge\` is \`true\`, the bridge is available after \`DOMContentLoaded\`:

\`\`\`javascript
window.nsWebViewBridge.emit('myEvent', { key: 'value' }); // → NativeScript
window.nsWebViewBridge.on('nativeEvent', (data) => { });  // ← NativeScript
\`\`\``;

// ─── Markdown helpers ─────────────────────────────────────────────────────────

function staticsTable(rows) {
  if (!rows.length) return '_None._\n';
  const lines = ['| Static property | Type | Description |', '| --- | --- | --- |'];
  for (const r of rows) lines.push(`| \`${r.name}\` | \`${r.type}\` | ${r.desc} |`);
  return lines.join('\n') + '\n';
}

function propsTable(rows) {
  if (!rows.length) return '_None implemented yet._\n';
  const lines = ['| Property | Type | Description |', '| --- | --- | --- |'];
  for (const r of rows) lines.push(`| \`${r.name}\` | \`${r.type}\` | ${r.desc} |`);
  return lines.join('\n') + '\n';
}

function methodsTable(rows) {
  if (!rows.length) return '_None implemented yet._\n';
  const lines = ['| Method | Returns | Description |', '| --- | --- | --- |'];
  for (const r of rows) lines.push(`| \`${r.name}\` | \`${r.returns}\` | ${r.desc} |`);
  return lines.join('\n') + '\n';
}

function eventsTable(rows) {
  if (!rows.length) return '_None implemented yet._\n';
  const lines = ['| Event | Description |', '| --- | --- |'];
  for (const r of rows) lines.push(`| \`${r.name}\` | ${r.desc} |`);
  return lines.join('\n') + '\n';
}

function implementedSection(data, extraMethods = []) {
  const allMethods = [...data.methods, ...extraMethods];
  return `## Implemented

_Available in both \`@modos189/nativescript-webview-x\` and \`@modos189/nativescript-webview-x-gecko\`._

### Static properties

${staticsTable(data.statics)}
### Properties

${propsTable(data.properties)}
### Methods

${methodsTable(allMethods)}
### Events

${eventsTable(data.events)}`;
}

function apiReferenceSection(data, note) {
  return `## API Reference

${note}

### Properties

${propsTable(data.properties)}
### Methods

${methodsTable(data.methods)}
### Events

${eventsTable(data.events)}
### nsWebViewBridge (inside the WebView)
${BRIDGE_SNIPPET}`;
}

// ─── Plugin-specific README templates ────────────────────────────────────────

function readmeWebViewX() {
  return `# @modos189/nativescript-webview-x

A NativeScript WebView plugin wrapping the Android system WebView and iOS WKWebView.
Built on top of [\`@nativescript-community/ui-webview\`](https://github.com/nativescript-community/ui-webview) — \`WebViewX\` extends \`AWebView\` directly, so the full upstream API is available.

Both \`@modos189/nativescript-webview-x\` and \`@modos189/nativescript-webview-x-gecko\` export an identically named \`WebViewX\` class.
Swap the engine by changing only the import path.

## Installation

\`\`\`bash
npm install @modos189/nativescript-webview-x
\`\`\`

## Usage

### XML

\`\`\`xml
<Page xmlns="http://schemas.nativescript.org/tns.xsd"
      xmlns:wv="@modos189/nativescript-webview-x">
  <GridLayout rows="auto, *">
    <TextField row="0" hint="Enter URL" text="{{ url }}" returnPress="{{ onNavigate }}" />
    <wv:WebViewX row="1" src="{{ src }}" />
  </GridLayout>
</Page>
\`\`\`

### TypeScript

\`\`\`typescript
import { WebViewX } from '@modos189/nativescript-webview-x';

const webview = new WebViewX();
webview.loadUrl('https://example.com');
webview.on('loadFinished', () => {
  webview.executeJavaScript('document.title');
});
\`\`\`

${implementedSection(IMPLEMENTED)}

${apiReferenceSection(API_REFERENCE, 'Full API inherited from `@nativescript-community/ui-webview`. All items are available — `WebViewX` extends `AWebView` directly.')}

## License

Apache License Version 2.0
`;
}

function readmeWebViewXGecko() {
  return `# @modos189/nativescript-webview-x-gecko

A NativeScript WebView plugin using **GeckoView** (Mozilla's Gecko engine) on Android and WKWebView on iOS.
Exports the same \`WebViewX\` class as [\`@modos189/nativescript-webview-x\`](../webview-x/README.md) — swap the engine by changing only the import path.

> **iOS note:** App Store guidelines prohibit custom browser engines on iOS.
> The iOS implementation falls back to WKWebView (identical to \`@modos189/nativescript-webview-x\`).

## Installation

\`\`\`bash
npm install @modos189/nativescript-webview-x-gecko
\`\`\`

The GeckoView Maven repository and AAR dependency are added to your Android project automatically on install.

> **Note:** GeckoView requires \`minSdkVersion 26\`. Make sure your \`App_Resources/Android/app.gradle\`
> has \`minSdkVersion\` set to at least \`26\`.

## Usage

\`\`\`xml
<Page xmlns="http://schemas.nativescript.org/tns.xsd"
      xmlns:wv="@modos189/nativescript-webview-x-gecko">
  <GridLayout rows="auto, *">
    <TextField row="0" hint="Enter URL" text="{{ url }}" returnPress="{{ onNavigate }}" />
    <wv:WebViewX row="1" src="{{ src }}" />
  </GridLayout>
</Page>
\`\`\`

\`\`\`typescript
import { WebViewX } from '@modos189/nativescript-webview-x-gecko';

const webview = new WebViewX();
webview.src = 'https://example.com';
\`\`\`

To switch from \`@modos189/nativescript-webview-x\`, change only the import — no other code changes needed.

${implementedSection(IMPLEMENTED)}

${apiReferenceSection(API_REFERENCE, 'Target API matching `@modos189/nativescript-webview-x`. Items not listed under **Implemented** above are not yet available on Android (iOS uses WKWebView and has the full API). Refer to the [upstream docs](https://github.com/nativescript-community/ui-webview) for details.')}

## License

Apache License Version 2.0
`;
}

// ─── Write files ──────────────────────────────────────────────────────────────

const PACKAGES = path.join(__dirname, '../../packages');

const GENERATED_HEADER = `<!-- ⚠️ This file is generated by tools/scripts/generate-readme.js — do not edit directly. -->\n`;

const files = [
  { path: path.join(PACKAGES, 'webview-x/README.md'), content: GENERATED_HEADER + readmeWebViewX() },
  { path: path.join(PACKAGES, 'webview-x-gecko/README.md'), content: GENERATED_HEADER + readmeWebViewXGecko() },
];

for (const { path: filePath, content } of files) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✓ wrote ${path.relative(process.cwd(), filePath)}`);
}
