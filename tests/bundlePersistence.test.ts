import { afterEach, describe, expect, it } from "vitest";
import { db, listBundleAssets, listRevisions, loadRevision, saveArtifactProject, saveBundleAssets } from "../src/lib/persistence";

afterEach(async () => {
  await db.bundleAssets.clear();
  await db.revisions.clear();
  await db.projects.clear();
});

describe("bundle persistence", () => {
  it("stores bundle projects, resolved assets, and complete revision bodies", async () => {
    const project = await saveArtifactProject({
      projectId: null,
      name: "Portable review",
      yaml: "kind: WorkflowBundle\nmetadata:\n  name: portable-review\n",
      lastValidYaml: "kind: WorkflowBundle\nmetadata:\n  name: portable-review\n",
      target: "codex",
      valid: true,
      artifactKind: "workflow-bundle",
      revisionBody: '{"kind":"LadderBundleArchive"}\n',
    });
    await saveBundleAssets(project.id, [
      {
        id: `${project.id}:workflow`,
        projectId: project.id,
        ref: "ladder://workflows/example/review",
        kind: "Workflow",
        source: "kind: Workflow\n",
        sourceHash: "abc123",
        updatedAt: Date.now(),
      },
    ]);

    expect(project.artifactKind).toBe("workflow-bundle");
    expect(await listBundleAssets(project.id)).toHaveLength(1);
    const revisions = await listRevisions(project.id);
    expect(revisions).toHaveLength(1);
    expect(await loadRevision(revisions[0])).toBe('{"kind":"LadderBundleArchive"}\n');
  });
});
