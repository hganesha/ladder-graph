import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const html = await readFile(resolve(root, "dist/index.html"), "utf8");
const entry = html.match(/<script[^>]+src="\/assets\/(index-[^"]+\.js)"/)?.[1];
if (!entry) throw new Error("Could not find the production entry bundle in dist/index.html");

const content = await readFile(resolve(root, "dist/assets", entry));
const rawLimit = 1_800_000;
const gzipLimit = 550_000;
const gzipBytes = gzipSync(content).byteLength;
if (content.byteLength > rawLimit || gzipBytes > gzipLimit) {
  throw new Error(
    `${entry} exceeds the bundle budget: ${content.byteLength} raw / ${gzipBytes} gzip bytes (limits ${rawLimit} / ${gzipLimit})`,
  );
}
console.log(`${entry}: ${content.byteLength} raw / ${gzipBytes} gzip bytes`);
