import Dexie, { type EntityTable } from "dexie";
import type { ProjectRecord, Target } from "../types";

interface RevisionRecord {
  id: string;
  projectId: string;
  createdAt: number;
  storageKey: string;
  valid: boolean;
  body?: string;
}

export interface UserTemplateRecord {
  id: string;
  kind?: "workflow" | "agent-template";
  path: string;
  title: string;
  yaml: string;
  createdAt: number;
  updatedAt: number;
}

interface SettingRecord {
  key: string;
  value: string;
}

export interface BundleAssetRecord {
  id: string;
  projectId: string;
  ref: string;
  kind: "Workflow" | "Ontology" | "Form" | "Document";
  source: string;
  sourceHash: string;
  updatedAt: number;
}

class LadderDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, "id">;
  revisions!: EntityTable<RevisionRecord, "id">;
  templates!: EntityTable<UserTemplateRecord, "id">;
  settings!: EntityTable<SettingRecord, "key">;
  bundleAssets!: EntityTable<BundleAssetRecord, "id">;

  constructor() {
    super("ladder-graph");
    this.version(1).stores({
      projects: "id, name, updatedAt",
      revisions: "id, projectId, createdAt",
      templates: "id, path, title, updatedAt",
    });
    this.version(2).stores({
      projects: "id, name, updatedAt",
      revisions: "id, projectId, createdAt",
      templates: "id, path, title, updatedAt",
      settings: "key",
    });
    this.version(3)
      .stores({
        projects: "id, name, artifactKind, updatedAt",
        revisions: "id, projectId, createdAt",
        templates: "id, kind, path, title, updatedAt",
        settings: "key",
        bundleAssets: "id, projectId, ref, kind, updatedAt",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<ProjectRecord, string>("projects")
          .toCollection()
          .modify((project) => {
            project.artifactKind ??= "workflow";
          });
      });
  }
}

export const db = new LadderDatabase();

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function opfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (!navigator.storage?.getDirectory) return null;
    return await navigator.storage.getDirectory();
  } catch {
    return null;
  }
}

async function writeOpfs(key: string, content: string) {
  const root = await opfsRoot();
  if (!root) return false;
  const revisions = await root.getDirectoryHandle("revisions", { create: true });
  const file = await revisions.getFileHandle(`${key}.yaml`, { create: true });
  const stream = await file.createWritable();
  await stream.write(content);
  await stream.close();
  return true;
}

export async function saveProject(
  projectId: string | null,
  name: string,
  yaml: string,
  lastValidYaml: string,
  target: Target,
  valid: boolean,
) {
  const now = Date.now();
  const existing = projectId ? await db.projects.get(projectId) : undefined;
  const project: ProjectRecord = {
    id: existing?.id ?? id(),
    name,
    artifactKind: existing?.artifactKind ?? "workflow",
    yaml,
    lastValidYaml,
    target,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.projects.put(project);
  const revisionId = id();
  const storageKey = `${project.id}-${revisionId}`;
  const storedInOpfs = await writeOpfs(storageKey, yaml);
  await db.revisions.put({
    id: revisionId,
    projectId: project.id,
    createdAt: now,
    storageKey,
    valid,
    body: storedInOpfs ? undefined : yaml,
  });
  const old = await db.revisions.where("projectId").equals(project.id).reverse().sortBy("createdAt");
  if (old.length > 30) await db.revisions.bulkDelete(old.slice(30).map((item) => item.id));
  return project;
}

export async function saveBundleAssets(projectId: string, assets: BundleAssetRecord[]) {
  await db.transaction("rw", db.bundleAssets, async () => {
    await db.bundleAssets.where("projectId").equals(projectId).delete();
    await db.bundleAssets.bulkPut(assets.map((asset) => ({ ...asset, projectId })));
  });
}

export async function listBundleAssets(projectId: string) {
  return db.bundleAssets.where("projectId").equals(projectId).sortBy("ref");
}

export async function listProjects() {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

export async function listUserTemplates() {
  return db.templates.orderBy("updatedAt").reverse().toArray();
}

export async function saveUserTemplate(template: UserTemplateRecord) {
  await db.templates.put(template);
}

export async function getSetting(key: string) {
  return (await db.settings.get(key))?.value;
}

export async function setSetting(key: string, value: string) {
  await db.settings.put({ key, value });
}

export async function deleteSetting(key: string) {
  await db.settings.delete(key);
}

export async function deleteProject(id: string) {
  await db.transaction("rw", db.projects, db.revisions, db.bundleAssets, async () => {
    await db.projects.delete(id);
    await db.revisions.where("projectId").equals(id).delete();
    await db.bundleAssets.where("projectId").equals(id).delete();
  });
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageStatus() {
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const estimate: StorageEstimate = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => ({})) : {};
  return { persisted, usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, opfs: Boolean(await opfsRoot()) };
}
