# Walkthrough recording

`docs/screenshots/browser-snaps-walkthrough.gif` is a recording of the real extension
running against <https://portfolio.crownmediasvc.com/>. It was produced by
`docs/demo-walkthrough.mjs`, which drives Chromium with Playwright.

## What the recording shows

1. The portfolio site in a normal tab.
2. The BrowserSnaps popup: the active site, both quick actions, the 77 navigation pages
   discovered on the page, screen sizes, output options, and the lab score toggle.
3. A real capture running, with the on-page indicator reporting progress. The indicator
   disappears from some frames because it hides itself for each screenshot, which is
   the intended behaviour.
4. The results viewer: the stitched full-page capture, then the Audit view with the lab
   performance score, technology detection, Core Web Vitals, page weight, and findings.

## What was measured in the recording

Against the portfolio site, on the run that produced this GIF:

- **Technology** — Next.js 16.3.0, Vercel, Tailwind CSS, all high confidence
- **Audit** — no critical findings; oversized images, incomplete Open Graph tags, and no
  structured data
- **Weight** — 693 KB of JavaScript, 250 KB of CSS, 6 render-blocking resources in `<head>`
- **Content** — 1755 words, 2 images, 107 links, 19 headings

## Harness accommodations

The recording drives the extension programmatically rather than by hand, which needs two
departures from normal use. Both are in the script and neither changes extension code.

**Host permissions.** `chrome.scripting.executeScript` needs a host grant. In normal use
clicking the toolbar icon grants it through `activeTab`; a scripted run has no user
gesture, so the recording loads a copy of `dist/extension` with `host_permissions`
added to its manifest. Same code, same UI — only how the grant is obtained differs.

**The popup as a tab.** Chromium renders the action popup as browser chrome, which
Playwright cannot screenshot, and this container has no X11 screen-capture tool. The
popup is therefore opened as a tab with `chrome.tabs.query` shimmed to return the site
tab. Page discovery, image counting, and the capture message all run for real against
that tab; only that one lookup is redirected.

**Network.** The browser in the recording container has no outbound network, so
`context.route` serves every request through Node's `fetch`. The page content is
genuinely the live site, but because bytes are delivered locally the DevTools throttling
does not slow them the way it would on a real connection. **Timing numbers in the
recording are therefore optimistic and should not be read as this site's real
performance.** Everything non-timing — findings, technology, page weight, counts — is
unaffected. Remove the `context.route` block when running anywhere with normal network
access.

## Re-recording

```bash
npm run build:store
node docs/demo-walkthrough.mjs
```

Set `BROWSERSNAPS_EXT` to the build to load and `BROWSERSNAPS_CHROME` to a Chromium
binary if Playwright's default is not wanted.
