# BrowserSnaps

Capture the current website's navigation pages at one or more screen sizes, review the results, and export them as PDF or PNG — directly from Chrome.

BrowserSnaps is a lightweight, dependency-free Manifest V3 extension. It uses your active tab and existing signed-in browser session, discovers same-site navigation links, scrolls through each selected page, captures every visible viewport, and stitches the tiles into a full-page image. A local results viewer then lets you download PDF, PNG, or both.

## Browser support

BrowserSnaps is distributed from GitHub as unpacked development builds while public browser-store submissions are paused.

| Browser | Status | Build |
| --- | --- | --- |
| Google Chrome 116+ | Supported | Chromium |
| Microsoft Edge 116+ | Compatible build; branded test pending | Chromium |
| Brave 1.57+ | Compatible build; branded test pending | Chromium |
| Opera 102+ | Compatible build; branded test pending | Chromium |
| Firefox 140+ | Test build | Firefox |
| Safari 27+ | Experimental; macOS testing required | Safari source |
| Internet Explorer | Not supported | None |

Chrome, Edge, Brave, and Opera share Chromium's Manifest V3 extension APIs and use the same package. Firefox uses a separate manifest and replaces unsupported Chrome APIs with visible-tab capture and capture-window resizing. Safari uses a separate source package because Apple controls temporary loading, conversion, signing, and distribution through Safari and Xcode.

Internet Explorer cannot run BrowserSnaps because it does not implement the WebExtensions standard and Microsoft retired the browser. BrowserSnaps requires a modern browser.

![BrowserSnaps extension popup showing pages, screen sizes, output options, and capture-window mode](docs/screenshots/browser-snaps-popup.png)

## What it does

- Works from the website currently open in the active tab
- Finds links inside `nav`, navigation roles, and page headers
- Lets you tick only the pages you want
- Captures the current browser size by default, plus Desktop, Laptop, Tablet, and Mobile presets
- Scrolls in measured viewport steps with overlap so lazy and scroll-triggered sections appear
- Waits for web fonts, images, and responsive content before capture
- Normalizes browser zoom so every preset uses its exact advertised width
- Reloads every route at every selected screen size
- Neutralizes animation and repeating fixed or sticky elements during capture
- Stitches the viewport tiles into one continuous full-page image
- Paginates long captures onto clean portrait Letter sheets instead of oversized PDF pages
- Saves every image on the current page with one click, no capture required
- Shows a small on-page capture indicator with live progress and a Cancel button
- Ends with a "View results" button in that indicator instead of taking over a new tab
- Opens a local full-page viewer with zoom and capture selection
- Exports PDF, PNG, or a ZIP containing both
- Combines all results or separates them by screen size
- Uses a dedicated capture window so your main Chrome window remains usable
- Restores the original page, browser zoom, and scroll position when finished
- Sends no website data to a server
- Requires no build step and has no production dependencies

## Save page images

The popup's **Save page images** quick action skips capturing entirely and downloads what the page is already showing: every `<img>` (including the `srcset` candidate actually rendered), every `<video>` poster, and every CSS `background-image`. Duplicates and 1×1 tracking pixels are dropped, and files land in a `BrowserSnaps-<hostname>-images` folder inside your Downloads directory, numbered in page order.

BrowserSnaps hands each URL to the browser's own downloader, so cross-origin images work without CORS headers and without BrowserSnaps requesting access to every website. The trade-offs of that choice:

- `data:` and `blob:` images are inline bytes rather than URLs, so they are skipped and counted in the summary.
- URLs with no file extension (common on image CDNs) are saved as `.jpg`.
- A run stops at 200 images; anything past that is reported as skipped rather than dropped silently.

Progress, a Cancel button, and the final tally appear in the same on-page indicator the capture flow uses.

## Results viewer

While capturing, BrowserSnaps shows a small indicator in the corner of the page. It reports the current page, screen size, and tile, offers a Cancel button, and hides itself for each screenshot so it never appears in a capture. When the run finishes, the indicator turns into a **View results** button — nothing opens on its own.

Selecting **View results** opens a local results page where you can preview every page and screen size, change the zoom, untick unwanted captures, and choose the final download format. The same button is available from the extension popup, and BrowserSnaps falls back to opening the results tab directly on pages that cannot host the indicator.

