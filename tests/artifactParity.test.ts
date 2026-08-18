import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { analyzeArtifactFallback } from "../src/compiler/artifacts/fallback";
import type { ArtifactAnalysisResult } from "../src/types/artifacts";

interface ParityCase {
  id: string;
  source: string;
}

let analyzeWasm: (source: string, target?: string) => string;
let fixtures: ParityCase[] = [];

beforeAll(async () => {
  const fixturePath = resolve(process.cwd(), "fixtures/artifacts/parity.json");
  const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as { cases: ParityCase[] };
  fixtures = fixture.cases;

  const wasmPath = resolve(process.cwd(), "src/wasm/pkg/lgir_core_bg.wasm");
  const module = new WebAssembly.Module(await readFile(wasmPath));
  const wasm = await import("../src/wasm/pkg/lgir_core.js");
  wasm.initSync({ module });
  analyzeWasm = wasm.analyze_artifact;
});

describe("artifact Rust/Wasm and TypeScript fallback parity", () => {
  it("returns identical normalized values, hashes, and diagnostics for shared fixtures", async () => {
    for (const fixture of fixtures) {
      const fallback = await analyzeArtifactFallback(fixture.source);
      const rustWasm = JSON.parse(analyzeWasm(fixture.source)) as ArtifactAnalysisResult;
      expect(
        {
          ok: fallback.ok,
          sourceHash: fallback.sourceHash,
          normalized: fallback.normalized,
          diagnostics: fallback.diagnostics,
        },
        fixture.id,
      ).toEqual({
        ok: rustWasm.ok,
        sourceHash: rustWasm.sourceHash,
        normalized: rustWasm.normalized,
        diagnostics: rustWasm.diagnostics,
      });
    }
  });
});
