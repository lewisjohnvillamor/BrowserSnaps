# Chrome Web Store Submission Reference

BrowserSnaps v1.8.0 has separate copy-ready submission files:

- [`LISTING_COPY.md`](LISTING_COPY.md) contains the Store listing, single-purpose statement, permission justifications, privacy-practices answers, and distribution answers.
- [`SUBMISSION_CHECKLIST.md`](SUBMISSION_CHECKLIST.md) provides the complete upload, review, testing, and release checklist.
- [`../PRIVACY.md`](../PRIVACY.md) is the public privacy policy.
- [`assets/`](assets/) contains the prepared Store screenshots and promotional image.

The remaining material below is retained as a combined reference.

## Store listing

**Name:** BrowserSnaps

**Summary:** Capture selected website pages at desktop, tablet, and mobile sizes, then export full-page screenshots as PDF or PNG.

**Category:** Developer Tools

**Language:** English

**Detailed description:**

BrowserSnaps turns the website open in your current Chrome tab into clean, full-page documentation.

Choose one or more same-site navigation pages, select the screen sizes you need, and BrowserSnaps will scroll each page, wait for visible content, capture overlapping viewport tiles, and stitch them into continuous screenshots. Review the results locally, then export them as PDF, PNG, or both.

Key features:

- Capture the current page or selected same-origin navigation pages
- Use the current browser size or desktop, laptop, tablet, and mobile presets
- Trigger lazy-loaded and scroll-animated page sections
- Stitch visible viewport tiles into continuous full-page captures
- Preview and select results before downloading
- Export one combined PDF, individual PNGs, or ZIP packages
- Optionally use a dedicated capture window while continuing work elsewhere
- Restore the original URL, zoom level, and scroll position
- Process and retain capture data locally; no accounts, analytics, or backend
- Open-source MIT-licensed code with no runtime dependencies

BrowserSnaps operates only after you open it on a webpage and start a capture. It does not request broad access to every website and does not transmit page content, URLs, or screenshots to the developer or any third party.

Some websites may render video, WebGL, cross-origin frames, or highly dynamic content differently during automated capture. Chrome internal pages cannot be captured.

**Homepage URL:** https://github.com/lewisjohnvillamor/BrowserSnaps

**Support URL:** https://github.com/lewisjohnvillamor/BrowserSnaps/issues

**Privacy policy URL:** https://github.com/lewisjohnvillamor/BrowserSnaps/blob/main/PRIVACY.md

## Privacy practices

**Single purpose:**

Capture user-selected website pages at user-selected viewport sizes and export the resulting full-page screenshots as PDF or PNG files.

**Permission justifications:**

| Permission | Dashboard justification |
| --- | --- |
| `activeTab` | Grants temporary access only to the tab where the user opens BrowserSnaps, so the extension can discover same-origin navigation links and capture pages explicitly selected by the user. |
| `scripting` | Runs local scripts in the user-invoked tab to discover navigation links, scroll the page, wait for fonts and images, stabilize animated or sticky elements, and restore the page afterward. |
| `debugger` | Uses Chrome DevTools Protocol only during a user-started capture to apply selected responsive viewport dimensions and capture visible viewport tiles in the optional dedicated capture window. It attaches only to the selected capture tab and detaches when the capture finishes, fails, or is cancelled. |
| `downloads` | Saves PDF, PNG, and ZIP files only when the user selects an export action. |
| `offscreen` | Creates an invisible extension document to stitch screenshot tiles and generate local export files after the popup closes. |

**Host permissions:** None.

**Remote code:** No. All executable code is included in the extension package.

**Data handled:**

- Web browsing activity: selected page URLs and same-origin navigation URLs, used only for the user-requested capture workflow.
- Website content: visibly rendered page content, used only to create screenshots and exports.

**Data handling disclosures:**

- Data is processed and stored locally on the user's device.
- Capture sessions automatically expire from IndexedDB after 24 hours.
- Data is not sold, transferred, or shared with third parties.
- Data is not used for purposes unrelated to the extension's single purpose.
- Data is not used for creditworthiness or lending purposes.
- Humans do not read the data.

Select the dashboard answers that accurately disclose **Web browsing activity** and **Website content**, even though the processing is local-only.

## Distribution

- Visibility: Public
- Regions: All regions, unless support or legal constraints require a narrower launch
- In-app purchases: No
- Mature content: No

The PayPal link is an optional donation link opened only after a user clicks **Support**. It does not unlock functionality and is not an in-app purchase.

## Listing assets

Upload the prepared files from `store/assets/`:

- `screenshot-01-results.png` — results viewer
- `screenshot-02-capture.png` — captured website example
- `screenshot-03-popup.png` — extension popup and capture controls
- `promo-small-440x280.png` — optional small promotional tile

All screenshots are 1280 x 800 with square corners, as required by the Chrome Web Store.

## Package and validation

Run:

```bash
npm run validate:store
```

Upload the generated ZIP from `dist/`. Its root contains `manifest.json`; tests, documentation, screenshots, Git metadata, and development files are excluded.

## Manual submission checklist

- Register the publisher account and pay Google's one-time registration fee.
- Enable two-step verification on the publisher Google account.
- Verify the publisher email address and monitor it for review messages.
- Upload the generated ZIP on the Package tab.
- Add the listing copy and prepared images.
- Paste the single-purpose statement, each permission justification, and privacy disclosures exactly as above.
- Add the privacy policy URL in the designated Privacy practices field, not only in the description.
- Submit as staged publishing for the first release, if available, so approval does not immediately make it public.
- Test the approved package from the store before expanding promotion.
