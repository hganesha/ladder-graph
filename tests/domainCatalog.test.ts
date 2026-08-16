import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ROLE_TEMPLATES, WORKFLOW_TEMPLATES } from "../src/generated/catalog";
import type { NodeKind, Workflow } from "../src/types";

const DOMAIN_ROLE_PATHS = [
  "research/operations/",
  "research/industry/",
  "research/applied-science/",
  "research/creative/",
  "research/professional/",
  "research/emerging/",
  "research/software/reliability",
];

const DOMAIN_AREAS = new Set([
  "Supply chain & logistics",
  "HR & talent operations",
  "Sales & business development",
  "Customer success & support",
  "Marketing & growth",
  "Accounting, tax & audit",
  "Manufacturing & industrial operations",
  "Energy & utilities",
  "Transportation & mobility",
  "Real estate & construction",
  "Agriculture & food systems",
  "Chemistry & materials science",
  "Biology & bioinformatics",
  "Environmental & climate science",
  "Astronomy & space",
  "Geospatial & earth observation",
  "Gaming & interactive media",
  "Film, video & post-production",
  "Fashion & textiles",
  "Social sciences & policy",
  "Linguistics & language preservation",
  "Insurance & underwriting",
  "Event planning & hospitality",
  "Quality assurance & compliance",
  "DevOps & site reliability",
  "Robotics & embodied AI",
  "Scientific peer review & publishing",
  "Crisis & emergency management",
]);

const domainRoles = ROLE_TEMPLATES.filter((role) => DOMAIN_ROLE_PATHS.some((path) => role.path.startsWith(path)));
const domainWorkflows = WORKFLOW_TEMPLATES.filter((workflow) => DOMAIN_AREAS.has(workflow.area));

describe("domain expansion catalog", () => {
  it("adds every supplied agent and workflow without duplicate library IDs", () => {
    expect(domainRoles).toHaveLength(168);
    expect(domainWorkflows).toHaveLength(56);
    expect(ROLE_TEMPLATES).toHaveLength(291);
    expect(WORKFLOW_TEMPLATES).toHaveLength(85);
    expect(new Set(ROLE_TEMPLATES.map((role) => role.id)).size).toBe(ROLE_TEMPLATES.length);
    expect(new Set(WORKFLOW_TEMPLATES.map((workflow) => workflow.id)).size).toBe(WORKFLOW_TEMPLATES.length);
    expect(new Set(domainWorkflows.map((workflow) => workflow.area))).toEqual(DOMAIN_AREAS);
  });

  it("preserves complete primitive and strategy coverage", () => {
    const workflows = domainWorkflows.map((template) => parse(template.yaml) as Workflow);
    const nodes = workflows.flatMap((workflow) => workflow.spec.nodes);
    const kinds = new Set(nodes.map((node) => node.kind));
    const expectedKinds: NodeKind[] = [
      "agent",
      "aggregator",
      "approval",
      "condition",
      "evaluate",
      "group",
      "input",
      "join",
      "loop",
      "output",
      "subgraph",
      "teacher",
      "tool",
      "transform",
    ];

    expect(kinds).toEqual(new Set(expectedKinds));
    expect(new Set(nodes.filter((node) => node.kind === "aggregator").map((node) => node.config?.aggregation))).toEqual(
      new Set(["collect", "concat", "merge", "vote"]),
    );
    expect(new Set(nodes.filter((node) => node.kind === "transform").map((node) => node.config?.operation))).toEqual(
      new Set(["deduplicate", "filter", "merge", "rename", "select", "slice", "sort"]),
    );
    expect(new Set(nodes.filter((node) => node.kind === "teacher").map((node) => node.config?.feedbackMode))).toEqual(
      new Set(["critique", "rubric", "score"]),
    );
    expect(new Set(nodes.filter((node) => node.kind === "group").map((node) => `${node.config?.execution}/${node.config?.exit}`))).toEqual(
      new Set(["parallel/aggregate", "parallel/serialize", "sequential/aggregate", "sequential/serialize"]),
    );
  });
});
