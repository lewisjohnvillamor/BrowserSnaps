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
      part: 1,
      parts: 1
    }
  ]);
  const text = Buffer.from(pdf).toString("latin1");

  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 1/);
  assert.match(text, /\/Subtype \/Image/);
  assert.match(text, /\/MediaBox \[0 0 842 595\]/);
  assert.match(text, /Home \\| Desktop 1440 x 900/);
  assert.match(text, /https:\/\/example.com\/ \\| Section 1 of 1/);
  assert.ok(text.endsWith("%%EOF"));
});

test("uses a portrait A4 page for mobile captures", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
  const pdf = context.self.BrowserSnapsPdf.createPdf([
    { data: jpeg, width: 390, height: 844, profileLabel: "Mobile" }
  ]);
  const text = Buffer.from(pdf).toString("latin1");

  assert.match(text, /\/MediaBox \[0 0 595 842\]/);
});

test("rejects an empty capture set", () => {
  assert.throws(() => context.self.BrowserSnapsPdf.createPdf([]), /no screenshots/i);
});
