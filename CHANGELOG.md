# Changelog

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
