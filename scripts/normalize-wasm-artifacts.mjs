import { readFile, writeFile } from "node:fs/promises";

const generatedIgnore = new URL("../src/wasm/pkg/.gitignore", import.meta.url);
await writeFile(generatedIgnore, "# Generated browser compiler artifacts are intentionally versioned.\n!*\n", "utf8");

const generatedWasm = new URL("../src/wasm/pkg/lgir_core_bg.wasm", import.meta.url);
const wasm = await readFile(generatedWasm);

function unsignedLeb128(offset) {
  let value = 0;
  let shift = 0;
  let cursor = offset;
  while (cursor < wasm.length) {
    const byte = wasm[cursor];
    value |= (byte & 0x7f) << shift;
    cursor += 1;
    if ((byte & 0x80) === 0) return { value, next: cursor };
    shift += 7;
    if (shift > 35) throw new Error("Invalid WebAssembly section length.");
  }
  throw new Error("Unexpected end of WebAssembly section length.");
}

const sections = [wasm.subarray(0, 8)];
let offset = 8;
while (offset < wasm.length) {
  const sectionStart = offset;
  const sectionId = wasm[offset];
  const length = unsignedLeb128(offset + 1);
  const sectionEnd = length.next + length.value;
  if (sectionEnd > wasm.length) throw new Error("WebAssembly section extends past the binary boundary.");
  if (sectionId !== 0) sections.push(wasm.subarray(sectionStart, sectionEnd));
  offset = sectionEnd;
}

await writeFile(generatedWasm, Buffer.concat(sections));
