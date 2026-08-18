class UnsupportedExpression extends Error {}

const COMPARISON_OPS = new Map([
  ["=", "eq"],
  ["!=", "neq"],
  ["<>", "neq"],
  [">", "gt"],
  [">=", "gte"],
  ["<", "lt"],
  ["<=", "lte"],
]);

function slug(value) {
  return String(value ?? "rule")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }
    if (character === "'") {
      let value = "";
      index += 1;
      let closed = false;
      while (index < source.length) {
        if (source[index] === "'" && source[index + 1] === "'") {
          value += "'";
          index += 2;
        } else if (source[index] === "'") {
          closed = true;
          index += 1;
          break;
        } else {
          value += source[index];
          index += 1;
        }
      }
      if (!closed) throw new UnsupportedExpression("Unterminated string literal.");
      tokens.push({ kind: "literal", value });
      continue;
    }
    const number = source.slice(index).match(/^-?(?:\d+\.?\d*|\.\d+)/u)?.[0];
    if (number) {
      tokens.push({ kind: "literal", value: Number(number) });
      index += number.length;
      continue;
    }
    const identifier = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/u)?.[0];
    if (identifier) {
      tokens.push({ kind: "word", value: identifier, upper: identifier.toUpperCase() });
      index += identifier.length;
      continue;
    }
    const operator = [">=", "<=", "!=", "<>", "=", ">", "<", "(", ")", ","].find((candidate) => source.startsWith(candidate, index));
    if (operator) {
      tokens.push({ kind: "symbol", value: operator });
      index += operator.length;
      continue;
    }
    throw new UnsupportedExpression(`Unsupported token '${character}'.`);
  }
  return tokens;
}

class Parser {
  constructor(source) {
    this.tokens = tokenize(source);
    this.index = 0;
  }

  parse() {
    if (!this.tokens.length) throw new UnsupportedExpression("Expression is empty.");
    const rule = this.parseOr();
    if (this.peek()) throw new UnsupportedExpression(`Unexpected token '${this.peek().value}'.`);
    return rule;
  }

  peek(offset = 0) {
    return this.tokens[this.index + offset];
  }

  take() {
    const token = this.peek();
    if (token) this.index += 1;
    return token;
  }

  isWord(value) {
    return this.peek()?.kind === "word" && this.peek().upper === value;
  }

  acceptWord(value) {
    if (!this.isWord(value)) return false;
    this.index += 1;
    return true;
  }

  acceptSymbol(value) {
    if (this.peek()?.kind !== "symbol" || this.peek().value !== value) return false;
    this.index += 1;
    return true;
  }

  expectSymbol(value) {
    if (!this.acceptSymbol(value)) throw new UnsupportedExpression(`Expected '${value}'.`);
  }

  parseOr() {
    const rules = [this.parseAnd()];
    while (this.acceptWord("OR")) rules.push(this.parseAnd());
    return rules.length === 1 ? rules[0] : { op: "or", rules };
  }

  parseAnd() {
    const rules = [this.parseNot()];
    while (this.acceptWord("AND")) rules.push(this.parseNot());
    return rules.length === 1 ? rules[0] : { op: "and", rules };
  }

  parseNot() {
    if (this.acceptWord("NOT")) return { op: "not", rule: this.parseNot() };
    if (this.acceptSymbol("(")) {
      const rule = this.parseOr();
      this.expectSymbol(")");
      return rule;
    }
    return this.parsePredicate();
  }

