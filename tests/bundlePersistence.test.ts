import { afterEach, describe, expect, it } from "vitest";
import {
  db,
  deleteProject,
  listBundleAssets,
  listRevisions,
  loadRevision,
  saveArtifactProject,
  saveBundleAssets,
  sweepOrphanedRevisionBodies,
} from "../src/lib/persistence";

function installOpfs() {
  const files = new Map<string, string>();
  const directory = {
    async getFileHandle(name: string) {
      return {
        async createWritable() {
          return {
            async write(content: string) {
              files.set(name, content);
            },
            async close() {},
          };
        },
      };
    },
    async removeEntry(name: string) {
      files.delete(name);
    },
    async *entries() {
      for (const name of files.keys()) yield [name, { kind: "file" }] as const;
    },
  };
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: { getDirectory: async () => ({ getDirectoryHandle: async () => directory }) },
  });
  return files;
}

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

  it("reclaims pruned, deleted, and orphaned OPFS revision bodies", async () => {
    const files = installOpfs();
    let projectId: string | null = null;
    for (let index = 0; index < 31; index += 1) {
      const project = await saveArtifactProject({
        projectId,
        name: "Revision cleanup",
        yaml: `kind: Workflow\nrevision: ${index}\n`,
        lastValidYaml: `kind: Workflow\nrevision: ${index}\n`,
        target: "codex",
        valid: true,
        artifactKind: "workflow",
      });
      projectId = project.id;
    }

    expect(await listRevisions(projectId!)).toHaveLength(30);
    expect(files.size).toBe(30);
    files.set("unreferenced.yaml", "orphan");
    expect(await sweepOrphanedRevisionBodies()).toBe(1);
    expect(files.has("unreferenced.yaml")).toBe(false);

    await deleteProject(projectId!);
    expect(files.size).toBe(0);
  });
});
