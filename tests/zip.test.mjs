import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/zip.js", import.meta.url), "utf8");
const context = {
  Blob,
  DataView,
  TextEncoder,
  Uint8Array,
  Uint32Array,
  self: {}
};
vm.runInNewContext(source, context);

test("creates a valid uncompressed ZIP container with multiple files", async () => {
  const zip = await context.self.BrowserSnapsZip.createZip([
    { name: "Desktop/Home.png", blob: new Blob(["hello"]) },
    { name: "Mobile/Home.png", blob: new Blob(["world"]) }
  ]);
  const bytes = new Uint8Array(await zip.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const text = Buffer.from(bytes).toString("latin1");

  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(14, true), 0x3610a686);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 14, true), 2);
  assert.match(text, /Desktop\/Home\.png/);
  assert.match(text, /Mobile\/Home\.png/);
  assert.equal(zip.type, "application/zip");
});
