const test = require("node:test");
const assert = require("node:assert/strict");

const { createMiniValidator } = require("./mini-validator");

test("string() accepts strings", () => {
  const v = createMiniValidator();
  assert.deepEqual(v.validate(v.string(), "abc"), []);
});

test("string() rejects non-strings", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.string(), 123);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "string.base");
});

test("string() enforces minLength, maxLength, and pattern", () => {
  const v = createMiniValidator();

  assert.equal(v.validate(v.string({ minLength: 3 }), "ab")[0].code, "string.minLength");
  assert.equal(v.validate(v.string({ maxLength: 3 }), "abcd")[0].code, "string.maxLength");
  assert.equal(v.validate(v.string({ pattern: /^[A-Z]{3}$/ }), "abc")[0].code, "string.pattern");
  assert.deepEqual(v.validate(v.string({ pattern: /^[A-Z]{3}\d{2}$/ }), "ABC12"), []);
});

test("string() pattern validation is stable with global RegExp flags", () => {
  const v = createMiniValidator();
  const schema = v.string({ pattern: /a/g });

  assert.deepEqual(v.validate(schema, "a"), []);
  assert.deepEqual(v.validate(schema, "a"), []);
});

test("number() accepts numbers and rejects NaN", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.number(), 123), []);
  assert.equal(v.validate(v.number(), NaN)[0].code, "number.base");
});

test("number() enforces min, max, and integer", () => {
  const v = createMiniValidator();

  assert.equal(v.validate(v.number({ min: 10 }), 9)[0].code, "number.min");
  assert.equal(v.validate(v.number({ max: 10 }), 11)[0].code, "number.max");
  assert.equal(v.validate(v.number({ integer: true }), 1.5)[0].code, "number.integer");
});

test("number() accepts boundary values and current Infinity behavior", () => {
  const v = createMiniValidator();
  const schema = v.number({ min: 10, max: 20 });

  assert.deepEqual(v.validate(schema, 10), []);
  assert.deepEqual(v.validate(schema, 20), []);
  assert.deepEqual(v.validate(v.number(), Infinity), []);
});

test("boolean() accepts booleans only", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.boolean(), true), []);
  assert.deepEqual(v.validate(v.boolean(), false), []);
  assert.equal(v.validate(v.boolean(), 1)[0].code, "boolean.base");
});

test("null() accepts null only", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.null(), null), []);
  assert.equal(v.validate(v.null(), {})[0].code, "null.base");
});

test("literal() uses strict equality", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.literal("ok"), "ok"), []);
  assert.equal(v.validate(v.literal("ok"), "ng")[0].code, "literal.base");
  assert.deepEqual(v.validate(v.literal(0), 0), []);
  assert.deepEqual(v.validate(v.literal(false), false), []);
  assert.deepEqual(v.validate(v.literal(""), ""), []);
  assert.equal(v.validate(v.literal(0), false)[0].code, "literal.base");
  assert.equal(v.validate(v.literal(false), 0)[0].code, "literal.base");
  assert.equal(v.validate(v.literal(""), 0)[0].code, "literal.base");
});
