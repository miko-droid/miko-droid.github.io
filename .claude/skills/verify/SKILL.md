---
name: verify
description: How to build, serve, and drive this site headlessly to verify changes
---

# Verifying changes to this site

Static Eleventy site; the surface is a browser. No Playwright — drive headless
Chrome over raw CDP (Node 24+ has a built-in WebSocket client).

## Build & serve

```powershell
npm run build          # writes _site/ (~2s; image pipeline caches in img/)
```

Serve `_site/` with any static server that falls back to `dir/index.html`
(collection URLs are extensionless). A ~30-line `http` server script works;
`eleventy --serve` (port 8080) also works but is slower to start.

## Drive headless Chrome via CDP

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new `
  --remote-debugging-port=9222 --user-data-dir="<scratch>\chrome-profile" `
  --no-first-run about:blank
```

Then from Node: GET `http://127.0.0.1:9222/json/list`, connect `new
WebSocket(page.webSocketDebuggerUrl)`, send `{id, method, params}` JSON.
Useful methods: `Emulation.setDeviceMetricsOverride` (393x852 @3x,
mobile:true for phone emulation), `Page.navigate`, `Runtime.evaluate`
(`returnByValue:true, awaitPromise:true`), `Page.captureScreenshot`.

Gotchas:
- `Runtime.evaluate` with `returnByValue` fails with "Object reference
  chain is too long" if the expression's value is `window` (e.g. a bare
  `Object.defineProperty(window,...)`) — append `; true`.
- `html { scroll-behavior: smooth }` animates `window.scrollTo` — wait
  ~900ms after scrolling before measuring.

## Flows worth driving

- **Hero caption vs URL-bar collapse** (the historical mobile bug): scroll
  to 500, wait, then simulate the URL bar collapsing —
  `Object.defineProperty(window,"innerHeight",{value:innerHeight+80,configurable:true});
  dispatchEvent(new Event("resize"))` — and assert `[data-hero-cap]` /
  `.collections__label` rects don't move. (DevTools viewport resize can't
  reproduce this: it moves `svh` and `innerHeight` together.)
- **Home → collection transition**: `.col-row` `pointerdown` should fetch
  that collection's first 1400w print (check
  `performance.getEntriesByType('resource')` — use a row whose print isn't
  already a hero slide; canopy's is). Then `.click()`; after ~2s expect
  `location.pathname` changed, `[data-print] img` has `style.visibility === ""`,
  and no `.mr-flight` element remains.
- **A/B against pre-fix code**: copy `_site/` to scratch and overwrite
  `js/*.js` with `git show HEAD:src/js/<f>.js` to prove a test detects the
  bug it guards.

Kill spawned node/chrome by matching CommandLine via `Get-CimInstance
Win32_Process` (don't blanket-kill node.exe/chrome.exe).
