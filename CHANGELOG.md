# Changelog

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
