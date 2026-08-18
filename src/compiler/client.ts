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
} from "../types";

type Operation = "analyze" | "compile" | "format" | "migrate" | "analyzeArtifact" | "formatArtifact" | "compileBundle" | "sliceOntology";
type Pending = {
  resolve: (value: never) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const REQUEST_TIMEOUT_MS = 10_000;

export class CompilerClient {
  private worker: Worker | null = null;
  private sequence = 0;
  private pending = new Map<number, Pending>();
  runtime: "wasm" | "fallback" = "fallback";

  private failAll(error: Error) {
    const worker = this.worker;
    this.worker = null;
    worker?.terminate();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private ensureWorker() {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "ladder-compiler" });
    this.worker = worker;
    worker.addEventListener("message", (event) => {
      if (this.worker !== worker) return;
      const { id, ok, result, error, runtime } = event.data as {
        id: number;
        ok: boolean;
        result: never;
        error?: string;
        runtime: "wasm" | "fallback";
      };
      this.runtime = runtime;
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      clearTimeout(pending.timeout);
      if (ok) pending.resolve(result);
      else pending.reject(new Error(error || "Compiler worker failed"));
    });
    worker.addEventListener("error", (event) => {
      if (this.worker === worker) this.failAll(new Error(`Compiler worker crashed: ${event.message || "unknown error"}`));
    });
    worker.addEventListener("messageerror", () => {
      if (this.worker === worker) this.failAll(new Error("Compiler worker sent an unreadable message"));
    });
    return worker;
  }

  private request<T>(operation: Operation, source: string, extras: Record<string, unknown> = {}) {
    const id = ++this.sequence;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.has(id)) this.failAll(new Error(`Compiler request timed out after ${REQUEST_TIMEOUT_MS / 1_000} seconds`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve: resolve as (value: never) => void, reject, timeout });
      try {
        this.ensureWorker().postMessage({ id, operation, source, ...extras });
      } catch (error) {
        this.failAll(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  analyze(source: string, target?: Target) {
    return this.request<AnalysisResult>("analyze", source, { target });
  }
  compile(source: string, target: Target) {
    return this.request<CompileResult>("compile", source, { target });
  }
  format(source: string) {
    return this.request<FormatResult>("format", source);
  }
  migrate(source: string, toVersion: string) {
    return this.request<FormatResult>("migrate", source, { toVersion });
  }
  analyzeArtifact(source: string) {
    return this.request<ArtifactAnalysisResult>("analyzeArtifact", source);
  }
  formatArtifact(source: string) {
    return this.request<FormatResult>("formatArtifact", source);
  }
  compileBundle(source: string, resolvedAssets: ResolvedBundleAsset[], target: Target) {
    return this.request<BundleCompileResult>("compileBundle", source, { resolvedAssets, target });
  }
  sliceOntology(source: string, selection: OntologySelection) {
    return this.request<OntologySliceResult>("sliceOntology", source, { selection });
  }
}

export const compiler = new CompilerClient();
