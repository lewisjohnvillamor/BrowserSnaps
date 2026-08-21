import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const background = fs.readFileSync(new URL("../src/background.js", import.meta.url), "utf8");

function boot() {
  const injections = [];
  const context = {
    URL,
    console,
    self: {},
    setTimeout,
    clearTimeout,
    chrome: {
      runtime: {
        onMessage: { addListener: () => {} },
        sendMessage: async () => {}
      },
      scripting: {
        executeScript: async (injection) => {
          injections.push(injection);
          return [{ result: null }];
        }
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL("../src/platform-chrome.js", import.meta.url), "utf8"), context);
  vm.runInContext(fs.readFileSync(new URL("../src/indicator.js", import.meta.url), "utf8"), context);
  vm.runInContext(fs.readFileSync(new URL("../src/audit.js", import.meta.url), "utf8"), context);
  vm.runInContext(background, context);
  return { context, injections };
}

async function collect(dom) {
  const { context, injections } = boot();
  await context.collectImages(1);
  const sandbox = { URL, document: dom.document, getComputedStyle: dom.getComputedStyle, location: dom.location };
  vm.createContext(sandbox);
  return vm.runInContext(`(${injections[0].func.toString()})()`, sandbox);
}

const image = (source, naturalWidth = 40, naturalHeight = 40) => ({
  currentSrc: source,
  src: "",
  dataset: {},
  naturalWidth,
  naturalHeight
});

test("numbers image files and keeps a recognizable extension", () => {
  const { context } = boot();
  assert.equal(context.imageFileName("https://cdn.example.net/photos/My Photo.JPG", 0, 2), "01-My-Photo.jpg");
  assert.equal(context.imageFileName("https://cdn.example.net/a/b/hero.png", 9, 2), "10-hero.png");
});

test("falls back to .jpg for extensionless CDN URLs and unnamed paths", () => {
  const { context } = boot();
  assert.equal(context.imageFileName("https://images.example.net/photo?w=800&fm=webp", 0, 1), "1-photo.jpg");
  assert.equal(context.imageFileName("https://example.com/", 0, 1), "1-image.jpg");
});

test("collects rendered images, posters, and CSS backgrounds without duplicates", async () => {
  const backgrounds = [
    { background: 'url("https://example.com/hero.webp")' },
    { background: "none" },
    { background: 'url(https://example.com/hero.webp) , url("/tile.png")' }
  ];
  const result = await collect({
    location: { hostname: "example.com" },
    getComputedStyle: (element) => ({ backgroundImage: element.background }),
    document: {
      baseURI: "https://example.com/page",
      images: [
        image("https://example.com/a.png"),
        image("https://cdn.example.net/b.jpg?v=2"),
        image("https://example.com/a.png")
      ],
      querySelectorAll: (selector) =>
        (selector === "video[poster]" ? [{ poster: "https://example.com/poster.jpg" }] : backgrounds)
    }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    images: [
      "https://example.com/a.png",
      "https://cdn.example.net/b.jpg?v=2",
      "https://example.com/poster.jpg",
      "https://example.com/hero.webp",
      "https://example.com/tile.png"
    ],
    skipped: 0,
    hostname: "example.com"
  });
});

test("skips inline sources and tracking pixels the downloader cannot use", async () => {
  const result = await collect({
    location: { hostname: "example.com" },
    getComputedStyle: () => ({ backgroundImage: "none" }),
    document: {
      baseURI: "https://example.com/page",
      images: [
        image("data:image/gif;base64,R0lGOD"),
        image("blob:https://example.com/9f2c"),
        image("https://example.com/pixel.gif", 1, 1),
        image("https://example.com/real.png")
      ],
      querySelectorAll: () => []
    }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)).images, ["https://example.com/real.png"]);
  assert.equal(result.skipped, 3);
});
