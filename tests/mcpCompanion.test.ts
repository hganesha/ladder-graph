import { beforeEach, describe, expect, it, vi } from "vitest";
import { pairCompanion, publishToCompanion } from "../src/lib/mcpCompanion";
import { db, getSetting, setSetting } from "../src/lib/persistence";
import { WORKFLOW_TEMPLATES } from "../src/lib/templates";

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

  it("pairs an anonymous browser installation with a loopback companion", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ token: "local-token" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, details: { builtinEntries: 114, userEntries: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    const status = await pairCompanion("ABCD-EF01-2345-6789");

    expect(status).toMatchObject({ reachable: true, paired: true, url: "http://127.0.0.1:7341" });
    expect(await getSetting("mcp.syncToken")).toBe("local-token");
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request).toMatchObject({ code: "ABCD-EF01-2345-6789" });
    expect(request.installationId).toEqual(expect.any(String));
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
    expect(snapshot).toMatchObject({ schemaVersion: 1, installationId: "browser-installation", revision: "" });
    expect(snapshot.entries[0]).toMatchObject({ id: "project-1", kind: "workflow", scope: "user" });
    expect(snapshot.entries[0].content).toBe(WORKFLOW_TEMPLATES[0].yaml);
  });

  it("refuses to send pairing codes to a non-loopback URL", async () => {
    await expect(pairCompanion("code", "https://example.com")).rejects.toThrow("loopback");
  });
});
