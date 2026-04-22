const test = require("node:test");
const assert = require("node:assert/strict");

const { createMiniValidator } = require("./mini-validator");

test("looseObject() accepts matching non-array objects", () => {
  const v = createMiniValidator();
  const schema = v.looseObject({
    name: v.string(),
  });

  assert.deepEqual(v.validate(schema, { name: "Alice" }), []);
});

test("looseObject() rejects null and arrays", () => {
  const v = createMiniValidator();
  const schema = v.looseObject({ name: v.string() });

  assert.equal(v.validate(schema, null)[0].code, "object.base");
  assert.equal(v.validate(schema, [])[0].code, "object.base");
});

test("looseObject() ignores unknown keys", () => {
  const v = createMiniValidator();
  const schema = v.looseObject({ name: v.string() });

  assert.deepEqual(v.validate(schema, {
    name: "Alice",
    extra: 123,
  }), []);
});

test("looseObject() validates only keys defined in the shape", () => {
  const v = createMiniValidator();
  const schema = v.looseObject({
    name: v.string({ minLength: 1 }),
    age: v.number({ min: 0 }),
  });
  const issues = v.validate(schema, {
    name: "",
    age: -1,
    extra: false,
  });

  assert.equal(issues.length, 2);
  assert.equal(issues[0].path, "$.name");
  assert.equal(issues[0].code, "string.minLength");
  assert.equal(issues[1].path, "$.age");
  assert.equal(issues[1].code, "number.min");
});

test("looseObject() treats missing and undefined required values the same", () => {
  const v = createMiniValidator();
  const schema = v.looseObject({ name: v.string() });

  const missingIssues = v.validate(schema, {});
  const undefinedIssues = v.validate(schema, { name: undefined });

  assert.equal(missingIssues.length, 1);
  assert.equal(missingIssues[0].path, "$.name");
  assert.equal(missingIssues[0].code, "string.base");
  assert.deepEqual(missingIssues, undefinedIssues);
});

test("looseObject() allows missing optional keys", () => {
  const v = createMiniValidator();
  const schema = v.looseObject({
    name: v.string(),
    memo: v.optional(v.string()),
  });

  assert.deepEqual(v.validate(schema, { name: "Alice" }), []);
});
