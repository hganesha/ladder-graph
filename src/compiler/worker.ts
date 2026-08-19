/// <reference lib="webworker" />

import type { OntologySelection, ResolvedBundleAsset, Target } from "../types";

type Operation = "analyze" | "compile" | "format" | "migrate" | "analyzeArtifact" | "formatArtifact" | "compileBundle" | "sliceOntology";
interface WorkerRequest {
  id: number;
  operation: Operation;
  source: string;
  target?: Target;
  toVersion?: string;
  resolvedAssets?: ResolvedBundleAsset[];
  selection?: OntologySelection;
}

interface WasmModule {
  default: () => Promise<unknown>;
  analyze: (source: string, target?: string) => string;
  compile: (source: string, target: string) => string;
  format: (source: string) => string;
  migrate: (source: string, toVersion: string) => string;
  analyze_artifact?: (source: string, target?: string) => string;
  format_artifact?: (source: string) => string;
  compile_bundle?: (source: string, resolvedAssetsJson: string, target: string) => string;
  slice_ontology?: (source: string, selectionJson: string) => string;
}

let wasm: WasmModule | null = null;
let initializationError: Error | null = null;

async function loadWasm() {
  try {
    const module = (await import("../wasm/pkg/lgir_core.js")) as unknown as WasmModule;
    await module.default();
    wasm = module;
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    console.error("Ladder Graph could not initialize its Rust/WebAssembly compiler.", initializationError);
    wasm = null;
  }
}

const ready = loadWasm();

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  await ready;
  try {
    if (!wasm) throw new Error(`Rust/WebAssembly compiler unavailable: ${initializationError?.message ?? "initialization failed"}`);
    const hasArtifactApi = Boolean(wasm.analyze_artifact && wasm.format_artifact && wasm.compile_bundle && wasm.slice_ontology);
    if (!hasArtifactApi && !["analyze", "compile", "format", "migrate"].includes(request.operation)) {
      throw new Error(`Rust/WebAssembly compiler does not support ${request.operation}`);
    }
    const raw =
      request.operation === "analyze"
        ? wasm.analyze(request.source, request.target)
        : request.operation === "compile"
          ? wasm.compile(request.source, request.target ?? "codex")
          : request.operation === "format"
            ? wasm.format(request.source)
            : request.operation === "migrate"
              ? wasm.migrate(request.source, request.toVersion ?? "ladder.dev/v1alpha1")
              : request.operation === "analyzeArtifact"
                ? wasm.analyze_artifact!(request.source, request.target)
                : request.operation === "formatArtifact"
                  ? wasm.format_artifact!(request.source)
                  : request.operation === "compileBundle"
                    ? wasm.compile_bundle!(request.source, JSON.stringify(request.resolvedAssets ?? []), request.target ?? "codex")
                    : wasm.slice_ontology!(request.source, JSON.stringify(request.selection ?? {}));
    self.postMessage({ id: request.id, ok: true, result: JSON.parse(raw), runtime: "wasm" });
  } catch (error) {
    self.postMessage({ id: request.id, ok: false, error: error instanceof Error ? error.message : String(error), runtime: "wasm" });
  }
});
