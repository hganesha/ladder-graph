import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  AnalysisResult,
  ArtifactAnalysisResult,
  BundleCompileResult,
  CompileResult,
  FormatResult,
  OntologySelection,
  OntologySliceResult,
  ResolvedBundleAsset,
  Target,
} from "../src/types";

type WasmCompiler = typeof import("../src/wasm/pkg/lgir_core.js");

let compilerPromise: Promise<WasmCompiler> | undefined;

async function compiler() {
  compilerPromise ??= (async () => {
    const wasm = await import("../src/wasm/pkg/lgir_core.js");
    const module = new WebAssembly.Module(await readFile(resolve(process.cwd(), "src/wasm/pkg/lgir_core_bg.wasm")));
    wasm.initSync({ module });
    return wasm;
  })();
  return compilerPromise;
}

async function invoke<T>(operation: keyof WasmCompiler, ...args: string[]): Promise<T> {
  const wasm = await compiler();
  const callable = wasm[operation] as (...values: string[]) => string;
  return JSON.parse(callable(...args)) as T;
}

export function analyzeWasm(source: string, target?: Target) {
  return invoke<AnalysisResult>("analyze", source, ...(target ? [target] : []));
}

export function compileWasm(source: string, target: Target) {
  return invoke<CompileResult>("compile", source, target);
}

export function formatWasm(source: string) {
  return invoke<FormatResult>("format", source);
}

export function analyzeArtifactWasm(source: string) {
  return invoke<ArtifactAnalysisResult>("analyze_artifact", source);
}

export function formatArtifactWasm(source: string) {
  return invoke<FormatResult>("format_artifact", source);
}

export function compileBundleWasm(source: string, assets: ResolvedBundleAsset[], target: Target) {
  return invoke<BundleCompileResult>("compile_bundle", source, JSON.stringify(assets), target);
}

export function sliceOntologyWasm(source: string, selection: OntologySelection) {
  return invoke<OntologySliceResult>("slice_ontology", source, JSON.stringify(selection));
}
