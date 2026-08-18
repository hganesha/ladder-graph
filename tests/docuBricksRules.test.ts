import { describe, expect, it } from "vitest";
import { compileDocuBricksExpression, convertDocuBricksRule } from "../src/compiler/artifacts/docubricksRules.mjs";
import type { SafeRule } from "../src/types";

const fields = new Set([
  "amount",
  "application_date",
  "category",
  "claim_status",
  "code",
  "count",
  "due_date",
  "end_date",
  "filing_date",
  "items",
  "name",
  "percent",
  "purchase_price",
  "request_status",
  "start_date",
  "value",
]);

const canonicalExpressions = [
  "name IS NOT NULL",
  "name IS NULL",
  "name IS NOT NULL AND LENGTH(TRIM(name)) > 0",
  "amount IS NULL OR amount >= 0",
  "amount IS NOT NULL AND amount > 0",
  "category IN ('A', 'B', 'Other')",
  "category IS NULL OR category IN ('A', 'B')",
  "count IS NULL OR count IN (60, 120, 360)",
  "start_date IS NULL OR end_date IS NULL OR start_date <= end_date",
  "percent IS NULL OR (percent >= 0 AND percent <= 100)",
  "(amount IS NULL OR amount >= 0) AND (percent IS NULL OR percent >= 0)",
  "NOT (claim_status = 'Denied' AND code IS NULL)",
  "name IS NOT NULL AND category IS NOT NULL AND amount IS NOT NULL",
  "code IS NULL OR code REGEXP '^[0-9]{10}$'",
  "code IS NULL OR (LENGTH(code) = 10 AND code REGEXP '^[0-9]{10}$')",
  "items IS NULL OR JSON_ARRAY_LENGTH(items) >= 0",
  "items IS NOT NULL AND JSON_ARRAY_LENGTH(items) > 0",
  "items IS NOT NULL AND ARRAY_SIZE(items) > 0",
  "size(items) > 0",
  "avg_confidence >= 0.70",
  "document_id IS NOT NULL AND LENGTH(TRIM(document_id)) > 0",
  "value > 0",
  "value < 100",
  "value != 10",
  "value <> 10",
  "value = 10",
  "value <= 10",
  "value >= 10",
  "(request_status = 'Denied' OR request_status = 'Pending') AND code IS NOT NULL",
  "due_date IS NULL OR filing_date IS NULL OR due_date >= filing_date",
];

function depth(rule: SafeRule): number {
  if (rule.op === "not") return 1 + depth(rule.rule);
  if (rule.op === "and" || rule.op === "or") return 1 + Math.max(0, ...rule.rules.map(depth));
  return 1;
}

describe("DocuBricks safe-rule compiler", () => {
  it.each(canonicalExpressions)("compiles %s", (expression) => {
    const result = compileDocuBricksExpression(expression, fields);
    expect(result.supported, result.unsupportedReason).toBe(true);
    expect(result.rule).toBeDefined();
    expect(depth(result.rule as SafeRule)).toBeLessThanOrEqual(4);
  });

  it("lowers IN without adding a new operation", () => {
    const result = compileDocuBricksExpression("category IN ('A', 'B')", fields);
    expect(result.rule).toMatchObject({
      op: "or",
      rules: [
        { op: "eq", left: { field: "category" }, right: { value: "A" } },
        { op: "eq", left: { field: "category" }, right: { value: "B" } },
      ],
    });
  });

  it("normalizes string and array length functions to the length operand", () => {
    expect(compileDocuBricksExpression("LENGTH(TRIM(name)) > 0", fields).rule).toEqual({
      op: "gt",
      left: { length: "name" },
      right: { value: 0 },
    });
    expect(compileDocuBricksExpression("JSON_ARRAY_LENGTH(items) > 0", fields).rule).toEqual({
      op: "gt",
      left: { length: "items" },
      right: { value: 0 },
    });
  });

  it("preserves CURRENT_DATE as unsupported with an actionable reason", () => {
    const result = compileDocuBricksExpression("application_date <= CURRENT_DATE()", fields);
    expect(result).toEqual({
      supported: false,
      unsupportedReason: "CURRENT_DATE() requires a runtime today operand.",
    });
  });

  it("rejects unknown fields rather than silently compiling them", () => {
    const result = compileDocuBricksExpression("warehouse_total >= 0", fields);
    expect(result.supported).toBe(false);
    expect(result.unsupportedReason).toContain("warehouse_total");
  });

  it("produces the portable validation-rule envelope", () => {
    expect(
      convertDocuBricksRule(
        {
          name: "valid_code",
          severity: "fail",
          expression: "code REGEXP '^[A-Z]+$'",
        },
        fields,
      ),
    ).toMatchObject({
      id: "valid-code",
      severity: "error",
      supported: true,
      rule: { op: "matches", left: { field: "code" }, pattern: "^[A-Z]+$" },
    });
  });
});
