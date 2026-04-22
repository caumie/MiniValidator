const test = require("node:test");
const assert = require("node:assert/strict");

const { createMiniValidator } = require("./mini-validator");

test("object() accepts matching non-array objects", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
    age: v.number(),
  });

  assert.deepEqual(v.validate(schema, { name: "Alice", age: 42 }), []);
});

test("object() rejects null and arrays", () => {
  const v = createMiniValidator();
  const schema = v.object({ name: v.string() });

  assert.equal(v.validate(schema, null)[0].code, "object.base");
  assert.equal(v.validate(schema, [])[0].code, "object.base");
});

test("object() recursively validates defined keys", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string({ minLength: 1 }),
    age: v.number({ min: 0 }),
  });
  const issues = v.validate(schema, {
    name: "",
    age: -1,
  });

  assert.equal(issues.length, 2);
  assert.equal(issues[0].path, "$.name");
  assert.equal(issues[0].code, "string.minLength");
  assert.equal(issues[1].path, "$.age");
  assert.equal(issues[1].code, "number.min");
});

test("object() rejects unknown keys", () => {
  const v = createMiniValidator();
  const schema = v.object({ name: v.string() });
  const issues = v.validate(schema, {
    name: "Alice",
    extra: 123,
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.extra");
  assert.equal(issues[0].code, "object.unknownKey");
  assert.deepEqual(issues[0].expected, ["name"]);
  assert.equal(issues[0].actual, "extra");
});

test("object() distinguishes missing required keys from undefined values", () => {
  const v = createMiniValidator();
  const schema = v.object({ name: v.string() });

  const missingIssues = v.validate(schema, {});
  const undefinedIssues = v.validate(schema, { name: undefined });

  assert.equal(missingIssues.length, 1);
  assert.equal(missingIssues[0].path, "$.name");
  assert.equal(missingIssues[0].code, "object.missingKey");

  assert.equal(undefinedIssues.length, 1);
  assert.equal(undefinedIssues[0].path, "$.name");
  assert.equal(undefinedIssues[0].code, "string.base");
});

test("object() allows missing optional keys and validates present optional keys", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
    memo: v.optional(v.string()),
  });

  assert.deepEqual(v.validate(schema, { name: "Alice" }), []);
  assert.deepEqual(v.validate(schema, { name: "Alice", memo: undefined }), []);

  const issues = v.validate(schema, { name: "Alice", memo: 123 });
  assert.equal(issues.length, 2);
  assert.equal(issues[0].path, "$.memo");
  assert.equal(issues[0].code, "string.base");
  assert.equal(issues[1].path, "$.memo");
  assert.equal(issues[1].code, "optional.base");
});

test("object() allows a missing key when optional() wraps a composite field schema", () => {
  const v = createMiniValidator();
  const schema = v.object({
    x: v.optional(v.union(v.number(), v.string())),
  });

  assert.deepEqual(v.validate(schema, {}), []);
  assert.deepEqual(v.validate(schema, { x: undefined }), []);
  assert.deepEqual(v.validate(schema, { x: 1 }), []);
  assert.deepEqual(v.validate(schema, { x: "ok" }), []);
});

test("object() does not allow a missing key when optional() is nested inside union()", () => {
  const v = createMiniValidator();
  const schema = v.object({
    x: v.union(v.number(), v.optional(v.string())),
  });

  const issues = v.validate(schema, {});

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.x");
  assert.equal(issues[0].code, "object.missingKey");
  assert.deepEqual(v.validate(schema, { x: undefined }), []);
  assert.deepEqual(v.validate(schema, { x: 1 }), []);
  assert.deepEqual(v.validate(schema, { x: "ok" }), []);
});

test("object() does not allow a missing key when union() includes undefined as a value", () => {
  const v = createMiniValidator();
  const schema = v.object({
    x: v.union(v.number(), v.literal(undefined)),
  });

  const issues = v.validate(schema, {});

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.x");
  assert.equal(issues[0].code, "object.missingKey");
  assert.deepEqual(v.validate(schema, { x: undefined }), []);
  assert.deepEqual(v.validate(schema, { x: 1 }), []);
});

test("object() keeps nested object and array paths", () => {
  const v = createMiniValidator();
  const schema = v.object({
    users: v.array(
      v.object({
        name: v.string({ minLength: 1 }),
      })
    ),
  });
  const issues = v.validate(schema, {
    users: [{ name: "ok" }, { name: "" }],
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.users[1].name");
  assert.equal(issues[0].code, "string.minLength");
});

test("object() reports array length issues at the object key path", () => {
  const v = createMiniValidator();
  const schema = v.object({
    tags: v.array(v.string(), { minLength: 2 }),
  });
  const issues = v.validate(schema, {
    tags: ["a"],
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.tags");
  assert.equal(issues[0].code, "array.minLength");
});
