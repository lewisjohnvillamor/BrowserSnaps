/* global chrome, self */

(() => {
  const EXAMPLES = 8;

  // Runs inside the page. Returns plain facts only; every judgement happens in evaluate().
  async function collectFacts() {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const attribute = (selector, name) => document.querySelector(selector)?.getAttribute(name) || "";
    const meta = (name) => attribute(`meta[name="${name}" i]`, "content");
    const property = (name) => attribute(`meta[property="${name}" i]`, "content");
    const LIMIT = 8;

    const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")];
    const levels = headings.map((heading) => Number(heading.tagName[1]));
    const skips = [];
    for (let index = 1; index < levels.length; index += 1) {
      if (levels[index] - levels[index - 1] > 1) skips.push(`h${levels[index - 1]} to h${levels[index]}`);
    }

    const missingAlt = [];
    const oversized = [];
    let missingDimensions = 0;
    for (const image of document.images) {
      const source = image.currentSrc || image.src || "";
      if (!image.hasAttribute("alt")) missingAlt.push(source);
      if (!image.getAttribute("width") || !image.getAttribute("height")) missingDimensions += 1;
      const displayed = image.clientWidth;
      if (displayed > 0 && image.naturalWidth > displayed * 2) {
        oversized.push({ source, natural: image.naturalWidth, displayed });
      }
    }

    const unsafeBlank = [];
    let emptyLinkText = 0;
    const links = [...document.querySelectorAll("a[href]")];
    for (const link of links) {
      const rel = (link.getAttribute("rel") || "").toLowerCase();
      if (link.target === "_blank" && !/\bnoopener\b|\bnoreferrer\b/.test(rel)) unsafeBlank.push(link.href);
      const labelled = clean(link.textContent)
        || link.getAttribute("aria-label")
        || link.querySelector("img[alt]:not([alt=''])");
      if (!labelled) emptyLinkText += 1;
    }

    const structuredTypes = new Set();
    let invalidStructured = 0;
    const structuredBlocks = [...document.querySelectorAll('script[type="application/ld+json"]')];
    for (const block of structuredBlocks) {
      try {
        const parsed = JSON.parse(block.textContent);
        const entries = [].concat(parsed?.["@graph"] || parsed);
        for (const entry of entries) {
          if (entry && entry["@type"]) structuredTypes.add(String(entry["@type"]));
        }
      } catch (_) {
        invalidStructured += 1;
      }
    }

    let unlabelledFields = 0;
    for (const field of document.querySelectorAll("input, select, textarea")) {
      const type = (field.getAttribute("type") || "").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
      const id = field.getAttribute("id");
      const labelled = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
        || field.closest("label")
        || field.getAttribute("aria-label")
        || field.getAttribute("aria-labelledby")
        || field.getAttribute("title");
      if (!labelled) unlabelledFields += 1;
    }

    let unnamedButtons = 0;
    for (const button of document.querySelectorAll("button, [role='button']")) {
      const named = clean(button.textContent)
        || button.getAttribute("aria-label")
        || button.getAttribute("title")
        || button.querySelector("img[alt]:not([alt='']), svg title");
      if (!named) unnamedButtons += 1;
    }

    const positiveTabindex = [...document.querySelectorAll("[tabindex]")]
      .filter((element) => Number(element.getAttribute("tabindex")) > 0).length;

    const readSiteFile = async (path) => {
      try {
        const response = await fetch(new URL(path, location.origin).href, { credentials: "omit" });
        if (!response.ok) return { found: false, body: "" };
        return { found: true, body: (await response.text()).slice(0, 4_000) };
      } catch (_) {
        return { found: false, body: "" };
      }
    };
    const [robotsTxt, sitemap] = await Promise.all([readSiteFile("/robots.txt"), readSiteFile("/sitemap.xml")]);

    const title = clean(document.title);
    const description = clean(meta("description"));

    return {
      url: location.href.split("#")[0],
      hostname: location.hostname,
      title: { text: title, length: title.length },
      description: { text: description, length: description.length },
      canonical: attribute('link[rel="canonical" i]', "href"),
      robotsMeta: clean(meta("robots")).toLowerCase(),
      generator: clean(meta("generator")),
      lang: document.documentElement.getAttribute("lang") || "",
      charset: document.characterSet || "",
      viewport: clean(meta("viewport")),
      headings: {
        total: headings.length,
        h1: headings.filter((heading) => heading.tagName === "H1").map((heading) => clean(heading.textContent)),
        empty: headings.filter((heading) => !clean(heading.textContent)).length,
        skips: skips.slice(0, LIMIT)
      },
      images: {
        total: document.images.length,
        missingAlt: missingAlt.length,
        missingAltExamples: missingAlt.slice(0, LIMIT),
        missingDimensions,
        oversized: oversized.length,
        oversizedExamples: oversized.slice(0, LIMIT)
      },
      links: {
        total: links.length,
        unsafeBlank: unsafeBlank.length,
        unsafeBlankExamples: unsafeBlank.slice(0, LIMIT),
        emptyText: emptyLinkText
      },
      social: {
        ogTitle: property("og:title"),
        ogDescription: property("og:description"),
        ogImage: property("og:image"),
        twitterCard: meta("twitter:card")
      },
      structuredData: {
        blocks: structuredBlocks.length,
        invalid: invalidStructured,
        types: [...structuredTypes].slice(0, LIMIT)
      },
      accessibility: {
        unlabelledFields,
        unnamedButtons,
        positiveTabindex,
        hasMain: Boolean(document.querySelector("main, [role='main']"))
      },
      content: { wordCount: clean(document.body?.innerText || "").split(" ").filter(Boolean).length },
      site: { robotsTxt, sitemap }
    };
  }

  function plural(count, singular, suffix = "s") {
    return `${count} ${singular}${count === 1 ? "" : suffix}`;
  }

  function robotsBlocksEverything(body) {
    // Only a "Disallow: /" under the catch-all agent blocks the whole site.
    let catchAll = false;
    for (const line of String(body || "").split(/\r?\n/)) {
      const [rawKey, ...rest] = line.split("#")[0].split(":");
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(":").trim();
      if (key === "user-agent") catchAll = value === "*";
      else if (catchAll && key === "disallow" && value === "/") return true;
    }
    return false;
  }

  const RULES = [
    {
      id: "robots-noindex",
      severity: "critical",
      title: "Page is marked noindex",
      test: (facts) => facts.robotsMeta.includes("noindex"),
      detail: (facts) => `The robots meta tag reads "${facts.robotsMeta}", so search engines are told to drop this page.`
    },
    {
      id: "robots-txt-blocks-site",
      severity: "critical",
      title: "robots.txt disallows the whole site",
      test: (facts) => facts.site.robotsTxt.found && robotsBlocksEverything(facts.site.robotsTxt.body),
      detail: () => "robots.txt contains Disallow: / for all crawlers, which blocks the entire site from search."
    },
    {
      id: "title-missing",
      severity: "critical",
      title: "No page title",
      test: (facts) => !facts.title.text,
      detail: () => "The page has no <title>, so search results and browser tabs have nothing to show."
    },
    {
      id: "viewport-missing",
      severity: "critical",
      title: "No responsive viewport tag",
      test: (facts) => !facts.viewport,
      detail: () => "Without <meta name=\"viewport\">, mobile browsers render the desktop layout scaled down."
    },
    {
      id: "title-length",
      severity: "warning",
      title: "Page title length is outside the usual range",
      test: (facts) => Boolean(facts.title.text) && (facts.title.length < 30 || facts.title.length > 60),
      detail: (facts) => `The title is ${plural(facts.title.length, "character")}; roughly 30 to 60 survives truncation in search results.`
    },
    {
      id: "description-missing",
      severity: "warning",
      title: "No meta description",
      test: (facts) => !facts.description.text,
      detail: () => "Search engines will invent a snippet from page text instead of using your wording."
    },
    {
      id: "description-length",
      severity: "notice",
      title: "Meta description length is outside the usual range",
      test: (facts) => Boolean(facts.description.text) && (facts.description.length < 70 || facts.description.length > 160),
      detail: (facts) => `The description is ${plural(facts.description.length, "character")}; roughly 70 to 160 displays in full.`
    },
    {
      id: "h1-missing",
      severity: "warning",
      title: "No H1 heading",
      test: (facts) => facts.headings.h1.length === 0,
      detail: () => "The page has no top-level heading naming what it is about."
    },
    {
      id: "h1-multiple",
      severity: "notice",
      title: "More than one H1 heading",
      test: (facts) => facts.headings.h1.length > 1,
      detail: (facts) => `${plural(facts.headings.h1.length, "H1")} compete to describe the page.`,
      evidence: (facts) => facts.headings.h1.slice(0, EXAMPLES)
    },
    {
      id: "heading-skip",
      severity: "notice",
      title: "Heading levels skip a step",
      test: (facts) => facts.headings.skips.length > 0,
      detail: () => "Screen readers use heading depth to build a page outline, so skipped levels lose structure.",
      evidence: (facts) => facts.headings.skips
    },
    {
      id: "heading-empty",
      severity: "notice",
      title: "Empty headings",
      test: (facts) => facts.headings.empty > 0,
      detail: (facts) => `${plural(facts.headings.empty, "heading")} contain no text, usually left behind by a layout wrapper.`
    },
    {
      id: "lang-missing",
      severity: "warning",
      title: "No lang attribute on <html>",
      test: (facts) => !facts.lang,
      detail: () => "Screen readers and translation tools need <html lang> to pick the right pronunciation and dictionary."
    },
    {
      id: "canonical-missing",
      severity: "notice",
      title: "No canonical URL",
      test: (facts) => !facts.canonical,
      detail: () => "A canonical link tells search engines which URL to credit when the same page is reachable more than one way."
    },
    {
      id: "image-alt-missing",
      severity: "warning",
      title: "Images without an alt attribute",
      test: (facts) => facts.images.missingAlt > 0,
      detail: (facts) => `${facts.images.missingAlt} of ${plural(facts.images.total, "image")} have no alt attribute. Decorative images still need alt="".`,
      evidence: (facts) => facts.images.missingAltExamples
    },
    {
      id: "image-dimensions-missing",
      severity: "warning",
      title: "Images without width and height",
      test: (facts) => facts.images.missingDimensions > 0,
      detail: (facts) => `${plural(facts.images.missingDimensions, "image")} lack width and height attributes, so the layout shifts as they load unless CSS reserves the space.`
    },
    {
      id: "image-oversized",
      severity: "warning",
      title: "Images served much larger than displayed",
      test: (facts) => facts.images.oversized > 0,
      detail: (facts) => `${plural(facts.images.oversized, "image")} are at least twice their displayed width, so visitors download pixels they never see.`,
      evidence: (facts) => facts.images.oversizedExamples.map(
        (image) => `${image.natural}px wide, shown at ${image.displayed}px — ${image.source}`
      )
    },
    {
      id: "link-unsafe-blank",
      severity: "warning",
      title: "New-tab links without rel=noopener",
      test: (facts) => facts.links.unsafeBlank > 0,
      detail: (facts) => `${plural(facts.links.unsafeBlank, "link")} open in a new tab without rel="noopener", giving the target page a handle on this one.`,
      evidence: (facts) => facts.links.unsafeBlankExamples
    },
    {
      id: "link-empty-text",
      severity: "notice",
      title: "Links with no readable text",
      test: (facts) => facts.links.emptyText > 0,
      detail: (facts) => `${plural(facts.links.emptyText, "link")} have no text, aria-label, or described image, so their destination is unannounceable.`
    },
    {
      id: "social-incomplete",
      severity: "notice",
      title: "Incomplete Open Graph tags",
      test: (facts) => !facts.social.ogTitle || !facts.social.ogDescription || !facts.social.ogImage,
      detail: (facts) => {
        const missing = [];
        if (!facts.social.ogTitle) missing.push("og:title");
        if (!facts.social.ogDescription) missing.push("og:description");
        if (!facts.social.ogImage) missing.push("og:image");
        return `Missing ${missing.join(", ")}, so shared links render without a proper preview card.`;
      }
    },
    {
      id: "twitter-card-missing",
      severity: "notice",
      title: "No twitter:card tag",
      test: (facts) => !facts.social.twitterCard,
      detail: () => "Without twitter:card, X and several chat apps fall back to a bare link."
    },
    {
      id: "structured-data-invalid",
      severity: "warning",
      title: "Structured data does not parse",
      test: (facts) => facts.structuredData.invalid > 0,
      detail: (facts) => `${plural(facts.structuredData.invalid, "JSON-LD block")} contain invalid JSON and will be ignored entirely.`
    },
    {
      id: "structured-data-missing",
      severity: "notice",
      title: "No structured data",
      test: (facts) => facts.structuredData.blocks === 0,
      detail: () => "No JSON-LD found. Schema.org markup is what earns rich results for articles, products, and organizations."
    },
    {
      id: "field-unlabelled",
      severity: "warning",
      title: "Form fields without a label",
      test: (facts) => facts.accessibility.unlabelledFields > 0,
      detail: (facts) => `${plural(facts.accessibility.unlabelledFields, "field")} have no label, aria-label, or title.`
    },
    {
      id: "button-unnamed",
      severity: "warning",
      title: "Buttons without an accessible name",
      test: (facts) => facts.accessibility.unnamedButtons > 0,
      detail: (facts) => `${plural(facts.accessibility.unnamedButtons, "button")} announce as "button" with no indication of what they do.`
    },
    {
      id: "tabindex-positive",
      severity: "notice",
      title: "Positive tabindex values",
      test: (facts) => facts.accessibility.positiveTabindex > 0,
      detail: (facts) => `${plural(facts.accessibility.positiveTabindex, "element")} use tabindex above zero, which reorders keyboard focus away from the visual order.`
    },
    {
      id: "main-landmark-missing",
      severity: "notice",
      title: "No main landmark",
      test: (facts) => !facts.accessibility.hasMain,
      detail: () => "A <main> element lets assistive technology skip straight to the page's primary content."
    },
    {
      id: "content-thin",
      severity: "notice",
      title: "Very little page text",
      test: (facts) => facts.content.wordCount < 200,
      detail: (facts) => `${plural(facts.content.wordCount, "word")} of visible text. Pages this short rarely rank for anything competitive.`
    },
    {
      id: "robots-txt-missing",
      severity: "notice",
      title: "No robots.txt",
      test: (facts) => !facts.site.robotsTxt.found,
      detail: () => "Crawlers request /robots.txt first. Serving one lets you point at your sitemap and keep noise out of the index."
    },
    {
      id: "sitemap-missing",
      severity: "notice",
      title: "No sitemap.xml at the site root",
      test: (facts) => !facts.site.sitemap.found,
      detail: () => "No /sitemap.xml. It may live elsewhere, but the root path is where crawlers and most tools look first."
    }
  ];

  const SEVERITY_ORDER = { critical: 0, warning: 1, notice: 2 };

  function evaluate(facts) {
    const findings = RULES
      .filter((rule) => {
        try {
          return rule.test(facts);
        } catch (_) {
          // A malformed fact set must not take the whole report down.
          return false;
        }
      })
      .map((rule) => ({
        id: rule.id,
        severity: rule.severity,
        title: rule.title,
        detail: rule.detail(facts),
        evidence: (rule.evidence?.(facts) || []).filter(Boolean).slice(0, EXAMPLES)
      }));

    return { findings, counts: countSeverities(findings) };
  }

  function countSeverities(findings) {
    const counts = { critical: 0, warning: 0, notice: 0 };
    for (const finding of findings) counts[finding.severity] += 1;
    return counts;
  }

  // Checks that only make sense once several pages of the same site are in hand.
  function crossPage(reports) {
    const byTitle = new Map();
    const byDescription = new Map();
    for (const report of reports) {
      const title = report.facts.title.text;
      const description = report.facts.description.text;
      if (title) byTitle.set(title, [...(byTitle.get(title) || []), report.pageUrl]);
      if (description) byDescription.set(description, [...(byDescription.get(description) || []), report.pageUrl]);
    }

    const duplicates = (groups, id, severity, title, detail) => [...groups.entries()]
      .filter(([, urls]) => urls.length > 1)
      .map(([value, urls]) => ({ id, severity, title, detail: detail(value, urls), evidence: urls.slice(0, EXAMPLES) }));

    return [
      ...duplicates(byTitle, "duplicate-title", "warning", "Pages share a title",
        (value, urls) => `${urls.length} captured pages use the title "${value}", so search engines cannot tell them apart.`),
      ...duplicates(byDescription, "duplicate-description", "notice", "Pages share a meta description",
        (value, urls) => `${urls.length} captured pages use the same meta description.`)
    ];
  }

  function sortFindings(findings) {
    return [...findings].sort((first, second) => SEVERITY_ORDER[first.severity] - SEVERITY_ORDER[second.severity]);
  }

  async function collect(tabId) {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func: collectFacts });
    return injection.result;
  }

  async function audit(tabId, pageLabel) {
    const facts = await collect(tabId);
    const { findings, counts } = evaluate(facts);
    return { pageLabel, pageUrl: facts.url, facts, findings: sortFindings(findings), counts };
  }

  self.BrowserSnapsAudit = { audit, collect, countSeverities, crossPage, evaluate, sortFindings };
})();
