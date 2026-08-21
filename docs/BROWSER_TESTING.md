# BrowserSnaps Browser Testing

This document distinguishes package/API validation from a real functional browser test. Do not mark a browser as functionally verified until the full checklist passes in that branded browser.

## Build all targets

```bash
npm run check
npm test
npm run build:store
npm run build:firefox
npm run build:safari
```

Generated targets:

| Engine | Unpacked directory | Archive |
| --- | --- | --- |
| Chromium | `dist/extension` | `dist/BrowserSnaps-v1.5.0-chromium.zip` |
| Firefox | `dist/firefox-extension` | `dist/BrowserSnaps-v1.5.0-firefox.zip` |
| Safari | `dist/safari-extension` | `dist/BrowserSnaps-v1.5.0-safari-source.zip` |

## Current verification status

| Browser | Package/API validation | Branded-browser functional test |
| --- | --- | --- |
| Chrome | Passed automated syntax, unit, manifest, ZIP, and platform-startup tests | Capture engine previously user-tested; repeat required for this build |
| Edge | Same validated Chromium package | Required on Edge 116+ |
| Brave | Same validated Chromium package | Required on Brave 1.57+ |
| Opera | Same validated Chromium package | Required on Opera 102+ |
| Firefox | Mozilla `web-ext lint`: 0 errors, 0 warnings | Required on Firefox 140+ |
| Safari | Safari source manifest, syntax, unit, ZIP, and platform-startup checks | Required on Safari 27+ on macOS |
| Internet Explorer | Not applicable | Impossible: no WebExtensions support |

The repository must not claim a branded browser test passed based only on another Chromium browser passing. Add the tested browser version, operating system, date, and result to the log below.

## Functional test checklist

Run every case on a normal HTTP or HTTPS test site with at least two same-origin navigation pages and a page long enough to scroll.

- [ ] Extension loads without manifest or background errors.
- [ ] Toolbar popup opens and identifies the current website.
- [ ] Navigation pages are discovered correctly.
- [ ] Privacy disclosure is visible before capture.
- [ ] Current tab capture completes.
- [ ] Captured tiles stitch in the correct top-to-bottom order.
- [ ] Sticky headers are not repeated on every tile.
- [ ] Lazy-loaded images appear.
- [ ] Desktop responsive capture completes.
- [ ] Mobile responsive capture completes.
- [ ] Original URL, zoom, and scroll position are restored.
- [ ] Dedicated capture window returns the tab to its original window.
- [ ] Capture indicator appears in the corner of the page when the capture starts.
- [ ] Indicator reports the current page, screen size, and tile while capturing.
- [ ] Indicator does not appear in any stitched capture.
- [ ] Indicator's Cancel button stops the capture.
- [ ] Indicator reports completion and no results tab opens on its own.
- [ ] Indicator's View results button opens the results viewer.
- [ ] Popup's View results button opens the same session after the capture finishes.
- [ ] Results viewer opens and previews every selected capture.
- [ ] PDF download opens and paginates correctly.
- [ ] Single PNG download opens correctly.
- [ ] Multi-capture ZIP opens and contains the expected files.
- [ ] Cancellation stops safely and restores the tab.
- [ ] A forced failure is reported in the indicator, or in a results tab when the page cannot host it.
- [ ] No captured URL, page content, image, or file is transmitted over the network.

## Browser-specific installation

### Chrome

Open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose the repository root or `dist/extension`.

### Edge

Open `edge://extensions`, enable Developer mode, select **Load unpacked**, and choose the repository root or `dist/extension`.

### Brave

Open `brave://extensions`, enable Developer mode, select **Load unpacked**, and choose the repository root or `dist/extension`.

### Opera

Open `opera://extensions`, enable Developer mode, select **Load unpacked**, and choose the repository root or `dist/extension`.

### Firefox

Open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose `dist/firefox-extension/manifest.json`.

### Safari

On Safari 27+, use the Develop menu's temporary web-extension loading support and select `dist/safari-extension`. For conversion or signing, use `xcrun safari-web-extension-converter` on macOS with Xcode.

## Test log

| Browser/version | OS | Date | Tester | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| Chrome | — | — | — | Pending v1.5.0 retest | v1.4.1 current-tab capture was confirmed working |
| Edge | — | — | — | Pending | |
| Brave | — | — | — | Pending | |
| Opera | — | — | — | Pending | |
| Firefox 140+ | — | — | — | Pending | Mozilla package lint passes |
| Safari 27+ | macOS | — | — | Pending | Requires real Mac and Safari |
