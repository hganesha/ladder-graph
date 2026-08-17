import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ARTIFACT_TEMPLATES } from "../src/generated/catalog";
import { createFormOutputFiles, formSubmissionSchema } from "../src/lib/formOutputs";
import type { LadderForm } from "../src/types";

describe("standalone form outputs", () => {
  it("generates portable YAML, JSON Schema, and UI schema from the canonical form", () => {
    const source = ARTIFACT_TEMPLATES.find((artifact) => artifact.id === "first-notice-of-loss")?.yaml;
    const form = parse(source ?? "") as LadderForm;
    const schema = formSubmissionSchema(form) as { required: string[]; properties: Record<string, Record<string, unknown>> };
    const outputs = createFormOutputFiles(form);

    expect(outputs.map((output) => output.name)).toEqual([
      "first-notice-of-loss.yaml",
      "first-notice-of-loss.schema.json",
      "first-notice-of-loss.ui.json",
    ]);
    expect(schema.required).toContain("policy_number");
    expect(schema.properties.reported_date).toMatchObject({ type: "string", format: "date" });
    expect(outputs[2].content).toContain('"role": "start"');
  });
});
