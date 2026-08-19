import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const localValues = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => localValues.get(key) ?? null,
    setItem: (key: string, value: string) => {
      localValues.set(key, String(value));
    },
    removeItem: (key: string) => {
      localValues.delete(key);
    },
    clear: () => localValues.clear(),
    key: (index: number) => [...localValues.keys()][index] ?? null,
    get length() {
      return localValues.size;
    },
  } satisfies Storage,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });

Object.defineProperty(globalThis, "fetch", {
  configurable: true,
  writable: true,
  value: async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, window.location.origin);
    if (!url.pathname.startsWith("/catalog/bodies/")) throw new Error(`Unexpected test fetch: ${url}`);
    try {
      const body = await readFile(resolve(process.cwd(), "public", url.pathname.slice(1)), "utf8");
      return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  },
});
