# Changelog

## 1.5.0 - 2026-08-21

- Replaced the automatic results tab with a small on-page capture indicator.
- Reported live capture progress, the current page, screen size, and tile in the indicator.
- Added Cancel and View results buttons to the indicator so results open only when you ask.
- Hid the indicator for each screenshot so it never appears in a capture.
- Reported capture failures and cancellations in the indicator instead of a separate error tab.
- Added a View results button to the extension popup after a capture finishes.
- Kept the standalone results tab as a fallback for pages that cannot host the indicator.
- Added a Save page images quick action that downloads every image on the current page.
- Collected rendered images, video posters, and CSS background images, skipping tracking pixels and duplicates.
- Reported image download progress in the same indicator, with Cancel support.

## 1.4.2 - 2026-08-13

- Added a Firefox 140+ Manifest V3 build with an AMO add-on ID and built-in no-data-collection declaration.
- Added Firefox viewport resizing and visible-tab capture fallbacks for unsupported Chrome APIs.
- Added a reproducible Firefox ZIP builder and temporary-installation instructions.
- Added shared Chromium packages for Chrome, Edge, Brave, and Opera.
- Added an experimental Safari source target and Xcode conversion instructions.
- Added platform startup tests, a browser-by-browser functional checklist, and an explicit Internet Explorer unsupported notice.
- Added an in-product disclosure explaining how page URLs, visible page content, and captures are handled.
- Added a standalone Chrome Web Store privacy policy and submission checklist.
- Added reproducible Chrome Web Store package generation and validation.
- Added Chrome Web Store listing assets and reviewer-facing permission justifications.
- Added the project homepage to the extension manifest.

## 1.4.1 - 2026-08-12

- Removed the capture-results database from the service worker startup path to prevent extension initialization failures.
- Restored current-tab capture as the safe default while keeping dedicated capture windows optional.
- Changed dedicated-window screenshots to use the tab-specific DevTools capture path instead of the active-window API.
- Added automatic fallback to current-tab mode if Chrome cannot create a dedicated capture window.
- Opened a visible error page when a background capture fails instead of only showing a badge.
- Refreshed the README with current popup, results-viewer, and captured-site screenshots.

## 1.4.0 - 2026-08-12

- Added a dedicated capture-window mode so the main Chrome window remains available during long jobs.
- Added a local full-page results viewer with capture navigation, zoom, and per-capture export selection.
- Added PDF, PNG, and combined PDF + PNG downloads.
- Added single combined downloads and separate downloads grouped by screen size.
- Added a dependency-free ZIP writer for multi-image and combined exports.
- Stored results locally for up to 24 hours and automatically removed expired sessions.
- Restored the working tab to its original window, position, URL, zoom, pin state, and scroll position.

## 1.3.0 - 2026-08-12

- Replaced oversized single-shot captures with real visible-viewport scrolling and tile stitching.
- Made the active tab's current browser dimensions the default capture size.
- Added an overlap and settling delay between tiles for lazy-loaded and scroll-triggered sections.
- Neutralized animations and repeated fixed or sticky elements while capturing.
- Closed the popup before capture so it cannot cover the first screenshot tile.
- Removed report headers and footers to give the captured website more printable area.

## 1.2.0 - 2026-08-12

- Preserved each website as a continuous full-page capture instead of enlarging each viewport section.
- Changed PDF output to portrait Letter pages matching conventional full-page screenshot reports.
- Split continuous captures only at print-page boundaries.
- Removed blank remainder sheets caused by one-pixel layout-height differences.

## 1.1.0 - 2026-08-12

- Fixed incorrect capture widths when Chrome was not at 100% zoom.
- Reloaded every page independently for each responsive viewport preset.
- Waited for fonts, images, and lazy-loaded content before capture.
- Enforced the selected viewport width instead of using horizontal document overflow.
- Replaced extremely tall custom PDF pages with readable A4 pagination.
- Added page, viewport, URL, and continuation labels to every PDF sheet.
- Restored the original URL, zoom level, and scroll position after capture.

## 1.0.0 - 2026-08-12

- Initial release.
