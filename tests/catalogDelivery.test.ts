import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ARTIFACT_INDEX, ROLE_TEMPLATES, WORKFLOW_TEMPLATES } from "../src/generated/catalog";
import { loadWorkflowTemplate } from "../src/lib/catalogRepository";

const entries = [...WORKFLOW_TEMPLATES, ...ROLE_TEMPLATES, ...ARTIFACT_INDEX];

describe("catalog delivery", () => {
  it("publishes unique content-addressed bodies whose hashes match the metadata index", async () => {
    expect(entries).toHaveLength(704);
    expect(new Set(entries.map((entry) => entry.bodyUrl)).size).toBe(entries.length);

    for (const entry of entries) {
      expect(entry.bodyUrl).toMatch(new RegExp(`${entry.bodyHash.slice(0, 16)}\\.json$`));
      const serialized = (await readFile(resolve(process.cwd(), "public", entry.bodyUrl), "utf8")).trimEnd();
      expect(createHash("sha256").update(serialized).digest("hex"), entry.id).toBe(entry.bodyHash);
    }
  });

  it("keeps heavy bodies out of the startup metadata and deduplicates concurrent requests", async () => {
    expect(WORKFLOW_TEMPLATES.every((entry) => !("yaml" in entry))).toBe(true);
    expect(ROLE_TEMPLATES.every((entry) => !("prompt" in entry))).toBe(true);
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(originalFetch);
    vi.stubGlobal("fetch", fetchSpy);

    const [first, second] = await Promise.all([
      loadWorkflowTemplate(WORKFLOW_TEMPLATES[0].id),
      loadWorkflowTemplate(WORKFLOW_TEMPLATES[0].id),
    ]);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(first).toEqual(second);
    expect(first.yaml).toContain("kind: Workflow");
  });
});