![BrowserSnaps results viewer showing a full-page capture and PDF and PNG export controls](docs/screenshots/browser-snaps-results.png)

The viewer uses the stitched full-page image—not separate viewport screenshots—so PDF pages and downloaded PNGs remain visually continuous.

### Chrome, Edge, Brave, or Opera

1. Download this repository with **Code → Download ZIP**, then extract it. You can also clone it:

   ```bash
   git clone https://github.com/lewisjohnvillamor/BrowserSnaps.git
   ```

2. Open the browser's extension manager:

   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
   - Opera: `opera://extensions`

3. Turn on **Developer mode** in the upper-right corner.
4. Select **Load unpacked**.
5. Choose the extracted `BrowserSnaps` repository folder—the folder containing `manifest.json`. You can alternatively run `npm run build:store` and load the cleaner `dist/extension` folder.
6. Pin BrowserSnaps from the browser's Extensions menu for easy access.

### Try in Firefox

BrowserSnaps includes a separate Firefox Manifest V3 package because Firefox does not implement Chrome's `debugger` extension API or `offscreen` API.

```bash
npm run validate:firefox
```

Then:

1. Open `about:debugging#/runtime/this-firefox` in Firefox 140 or later.
2. Select **Load Temporary Add-on**.
3. Choose `dist/firefox-extension/manifest.json`.
4. Open a normal website, select BrowserSnaps, and first test **Current tab**.
5. For Desktop, Laptop, Tablet, or Mobile presets, Firefox automatically uses a dedicated capture window and resizes its visible viewport.

Temporary add-ons are removed when Firefox closes. The generated `dist/BrowserSnaps-v1.4.2-firefox.zip` is ready for Mozilla's validator and signing workflow.

Firefox responsive presets reproduce CSS viewport widths but do not emulate Chrome's mobile user agent, touch input, or device-specific browser behavior. The capture window must remain open and unminimized.

### Try in Safari

Safari 27 can temporarily load compatible Chrome or Firefox extension resources from its Develop tools. Build the Safari source first:

```bash
npm run validate:safari
```

Use `dist/safari-extension` as the extension resources directory. On older Safari versions or for a distributable app, run Apple's converter on macOS with Xcode:

```bash
xcrun safari-web-extension-converter dist/safari-extension --project-location dist/safari-project
```

Open the generated Xcode project, select your Apple development team, build the macOS app, enable the extension in Safari, and complete the [browser test checklist](docs/BROWSER_TESTING.md). Safari cannot be packaged, signed, or genuinely tested from Windows or Linux.

Safari support remains experimental until the current package completes the checklist on a real Mac. The current-tab mode should be tested before responsive capture-window sizes.

## Use BrowserSnaps

1. Open the website you want to document. Sign in first if the site is private.
2. Select the BrowserSnaps icon in Chrome's toolbar.
3. Tick the navigation pages to capture.
4. Tick one or more screen sizes. **Current tab** is selected by default and uses the browser size you can see.
5. Choose PDF, PNG, or both, then choose one combined download or separate files by screen size.
6. Enable **Use a capture window** if you want to continue working in your main Chrome window. Current-tab mode remains the default for maximum compatibility.
7. Select **Capture selected pages** and approve Chrome's debugging notice if it appears.
8. Keep the dedicated capture window open and unminimized. It may remain behind your main window.
9. Review the stitched captures, untick anything you do not want, then select PDF, PNG, or PDF + PNG.

The blue badge shows progress. A green check means the results are ready. BrowserSnaps restores the working tab to its original window unless you turn restoration off.

> Chrome shows a debugging banner while full-page viewport emulation is active. This is expected: the extension uses the official `chrome.debugger` API and detaches as soon as the capture finishes or is cancelled.

## Screen presets

| Preset | Viewport | Mode |
| --- | ---: | --- |
| Current tab | Your visible browser viewport | Desktop |
| Desktop | 1440 × 900 | Desktop |
| Laptop | 1366 × 768 | Desktop |
| Tablet | 768 × 1024 | Touch/mobile layout |
| Mobile | 390 × 844 | Touch/mobile layout |

