import { describe, expect, it } from "vitest";
import { createBundleArchive, parseBundleArchive } from "../src/lib/bundleArchive";

const bundleSource = `apiVersion: ladder.dev/v1alpha1
kind: WorkflowBundle
metadata:
  name: portable-review
spec:
  workflowRef: ladder://workflows/example/review
  forms:
    - ref: ladder://forms/example/intake
`;
const assets = [
  {
    ref: "ladder://forms/example/intake",
    source: "apiVersion: ladder.dev/v1alpha1\nkind: Form\nmetadata:\n  name: intake\nspec:\n  role: start\n  pages: []\n",
  },
  {
    ref: "ladder://workflows/example/review",
    source:
      "apiVersion: ladder.dev/v1alpha1\nkind: Workflow\nmetadata:\n  name: review\nspec:\n  objective: Review\n  nodes: []\n  edges: []\n",
  },
];

describe("portable bundle archives", () => {
  it("round-trips a deterministic bundle and all attached sources", async () => {
    const first = await createBundleArchive(bundleSource, assets, "codex");
    const second = await createBundleArchive(bundleSource, [...assets].reverse(), "codex");
    expect(second).toBe(first);

    const archive = await parseBundleArchive(first);
    expect(archive.bundle.name).toBe("portable-review");
    expect(archive.assets.map((asset) => asset.ref)).toEqual(["ladder://forms/example/intake", "ladder://workflows/example/review"]);
  });

  it("rejects tampering and incomplete attached assets", async () => {
    const serialized = await createBundleArchive(bundleSource, assets, "codex");
    const tampered = serialized.replace("kind: Form", "kind: Document");
    await expect(parseBundleArchive(tampered)).rejects.toThrow(/SHA-256/);

    const parsed = JSON.parse(serialized) as { assets: Array<{ ref: string }> };
    parsed.assets = parsed.assets.filter((asset) => !asset.ref.includes("forms/example"));
    await expect(parseBundleArchive(JSON.stringify(parsed))).rejects.toThrow(/missing attached asset/);
  });
});
