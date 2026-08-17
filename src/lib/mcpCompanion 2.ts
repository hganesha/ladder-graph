import { parseDocument } from "yaml";
import { deleteSetting, getSetting, listProjects, listUserTemplates, setSetting } from "./persistence";

const DEFAULT_URL = "http://127.0.0.1:7341";
const INSTALLATION_ID = "mcp.installationId";
const TOKEN = "mcp.syncToken";
const BASE_URL = "mcp.baseUrl";

interface CompanionHealth {
  ok: boolean;
  details?: {
    userEntries?: number;
    builtinEntries?: number;
  };
}

interface PublishResponse {
  revision: string;
  publishedAt: string;
  entries: number;
}

function workflowMetadata(source: string, fallback: string) {
  try {
    const document = parseDocument(source, { uniqueKeys: true, strict: true });
    if (document.errors.length) return { title: fallback, description: "", version: "" };
    const value = document.toJS({ maxAliasCount: 50 }) as {
      metadata?: { title?: string; description?: string; version?: string };
    };
    return {
      title: value.metadata?.title || fallback,
      description: value.metadata?.description || "",
      version: value.metadata?.version || "",
    };
  } catch {
    return { title: fallback, description: "", version: "" };
  }
}

async function installationId() {
  const existing = await getSetting(INSTALLATION_ID);
  if (existing) return existing;
  const created = globalThis.crypto.randomUUID();
  await setSetting(INSTALLATION_ID, created);
  return created;
}

async function baseUrl() {
  return (await getSetting(BASE_URL)) ?? DEFAULT_URL;
}

function normalizeCompanionUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("The MCP companion URL must be an HTTP loopback address.");
  }
  if (url.username || url.password || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("The MCP companion URL cannot contain credentials or a path.");
  }
  return url.origin;
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error || `Companion returned HTTP ${response.status}.`);
  return body as T;
}

export async function companionStatus() {
  const token = await getSetting(TOKEN);
  const url = await baseUrl();
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
    const health = await responseJson<CompanionHealth>(response);
    return { reachable: health.ok, paired: Boolean(token), url, details: health.details };
  } catch {
    return { reachable: false, paired: Boolean(token), url };
  }
}

export async function pairCompanion(code: string, url = DEFAULT_URL) {
  const id = await installationId();
  const normalizedUrl = normalizeCompanionUrl(url);
  const response = await fetch(`${normalizedUrl}/api/v1/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, installationId: id }),
  });
  const result = await responseJson<{ token: string }>(response);
  await setSetting(TOKEN, result.token);
  await setSetting(BASE_URL, normalizedUrl);
  return companionStatus();
}

export async function publishToCompanion(): Promise<PublishResponse> {
  const [projects, templates, id, token, url] = await Promise.all([
    listProjects(),
    listUserTemplates(),
    installationId(),
    getSetting(TOKEN),
    baseUrl(),
  ]);
  if (!token) throw new Error("Pair this browser with the Ladder Graph MCP companion first.");

  const entries = [
    ...projects.map((project) => {
      const metadata = workflowMetadata(project.lastValidYaml, project.name);
      return {
        id: project.id,
        kind: "workflow",
        scope: "user",
        ...metadata,
        tags: ["project"],
        updatedAt: new Date(project.updatedAt).toISOString(),
        sourceHash: "",
        mediaType: "application/yaml",
        content: project.lastValidYaml,
      };
    }),
    ...templates.map((template) => {
      const metadata = workflowMetadata(template.yaml, template.title);
      return {
        id: template.id,
        kind: template.kind ?? "workflow",
        scope: "user",
        ...metadata,
        tags: ["template", ...template.path.split("/").filter(Boolean)],
        updatedAt: new Date(template.updatedAt).toISOString(),
        sourceHash: "",
        mediaType: "application/yaml",
        content: template.yaml,
      };
    }),
  ];
  const publishedAt = new Date().toISOString();
  const response = await fetch(`${url}/api/v1/catalog/user`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schemaVersion: 1,
      installationId: id,
      publishedAt,
      revision: "",
      entries,
    }),
  });
  return responseJson<PublishResponse>(response);
}

export async function forgetCompanion() {
  await Promise.all([deleteSetting(TOKEN), deleteSetting(BASE_URL)]);
}
