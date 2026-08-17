/// <reference lib="webworker" />

import type { OntologySelection, ResolvedBundleAsset, Target } from "../types";
import { analyzeArtifactFallback, compileBundleFallback, formatArtifactFallback, sliceOntologyFallback } from "./artifacts/fallback";
import { analyzeFallback, compileFallback, formatFallback, migrateFallback } from "./fallback";

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
let runtime: "wasm" | "fallback" = "fallback";

async function loadWasm() {
  try {
    const module = (await import("../wasm/pkg/lgir_core.js")) as unknown as WasmModule;
    await module.default();
    wasm = module;
    runtime = "wasm";
  } catch {
    wasm = null;
    runtime = "fallback";
  }
}

const ready = loadWasm();

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  await ready;
  try {
    let result: unknown;
    const hasArtifactWasm = Boolean(wasm?.analyze_artifact && wasm.format_artifact && wasm.compile_bundle && wasm.slice_ontology);
    const useWasm = Boolean(wasm && (["analyze", "compile", "format", "migrate"].includes(request.operation) || hasArtifactWasm));
    if (useWasm && wasm) {
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
      result = JSON.parse(raw);
    } else {
      result =
        request.operation === "analyze"
          ? await analyzeFallback(request.source, request.target)
          : request.operation === "compile"
            ? await compileFallback(request.source, request.target ?? "codex")
            : request.operation === "format"
              ? await formatFallback(request.source)
              : request.operation === "migrate"
                ? await migrateFallback(request.source, request.toVersion ?? "ladder.dev/v1alpha1")
                : request.operation === "analyzeArtifact"
                  ? await analyzeArtifactFallback(request.source)
                  : request.operation === "formatArtifact"
                    ? await formatArtifactFallback(request.source)
                    : request.operation === "compileBundle"
                      ? await compileBundleFallback(request.source, request.resolvedAssets ?? [], request.target ?? "codex")
                      : await sliceOntologyFallback(request.source, request.selection ?? {});
    }
    self.postMessage({ id: request.id, ok: true, result, runtime: useWasm ? runtime : "fallback" });
  } catch (error) {
    self.postMessage({ id: request.id, ok: false, error: error instanceof Error ? error.message : String(error), runtime });
  }
});
