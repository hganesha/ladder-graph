import { parse } from "yaml";
import type { ResolvedBundleAsset, Target, WorkflowBundle } from "../types";
import { attachedBundleRefs } from "./bundleEditor";

export interface BundleArchiveAsset {
  ref: string;
  sourceHash: string;
  source: string;
}

export interface BundleArchive {
  archiveVersion: 1;
  kind: "LadderBundleArchive";
  bundle: {
    name: string;
    target: Target;
    sourceHash: string;
    source: string;
  };
  assets: BundleArchiveAsset[];
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createBundleArchive(source: string, assets: ResolvedBundleAsset[], target: Target) {
  const bundle = parse(source) as WorkflowBundle;
  const archiveAssets = await Promise.all(
    [...assets]
      .sort((left, right) => left.ref.localeCompare(right.ref))
      .map(async (asset) => ({ ref: asset.ref, sourceHash: await sha256(asset.source), source: asset.source })),
  );
  const archive: BundleArchive = {
    archiveVersion: 1,
    kind: "LadderBundleArchive",
    bundle: {
      name: bundle.metadata.name,
      target,
      sourceHash: await sha256(source),
      source,
    },
    assets: archiveAssets,
  };
  return `${JSON.stringify(archive, null, 2)}\n`;
}

export async function parseBundleArchive(value: string): Promise<BundleArchive> {
  let archive: BundleArchive;
  try {
    archive = JSON.parse(value) as BundleArchive;
  } catch (error) {
    throw new Error(`Archive is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (archive.kind !== "LadderBundleArchive" || archive.archiveVersion !== 1) {
    throw new Error("Archive must be a LadderBundleArchive with archiveVersion 1.");
  }
  if (!archive.bundle?.source || !Array.isArray(archive.assets)) throw new Error("Archive is missing its bundle source or assets.");
  const bundle = parse(archive.bundle.source) as WorkflowBundle;
  if (bundle.kind !== "WorkflowBundle") throw new Error("Archive bundle source must contain a WorkflowBundle.");
  const refs = new Set<string>();
  for (const asset of archive.assets) {
    if (!asset.ref?.startsWith("ladder://") || typeof asset.source !== "string")
      throw new Error("Archive contains an invalid asset entry.");
    if (refs.has(asset.ref)) throw new Error(`Archive contains duplicate asset '${asset.ref}'.`);
    refs.add(asset.ref);
    if ((await sha256(asset.source)) !== asset.sourceHash) throw new Error(`Archive asset '${asset.ref}' failed its SHA-256 check.`);
  }
  for (const ref of attachedBundleRefs(bundle)) {
    if (!refs.has(ref)) throw new Error(`Archive is missing attached asset '${ref}'.`);
  }
  if ((await sha256(archive.bundle.source)) !== archive.bundle.sourceHash)
    throw new Error("Archive bundle source failed its SHA-256 check.");
  return archive;
}

export function archiveResolvedAssets(archive: BundleArchive): ResolvedBundleAsset[] {
  return archive.assets.map((asset) => ({ ref: asset.ref, source: asset.source }));
}
