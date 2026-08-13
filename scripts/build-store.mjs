import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

if (manifest.version !== packageJson.version) {
  throw new Error(`Version mismatch: manifest ${manifest.version}, package ${packageJson.version}`);
}

const dist = path.join(root, "dist");
const staging = path.join(dist, "extension");
const archive = path.join(dist, `BrowserSnaps-v${manifest.version}-chrome-web-store.zip`);
const chromiumArchive = path.join(dist, `BrowserSnaps-v${manifest.version}-chromium.zip`);

await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });

for (const entry of ["manifest.json", "LICENSE", "icons", "src"]) {
  await cp(path.join(root, entry), path.join(staging, entry), { recursive: true });
}
await rm(path.join(staging, "src/platform-firefox.js"), { force: true });
await rm(path.join(staging, "src/platform-safari.js"), { force: true });

await rm(archive, { force: true });

async function filesBelow(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(absolute, relative));
    else files.push({ name: relative, blob: new Blob([await readFile(absolute)]) });
  }
  return files;
}

const zipSource = await readFile(path.join(root, "src/zip.js"), "utf8");
const context = { Blob, DataView, TextEncoder, Uint8Array, Uint32Array, self: {} };
vm.runInNewContext(zipSource, context);
const zip = await context.self.BrowserSnapsZip.createZip(await filesBelow(staging));
await writeFile(archive, new Uint8Array(await zip.arrayBuffer()));
await writeFile(chromiumArchive, new Uint8Array(await zip.arrayBuffer()));

const archiveSize = (await stat(archive)).size;
console.log(`Created ${path.relative(root, archive)} (${Math.ceil(archiveSize / 1024)} KB)`);
console.log(`Created ${path.relative(root, chromiumArchive)} for Chrome, Edge, Brave, and Opera`);