Each checked page is captured once per checked screen size. BrowserSnaps scrolls the real page, waits for the layout to settle, captures overlapping viewport tiles, stitches them into one continuous image, scales that image to portrait Letter paper, and continues vertically across clean PDF sheets.

## Export organization

| Selection | PDF | PNG | PDF + PNG |
| --- | --- | --- | --- |
| One combined download | One PDF | One PNG or one ZIP of PNGs | One ZIP containing the combined PDF and PNGs |
| Separate by screen size | One PDF per size | One PNG or ZIP per size | One ZIP per size containing its PDF and PNGs |

Capture results are stored only in Chrome's local extension storage and automatically expire after 24 hours.

### Example captured website

The included demo site is used for documentation and development checks:

![Example website captured by BrowserSnaps](docs/screenshots/demo-website.png)

## Permissions and privacy

| Permission | Why it is needed |
| --- | --- |
| `activeTab` | Reads and operates only on the tab where you open BrowserSnaps |
| `scripting` | Discovers navigation links and auto-scrolls pages |
| `debugger` | Emulates the optional responsive viewport presets |
| `downloads` | Saves PDF, PNG, and ZIP results |
| `offscreen` | Stitches full-page images without keeping the popup open |

BrowserSnaps has no analytics, remote code, accounts, or backend. Captures and page URLs stay inside your browser. Review [`manifest.json`](manifest.json) and the source in [`src/`](src/) to verify the behavior.

Read the complete [Privacy Policy](PRIVACY.md), including local storage, retention, and Chrome Web Store Limited Use disclosures.

## Limitations

- Chrome internal pages such as `chrome://settings` cannot be captured.
- Only same-origin navigation links are listed. This prevents the capture job from walking into unrelated websites.
- Some sites block automation or change content based on viewport, cookie consent, animations, or login state.
- Video frames, WebGL canvases, and content inside cross-origin iframes may not appear consistently.
- Long pages remain visually continuous and are divided only at portrait Letter print boundaries.
- The capture tab or dedicated capture window must remain open and unminimized until the job completes.
- Without dedicated-window mode, keep the source tab active. With it enabled, work in another Chrome window while the capture window stays open behind it.

## Development

There is no bundler and nothing to compile. Edit the files, then select the **Reload** button for BrowserSnaps on `chrome://extensions`.

```bash
npm run check
npm test
npm run build:store
npm run build:firefox
npm run build:safari
```

The small test suite validates the built-in PDF and ZIP writers. The demo page used in the documentation is at [`docs/demo-site/index.html`](docs/demo-site/index.html).

Chrome Web Store listing copy, permission justifications, privacy-field answers, assets, and the manual submission checklist are maintained in [`store/STORE_SUBMISSION.md`](store/STORE_SUBMISSION.md).

Cross-browser package checks and manual functional cases are documented in [Browser testing](docs/BROWSER_TESTING.md).

## Chrome Web Store release materials

Everything needed for the first Store submission is maintained in the repository:

| Material | File |
| --- | --- |
| Copy-ready Store listing and dashboard answers | [Listing copy](store/LISTING_COPY.md) |
| Upload, privacy, testing, and release steps | [Submission checklist](store/SUBMISSION_CHECKLIST.md) |
| Public user-data and retention disclosure | [Privacy policy](PRIVACY.md) |
| Combined reviewer reference | [Store submission reference](store/STORE_SUBMISSION.md) |
| Screenshots and promotional image | [`store/assets/`](store/assets/) |

Build and validate the exact upload package with:

```bash
npm run validate:store
```

The generated `dist/BrowserSnaps-v1.4.2-chrome-web-store.zip` contains only the extension runtime, manifest, icons, and license. Development files, tests, Store copy, and screenshots are excluded from the uploaded extension.

The Chrome Web Store and GitHub should be used together: the Store is the recommended installation and automatic-update channel, while GitHub remains the public source, issue tracker, privacy-policy host, and reproducible release source.

## Contributing

Issues and pull requests are welcome. Please keep new dependencies optional and preserve the extension's local-first, lightweight design.

## Support

If BrowserSnaps saves you time, you can [support the project through PayPal](https://www.paypal.com/paypalme/lewisjohnvillamor/199).

## License

Copyright © 2026 Lewis John Villamor. Released under the [MIT License](LICENSE).
