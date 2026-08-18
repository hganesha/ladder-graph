import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import vocabulary from "../catalog/capability-vocabulary.json";
import { WORKFLOW_TEMPLATES } from "../src/generated/catalog";
import type { Workflow } from "../src/types";

const EXPECTED_AREAS = {
  "budget-subscription-review": "Finance & risk",
  "childcare-vetting": "Education & assessment",
  "chore-allowance-system": "Personal development",
  "comparison-shopping": "Research",
  "contractor-vetting": "Real estate & construction",
  "diy-vs-hire-comparison": "Real estate & construction",
  "eldercare-facility-comparison": "Clinical & health sciences",
  "estate-planning-research": "Legal & contracts",
  "family-event-planning": "Event planning & hospitality",
  "financial-aid-search": "Education & assessment",
  "fitness-nutrition-plan": "Clinical & health sciences",
  "gift-registry-research": "Event planning & hospitality",
  "health-insurance-comparison": "Insurance & underwriting",
  "higher-ed-research": "Education & assessment",
  "home-purchase-comparison": "Real estate & construction",
  "home-utility-insurance-comparison": "Real estate & construction",
  "homework-concept-explainer": "Education & assessment",
  "insurance-policy-comparison": "Insurance & underwriting",
  "job-offer-comparison": "HR & talent operations",
  "k12-school-comparison": "Education & assessment",
  "local-activity-discovery": "Personal development",
  "major-purchase-research": "Research",
  "medication-interaction-check": "Clinical & health sciences",
  "moving-checklist": "Real estate & construction",
  "multi-destination-tradeoff": "Event planning & hospitality",
  "packing-list-generator": "Event planning & hospitality",
  "pet-care-research": "Research",
  "points-miles-optimizer": "Finance & risk",
  "product-review-sentiment": "Research",
  "provider-search": "Clinical & health sciences",
  "resume-tailoring": "HR & talent operations",
  "retirement-account-comparison": "Finance & risk",
  "study-abroad-research": "Education & assessment",
  "subscription-audit": "Finance & risk",
  "symptom-research-triage": "Clinical & health sciences",
  "tax-prep-checklist": "Accounting, tax & audit",
  "trade-school-research": "Education & assessment",
  "travel-safety-check": "Event planning & hospitality",
  "trip-planning": "Event planning & hospitality",
  "tutor-program-vetting": "Education & assessment",
  "volunteer-matching": "Personal development",
  "warranty-return-policy-check": "Research",
} as const;

describe("family workflow catalog", () => {
  it("publishes every supplied workflow in its reviewed subject area", () => {
    const familyWorkflows = WORKFLOW_TEMPLATES.filter((workflow) => workflow.eyebrow === "Family workflows");
    expect(familyWorkflows).toHaveLength(42);
    expect(Object.fromEntries(familyWorkflows.map((workflow) => [workflow.id, workflow.area]))).toEqual(EXPECTED_AREAS);
  });

  it("keeps every workflow structurally populated and capability-governed", () => {
    const governedSkills = new Set(vocabulary.skills);
    for (const id of Object.keys(EXPECTED_AREAS)) {
      const template = WORKFLOW_TEMPLATES.find((workflow) => workflow.id === id);
      expect(template, id).toBeDefined();
      const workflow = parse(template!.yaml) as Workflow;
      expect(workflow.kind, id).toBe("Workflow");
      expect(workflow.metadata.name, id).toBe(id);
      expect(workflow.spec.nodes.length, id).toBeGreaterThan(0);
      expect(workflow.spec.edges.length, id).toBeGreaterThan(0);
      expect(
        workflow.spec.nodes.flatMap((node) => node.capabilities?.skills ?? []).every((skill) => governedSkills.has(skill)),
        id,
      ).toBe(true);
    }
  });
});