  parsePredicate() {
    const left = this.parseOperand();
    if (this.acceptWord("IS")) {
      const negated = this.acceptWord("NOT");
      if (!this.acceptWord("NULL")) throw new UnsupportedExpression("Only IS NULL and IS NOT NULL are supported.");
      const field = this.operandField(left);
      const present = { op: "present", field };
      return negated ? present : { op: "not", rule: present };
    }
    if (this.acceptWord("IN")) {
      this.expectSymbol("(");
      const rules = [];
      do {
        const right = this.parseOperand();
        if (!("value" in right)) throw new UnsupportedExpression("IN values must be literals.");
        rules.push({ op: "eq", left: { ...left }, right });
      } while (this.acceptSymbol(","));
      this.expectSymbol(")");
      if (!rules.length) throw new UnsupportedExpression("IN requires at least one literal.");
      return rules.length === 1 ? rules[0] : { op: "or", rules };
    }
    if (this.acceptWord("REGEXP")) {
      const pattern = this.parseOperand();
      if (!("value" in pattern) || typeof pattern.value !== "string") throw new UnsupportedExpression("REGEXP requires a string pattern.");
      return { op: "matches", left, pattern: pattern.value };
    }
    const operator = this.peek()?.kind === "symbol" ? COMPARISON_OPS.get(this.peek().value) : undefined;
    if (!operator) throw new UnsupportedExpression(`Expected a comparison after '${this.describeOperand(left)}'.`);
    this.take();
    return { op: operator, left, right: this.parseOperand() };
  }

  parseOperand() {
    const token = this.take();
    if (!token) throw new UnsupportedExpression("Expected an operand.");
    if (token.kind === "literal") return { value: token.value };
    if (token.kind !== "word") throw new UnsupportedExpression(`Expected an operand, found '${token.value}'.`);
    if (token.upper === "TRUE") return { value: true };
    if (token.upper === "FALSE") return { value: false };
    if (token.upper === "NULL") return { value: null };
    if (!this.acceptSymbol("(")) return { field: token.value };

    if (token.upper === "CURRENT_DATE") {
      this.expectSymbol(")");
      throw new UnsupportedExpression("CURRENT_DATE() requires a runtime today operand.");
    }
    if (token.upper === "TRIM") {
      const operand = this.parseOperand();
      this.expectSymbol(")");
      return { trim: this.operandField(operand) };
    }
    if (["LENGTH", "JSON_ARRAY_LENGTH", "ARRAY_SIZE", "SIZE"].includes(token.upper)) {
      const operand = this.parseOperand();
      this.expectSymbol(")");
      const field = "trim" in operand ? operand.trim : this.operandField(operand);
      return { length: field };
    }
    throw new UnsupportedExpression(`Function ${token.value}() is not supported.`);
  }

  operandField(operand) {
    if ("field" in operand) return operand.field;
    throw new UnsupportedExpression("This operation requires a field operand.");
  }

  describeOperand(operand) {
    if ("field" in operand) return operand.field;
    if ("length" in operand) return `length(${operand.length})`;
    if ("trim" in operand) return `trim(${operand.trim})`;
    return String(operand.value);
  }
}

function referencedFields(rule) {
  if (rule.op === "present") return [rule.field];
  if (rule.op === "not") return referencedFields(rule.rule);
  if (rule.op === "and" || rule.op === "or") return rule.rules.flatMap(referencedFields);
  const fields = [];
  for (const operand of [rule.left, rule.right]) {
    if (!operand) continue;
    if ("field" in operand) fields.push(operand.field);
    if ("length" in operand) fields.push(operand.length);
  }
  return fields;
}

export function compileDocuBricksExpression(source, fieldNames) {
  try {
    const rule = new Parser(String(source ?? "")).parse();
    const allowed = fieldNames ? new Set([...fieldNames, "avg_confidence", "document_id"]) : undefined;
    const missing = allowed ? [...new Set(referencedFields(rule))].filter((field) => !allowed.has(field)) : [];
    if (missing.length) return { supported: false, unsupportedReason: `References unknown field(s): ${missing.join(", ")}.` };
    return { supported: true, rule };
  } catch (error) {
    return {
      supported: false,
      unsupportedReason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function convertDocuBricksRule(sourceRule, fieldNames) {
  const compiled = compileDocuBricksExpression(sourceRule.expression, fieldNames);
  return {
    id: slug(sourceRule.name),
    severity: sourceRule.severity === "fail" ? "error" : "warning",
    ...(sourceRule.description ? { description: sourceRule.description } : {}),
    ...(compiled.rule ? { rule: compiled.rule } : {}),
    ...(sourceRule.expression ? { sourceExpression: sourceRule.expression } : {}),
    supported: compiled.supported,
    ...(compiled.unsupportedReason ? { unsupportedReason: compiled.unsupportedReason } : {}),
  };
}
