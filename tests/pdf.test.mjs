import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/pdf.js", import.meta.url), "utf8");
const context = {
  TextEncoder,
  Uint8Array,
  atob,
  self: {}
};
vm.runInNewContext(source, context);

test("creates a structurally complete PDF from a JPEG capture", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
  const pdf = context.self.BrowserSnapsPdf.createPdf([
    {
      data: jpeg,
      width: 1440,
      height: 900,
      pageLabel: "Home",
      profileLabel: "Desktop",
      viewport: "1440 x 900",
      pageUrl: "https://example.com/",
      offsetY: 0,
      documentHeight: 900
    }
  ]);
  const text = Buffer.from(pdf).toString("latin1");

  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 1/);
  assert.match(text, /\/Subtype \/Image/);
  assert.match(text, /\/MediaBox \[0 0 612 792\]/);
  assert.doesNotMatch(text, /Home \\| Desktop/);
  assert.doesNotMatch(text, /https:\/\/example.com/);
  assert.ok(text.endsWith("%%EOF"));
});

test("uses portrait Letter pages for every responsive capture", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
  const pdf = context.self.BrowserSnapsPdf.createPdf([
    { data: jpeg, width: 390, height: 844, profileLabel: "Mobile" }
  ]);
  const text = Buffer.from(pdf).toString("latin1");

  assert.match(text, /\/MediaBox \[0 0 612 792\]/);
});

test("paginates one continuous full-page screenshot at print boundaries", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
  const pdf = context.self.BrowserSnapsPdf.createPdf([
    {
      data: jpeg,
      width: 1440,
      height: 6300,
      pageLabel: "Home",
      profileLabel: "Desktop",
      pageUrl: "https://example.com/",
      offsetY: 0,
      documentHeight: 6300
    }
  ]);
  const text = Buffer.from(pdf).toString("latin1");

  assert.match(text, /\/Count 4/);
  assert.doesNotMatch(text, /Page 1 of 4/);
});

test("rejects an empty capture set", () => {
  assert.throws(() => context.self.BrowserSnapsPdf.createPdf([]), /no screenshots/i);
});
