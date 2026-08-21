import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/audit.js", import.meta.url), "utf8");

// Run in this realm so findings are plain host arrays that deepEqual can compare.
const scope = { self: {}, chrome: { scripting: {} } };
new Function("self", "chrome", source)(scope.self, scope.chrome);
const Audit = scope.self.BrowserSnapsAudit;

// A page with nothing wrong, so each test can break exactly one thing.
function cleanFacts(overrides = {}) {
  return {
    url: "https://example.com/pricing",
    hostname: "example.com",
    title: { text: "Pricing plans for teams of every size", length: 36 },
    description: {
      text: "Compare BrowserSnaps plans, see what each tier includes, and pick the one that fits how your team documents the web.",
      length: 118
    },
    canonical: "https://example.com/pricing",
    robotsMeta: "index, follow",
    generator: "",
    lang: "en",
    charset: "UTF-8",
    viewport: "width=device-width, initial-scale=1",
    headings: { total: 6, h1: ["Pricing"], empty: 0, skips: [] },
    images: { total: 4, missingAlt: 0, missingAltExamples: [], missingDimensions: 0, oversized: 0, oversizedExamples: [] },
    links: { total: 20, unsafeBlank: 0, unsafeBlankExamples: [], emptyText: 0 },
    social: { ogTitle: "Pricing", ogDescription: "Plans", ogImage: "https://example.com/og.png", twitterCard: "summary" },
    structuredData: { blocks: 1, invalid: 0, types: ["Product"] },
    accessibility: { unlabelledFields: 0, unnamedButtons: 0, positiveTabindex: 0, hasMain: true },
    content: { wordCount: 850 },
    site: { robotsTxt: { found: true, body: "User-agent: *\nAllow: /" }, sitemap: { found: true, body: "<urlset/>" } },
    ...overrides
  };
}

const ids = (facts) => Audit.evaluate(facts).findings.map((finding) => finding.id);

test("a healthy page produces no findings", () => {
  const { findings, counts } = Audit.evaluate(cleanFacts());
  assert.deepEqual(findings, []);
  assert.deepEqual(counts, { critical: 0, warning: 0, notice: 0 });
});

test("flags noindex as critical", () => {
  const { findings, counts } = Audit.evaluate(cleanFacts({ robotsMeta: "noindex, nofollow" }));
  const noindex = findings.find((finding) => finding.id === "robots-noindex");
  assert.equal(noindex.severity, "critical");
  assert.match(noindex.detail, /noindex, nofollow/);
  assert.equal(counts.critical, 1);
});

test("only a catch-all Disallow: / counts as blocking the site", () => {
  const blocked = { found: true, body: "User-agent: *\nDisallow: /" };
  const scoped = { found: true, body: "User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin" };
  const commented = { found: true, body: "User-agent: *\n# Disallow: /\nDisallow: /tmp" };

  assert.ok(ids(cleanFacts({ site: { robotsTxt: blocked, sitemap: { found: true } } })).includes("robots-txt-blocks-site"));
  assert.ok(!ids(cleanFacts({ site: { robotsTxt: scoped, sitemap: { found: true } } })).includes("robots-txt-blocks-site"));
  assert.ok(!ids(cleanFacts({ site: { robotsTxt: commented, sitemap: { found: true } } })).includes("robots-txt-blocks-site"));
});

test("checks title and description length only when they exist", () => {
  assert.deepEqual(ids(cleanFacts({ title: { text: "", length: 0 } })), ["title-missing"]);
  assert.deepEqual(ids(cleanFacts({ title: { text: "Pricing", length: 7 } })), ["title-length"]);
  assert.deepEqual(ids(cleanFacts({ description: { text: "", length: 0 } })), ["description-missing"]);
});

test("reports oversized images with measured evidence", () => {
  const findings = Audit.evaluate(cleanFacts({
    images: {
      total: 4,
      missingAlt: 0,
      missingAltExamples: [],
      missingDimensions: 0,
      oversized: 2,
      oversizedExamples: [
        { source: "https://example.com/hero.png", natural: 3200, displayed: 400 },
        { source: "https://example.com/logo.png", natural: 900, displayed: 120 }
      ]
    }
  })).findings;

  const oversized = findings.find((finding) => finding.id === "image-oversized");
  assert.equal(oversized.severity, "warning");
  assert.deepEqual(oversized.evidence, [
    "3200px wide, shown at 400px — https://example.com/hero.png",
    "900px wide, shown at 120px — https://example.com/logo.png"
  ]);
});

test("names exactly which Open Graph tags are missing", () => {
  const findings = Audit.evaluate(cleanFacts({
    social: { ogTitle: "Pricing", ogDescription: "", ogImage: "", twitterCard: "summary" }
  })).findings;
  const social = findings.find((finding) => finding.id === "social-incomplete");
  assert.match(social.detail, /Missing og:description, og:image/);
});

test("sorts findings critical first", () => {
  const findings = Audit.evaluate(cleanFacts({
    robotsMeta: "noindex",
    lang: "",
    structuredData: { blocks: 0, invalid: 0, types: [] }
  })).findings;
  assert.deepEqual(
    Audit.sortFindings(findings).map((finding) => finding.severity),
    ["critical", "warning", "notice"]
  );
});

test("a broken fact set skips its rule instead of failing the report", () => {
  const { findings } = Audit.evaluate(cleanFacts({ images: null }));
  assert.ok(findings.every((finding) => !finding.id.startsWith("image-")));
});

test("finds duplicate titles and descriptions across captured pages", () => {
  const report = (pageUrl, title, description) => ({
    pageUrl,
    facts: { title: { text: title }, description: { text: description } }
  });
  const findings = Audit.crossPage([
    report("https://example.com/a", "Home", "One description"),
    report("https://example.com/b", "Home", "Another description"),
    report("https://example.com/c", "Contact", "One description")
  ]);

  const title = findings.find((finding) => finding.id === "duplicate-title");
  assert.equal(title.severity, "warning");
  assert.deepEqual(title.evidence, ["https://example.com/a", "https://example.com/b"]);
  const description = findings.find((finding) => finding.id === "duplicate-description");
  assert.deepEqual(description.evidence, ["https://example.com/a", "https://example.com/c"]);
});

test("ignores empty titles when looking for duplicates", () => {
  const findings = Audit.crossPage([
    { pageUrl: "https://example.com/a", facts: { title: { text: "" }, description: { text: "" } } },
    { pageUrl: "https://example.com/b", facts: { title: { text: "" }, description: { text: "" } } }
  ]);
  assert.deepEqual(findings, []);
});
