# BrowserSnaps Privacy Policy

Last updated: August 13, 2026

BrowserSnaps is a local-first Chrome extension that captures user-selected website pages, saves the images they contain, audits them for SEO and accessibility issues, and exports the results as PDF or PNG files. This policy explains how BrowserSnaps handles information when you use it.

## Information BrowserSnaps handles

BrowserSnaps processes the following information only after you open the extension and start a capture:

- The URL and title of the active webpage.
- Same-origin navigation links found in the active webpage's navigation areas.
- Visible webpage content rendered in the browser, including text and images, for the purpose of creating screenshots.
- Capture settings such as selected pages, viewport sizes, output format, and file organization.
- Generated screenshots and related capture metadata.
- Page markup read during an audit, including titles, meta tags, headings, image attributes, link attributes, form labels, and structured data.
- Load timings and the sizes, URLs, and response headers of resources the audited page itself requests.
- The audited site's own /robots.txt and /sitemap.xml, requested from that same site.

This information may include personal or sensitive content if you choose to capture a signed-in or private webpage. BrowserSnaps does not inspect password fields or authentication tokens, but anything visibly rendered on a selected page may appear in the resulting screenshot.

## How the information is used

BrowserSnaps uses this information solely to:

- Discover same-origin navigation pages selected by the user.
- Render, scroll, capture, stitch, preview, and export screenshots.
- Restore the original tab, URL, zoom level, and scroll position after capture.
- Produce a local SEO, accessibility, page-quality, and performance report for pages the user selects.

BrowserSnaps does not use website content or browsing activity for advertising, analytics, profiling, credit decisions, or any unrelated purpose.

## Storage and retention

Capture results and metadata are stored locally in the browser using IndexedDB so the results viewer can preview and export them. Stored capture sessions automatically expire after 24 hours. Downloaded PDF, PNG, or ZIP files remain wherever the user chooses to save them and are controlled by the user.

BrowserSnaps has no account system and does not synchronize capture data between devices.

## Sharing and transmission

BrowserSnaps does not transmit webpage content, URLs, screenshots, audit results, capture settings, or generated files to the developer or to any third party. It has no analytics service, advertising service, backend, or remote-code dependency. Audits and performance measurements are computed entirely in your browser and are never sent to a scoring or analysis service.

The optional Source and Support links open external websites only after the user selects them. BrowserSnaps does not send captured data to those websites.

## Chrome permissions

BrowserSnaps uses the following permissions:

- `activeTab` to access the webpage where the user opens BrowserSnaps.
- `scripting` to discover navigation links, control scrolling, wait for page content, and restore the page after capture.
- `debugger` in Chromium builds to apply user-selected responsive viewport sizes and capture visible tiles from an optional dedicated capture window.
- `offscreen` in Chromium builds to stitch screenshot tiles and prepare local result files without keeping the popup open.
- `downloads` to save user-requested PDF, PNG, and ZIP exports.

Firefox and Safari builds do not request `debugger` or `offscreen`. They capture the visible tab, resize a dedicated capture window for responsive widths, and stitch results in their extension background context.

BrowserSnaps does not request broad host permissions such as `<all_urls>` and does not operate on a webpage until the user invokes it there.

## User choices and control

Capturing begins only when the user selects **Capture selected pages**. Users choose which same-origin pages and viewport sizes to capture. A capture can be cancelled, unwanted results can be excluded before export, and the extension can be removed at any time through Chrome's extension settings.

To remove locally retained results before their automatic expiration, remove BrowserSnaps from Chrome or clear the extension's stored data from Chrome's extension settings. Downloaded files can be deleted using the operating system's normal file controls.

## Chrome Web Store Limited Use disclosure

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Changes to this policy

If BrowserSnaps changes how it handles user information, this policy and the relevant in-product disclosures will be updated before those changes are released.

## Contact

For privacy questions or support, open an issue at <https://github.com/lewisjohnvillamor/BrowserSnaps/issues>.
