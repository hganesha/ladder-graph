import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { analyzeArtifactFallback } from "../src/compiler/artifacts/fallback";
import { importFormJson } from "../src/lib/formJsonImport";
import type { LadderForm } from "../src/types";

describe("form JSON import", () => {
  it("converts an object JSON Schema into an editable Ladder form", async () => {
    const imported = importFormJson(
      JSON.stringify({
        title: "Service request",
        description: "Request intake",
        type: "object",
        required: ["requester", "priority"],
        properties: {
          requester: { type: "string", title: "Requester", minLength: 2 },
          priority: { type: "string", enum: ["low", "high"] },
          due_at: { type: "string", format: "date-time" },
          estimate: { type: "number", minimum: 0 },
        },
      }),
      "service-request.schema.json",
    );

    const form = parse(imported.source) as LadderForm;
    expect(imported).toMatchObject({ format: "json-schema", fieldCount: 4 });
    expect(form).toMatchObject({ kind: "Form", metadata: { name: "service-request", title: "Service request" } });
    expect(form.spec.pages[0].sections[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "priority", widget: "select", required: true, allowedValues: ["low", "high"] }),
        expect.objectContaining({ name: "due_at", dataType: "datetime", widget: "datetime" }),
        expect.objectContaining({ name: "estimate", dataType: "number", minimum: 0 }),
      ]),
    );
    expect((await analyzeArtifactFallback(imported.source)).ok).toBe(true);
  });

  it("accepts a complete Ladder Form encoded as JSON", () => {
    const form: LadderForm = {
      apiVersion: "ladder.dev/v1alpha1",
      kind: "Form",
      metadata: { name: "contact", title: "Contact", version: "1" },
      spec: {
        role: "start",
        pages: [{ id: "main", title: "Contact", sections: [{ id: "details", title: "Details", fields: [] }] }],
      },
    };
    const imported = importFormJson(JSON.stringify(form));
    expect(imported).toMatchObject({ format: "ladder-form", fieldCount: 0 });
    expect(parse(imported.source)).toMatchObject(form);
  });

  it("rejects unrelated JSON", () => {
    expect(() => importFormJson(JSON.stringify({ values: [1, 2, 3] }))).toThrow(/Ladder Form artifact or an object JSON Schema/);
  });

  it("rejects schema references instead of resolving external content", () => {
    expect(() =>
      importFormJson(JSON.stringify({ type: "object", properties: { account: { $ref: "https://example.com/account.json" } } })),
    ).toThrow(/references are not supported/);
  });
});
