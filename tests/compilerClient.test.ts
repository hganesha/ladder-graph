import { afterEach, describe, expect, it, vi } from "vitest";
import { CompilerClient } from "../src/compiler/client";

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    super();
    FakeWorker.instances.push(this);
  }
}

afterEach(() => {
  FakeWorker.instances = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("compiler worker client", () => {
  it("rejects pending work on a worker crash and respawns for the next request", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = new CompilerClient();
    const failed = client.analyze("kind: Workflow\n");
    const first = FakeWorker.instances[0];

    first.dispatchEvent(new ErrorEvent("error", { message: "chunk failed" }));
    await expect(failed).rejects.toThrow("Compiler worker crashed: chunk failed");
    expect(first.terminate).toHaveBeenCalledOnce();

    const recovered = client.analyze("kind: Workflow\n");
    const second = FakeWorker.instances[1];
    expect(second).not.toBe(first);
    second.dispatchEvent(
      new MessageEvent("message", {
        data: {
          id: 2,
          ok: true,
          runtime: "wasm",
          result: { ok: false, sourceHash: "", diagnostics: [], nodeOrder: [], stats: {} },
        },
      }),
    );
    await expect(recovered).resolves.toEqual(expect.objectContaining({ ok: false }));
  });

  it("rejects all pending work when a request times out", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const client = new CompilerClient();
    const first = client.analyze("one");
    const second = client.analyze("two");
    const firstExpectation = expect(first).rejects.toThrow("timed out after 10 seconds");
    const secondExpectation = expect(second).rejects.toThrow("timed out after 10 seconds");

    await vi.advanceTimersByTimeAsync(10_000);

    await firstExpectation;
    await secondExpectation;
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });
});
