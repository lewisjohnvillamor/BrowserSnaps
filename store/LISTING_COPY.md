# BrowserSnaps Chrome Web Store Listing Copy

Use the following text in the Chrome Web Store Developer Dashboard.

## Product details

**Name**

BrowserSnaps

**Summary**

Capture selected website pages at desktop, tablet, and mobile sizes, then export full-page screenshots as PDF or PNG.

**Category**

Developer Tools

**Language**

English

## Detailed description

BrowserSnaps turns the website open in your current Chrome tab into clean, full-page documentation.

Choose one or more same-site navigation pages, select the screen sizes you need, and BrowserSnaps will scroll each page, wait for visible content, capture overlapping viewport tiles, and stitch them into continuous screenshots. Review the results locally, then export them as PDF, PNG, or both.

Key features:

- Capture the current page or selected same-origin navigation pages
- Use the current browser size or desktop, laptop, tablet, and mobile presets
- Trigger lazy-loaded and scroll-animated page sections
- Stitch visible viewport tiles into continuous full-page captures
- Audit any page for SEO, accessibility, and page-quality issues
- Measure Core Web Vitals and page weight locally, with no third-party scoring service
- Save every image on the current page with one click, without capturing
- Track progress in a small on-page indicator instead of a tab that opens itself
- Preview and select results before downloading
- Export one combined PDF, individual PNGs, or ZIP packages
- Optionally use a dedicated capture window while continuing work elsewhere
- Restore the original URL, zoom level, and scroll position
- Process and retain capture data locally; no accounts, analytics, or backend
- Open-source MIT-licensed code with no runtime dependencies

BrowserSnaps operates only after you open it on a webpage and start a capture. It does not request broad access to every website and does not transmit page content, URLs, or screenshots to the developer or any third party.

Some websites may render video, WebGL, cross-origin frames, or highly dynamic content differently during automated capture. Chrome internal pages cannot be captured.

## URLs

**Homepage**

https://github.com/lewisjohnvillamor/BrowserSnaps

**Support**

https://github.com/lewisjohnvillamor/BrowserSnaps/issues

**Privacy policy**

https://github.com/lewisjohnvillamor/BrowserSnaps/blob/main/PRIVACY.md

## Single purpose

Document user-selected website pages: capture them at user-selected viewport sizes for PDF or PNG export, save the images they contain, and report the SEO, accessibility, and page-quality issues found in the same page load.

## Permission justifications

**activeTab**

Grants temporary access only to the tab where the user opens BrowserSnaps, so the extension can discover same-origin navigation links and capture pages explicitly selected by the user.

**scripting**

Runs local scripts in the user-invoked tab to discover navigation links and image sources, inspect page markup for the audit, scroll the page, wait for fonts and images, stabilize animated or sticky elements, show the capture indicator, and restore the page afterward.

**debugger**

Uses Chrome DevTools Protocol only during a user-started capture to apply selected responsive viewport dimensions, capture visible viewport tiles in the optional dedicated capture window, and read the sizes and headers of the page's own network responses for the local performance report. It attaches only to the selected capture tab and detaches when the capture finishes, fails, or is cancelled.

**downloads**

Saves PDF, PNG, and ZIP files only when the user selects an export action, and saves the current page's images when the user selects the Save page images action.

**offscreen**

Creates an invisible extension document to stitch screenshot tiles and generate local export files after the popup closes.

## Privacy-practices answers

- Host permissions: None
- Remote code: No; all executable code is included in the extension package
- Data handled: Web browsing activity and website content
- Data use: Only the user-requested screenshot and export workflow
- Local storage: Capture sessions are retained in IndexedDB for up to 24 hours
- Data sharing: None
- Advertising or profiling: None
- Human access to captured data: None
- Sale of data: None
- Creditworthiness or lending use: None

The Chrome Web Store disclosure should include **Web browsing activity** and **Website content**, even though BrowserSnaps processes both locally and does not transmit them.

## Distribution answers

- Visibility: Public
- Regions: All regions
- In-app purchases: No
- Mature content: No

The optional PayPal support link is a user-initiated donation link. It does not unlock functionality and is not an in-app purchase.
