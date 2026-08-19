import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectCompanion, publishToCompanion } from "../src/lib/mcpCompanion";
import { db, getSetting, setSetting } from "../src/lib/persistence";
import { WORKFLOW_TEMPLATES } from "../src/generated/catalogTestFixtures";

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("local MCP companion", () => {
  beforeEach(async () => {
    await db.projects.clear();
    await db.templates.clear();
    await db.settings.clear();
    vi.restoreAllMocks();
  });

  it("connects an anonymous browser installation to a loopback companion automatically", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ok: true, details: { builtinEntries: 114, userEntries: 0 } }))
      .mockResolvedValueOnce(jsonResponse({ token: "local-token" }));
    vi.stubGlobal("fetch", fetchMock);

    const status = await connectCompanion();

    expect(status).toMatchObject({ reachable: true, paired: true, url: "http://127.0.0.1:7341" });
    expect(await getSetting("mcp.syncToken")).toBe("local-token");
    const request = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(request.installationId).toEqual(expect.any(String));
    expect(fetchMock.mock.calls[1][0]).toBe("http://127.0.0.1:7341/api/v1/connect");
  });

  it("publishes last-valid workflow YAML as a full local snapshot", async () => {
    await setSetting("mcp.installationId", "browser-installation");
    await setSetting("mcp.syncToken", "local-token");
    await setSetting("mcp.baseUrl", "http://127.0.0.1:7341");
    await db.projects.put({
      id: "project-1",
      name: "invalid-current-draft",
      yaml: "not: [valid",
      lastValidYaml: WORKFLOW_TEMPLATES[0].yaml,
      target: "codex",
      createdAt: 1,
      updatedAt: 2,
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ revision: "sha256:test", publishedAt: "2026-08-16T00:00:00Z", entries: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishToCompanion();

    expect(result.entries).toBe(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:7341/api/v1/catalog/user");
    expect(options?.headers).toMatchObject({ Authorization: "Bearer local-token" });
    const snapshot = JSON.parse(String(options?.body));
    expect(snapshot).toMatchObject({ schemaVersion: 2, installationId: "browser-installation", revision: "" });
    expect(snapshot.entries[0]).toMatchObject({ id: "project-1", kind: "workflow", scope: "user" });
    expect(snapshot.entries[0].content).toBe(WORKFLOW_TEMPLATES[0].yaml);
  });

  it("publishes saved portable artifacts in catalog snapshot v2", async () => {
    await setSetting("mcp.installationId", "browser-installation");
    await setSetting("mcp.syncToken", "local-token");
    await setSetting("mcp.baseUrl", "http://127.0.0.1:7341");
    const source =
      "apiVersion: ladder.dev/v1alpha1\nkind: Ontology\nmetadata: { name: local-ontology, version: 1.0.0 }\nspec: { types: [], relationships: [] }\n";
    await db.projects.put({
      id: "ontology-project",
      name: "Local ontology",
      artifactKind: "ontology",
      yaml: source,
      lastValidYaml: source,
      target: "codex",
      createdAt: 1,
      updatedAt: 2,
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ revision: "sha256:test", publishedAt: "2026-08-17T00:00:00Z", entries: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await publishToCompanion();

    const snapshot = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.entries[0]).toMatchObject({ id: "ontology-project", kind: "ontology", scope: "user" });
  });

  it("refuses to connect to a non-loopback URL", async () => {
    await expect(connectCompanion("https://example.com")).rejects.toThrow("loopback");
  });
});
