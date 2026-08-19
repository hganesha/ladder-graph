import { ARTIFACT_INDEX, ROLE_TEMPLATES, WORKFLOW_TEMPLATES } from "../generated/catalog";
import type { ArtifactTemplateDefinition, CatalogBodyReference, RoleTemplate, TemplateDefinition } from "../types";

const bodyRequests = new Map<string, Promise<unknown>>();

function catalogUrl(bodyUrl: string) {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(bodyUrl, base).toString();
}

async function loadBody<T>(reference: CatalogBodyReference): Promise<T> {
  const url = catalogUrl(reference.bodyUrl);
  const existing = bodyRequests.get(url);
  if (existing) return existing as Promise<T>;

  const request = fetch(url, { credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Catalog body request failed (${response.status})`);
      const serialized = await response.text();
      if (globalThis.crypto?.subtle) {
        const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized.trimEnd()));
        const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
        if (hash !== reference.bodyHash) throw new Error("Catalog body failed its content hash check");
      }
      return JSON.parse(serialized) as T;
    })
    .catch((error) => {
      bodyRequests.delete(url);
      throw error;
    });
  bodyRequests.set(url, request);
  return request;
}

export function loadWorkflowTemplate(id: string): Promise<TemplateDefinition> {
  const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) return Promise.reject(new Error(`Unknown workflow template: ${id}`));
  return loadBody(template);
}

export function loadRoleTemplate(id: string): Promise<RoleTemplate> {
  const template = ROLE_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) return Promise.reject(new Error(`Unknown agent template: ${id}`));
  return loadBody(template);
}

export function loadArtifactTemplate(id: string): Promise<ArtifactTemplateDefinition> {
  const template = ARTIFACT_INDEX.find((candidate) => candidate.id === id);
  if (!template) return Promise.reject(new Error(`Unknown artifact template: ${id}`));
  return loadBody(template);
}

export function preloadCatalogBody(reference: CatalogBodyReference) {
  void loadBody(reference).catch(() => {
    // A speculative preload may fail offline; the explicit open action retries and reports the error.
  });
}
