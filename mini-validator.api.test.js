const test = require("node:test");
const assert = require("node:assert/strict");

const createMiniValidator = require("./mini-validator");
const { createMiniValidator: namedCreateMiniValidator } = require("./mini-validator");

test("createMiniValidator() returns the public builder API", () => {
  const v = createMiniValidator();

  assert.equal(typeof v.string, "function");
  assert.equal(typeof v.number, "function");
  assert.equal(typeof v.boolean, "function");
  assert.equal(typeof v.null, "function");
  assert.equal(typeof v.literal, "function");
  assert.equal(typeof v.array, "function");
  assert.equal(typeof v.object, "function");
  assert.equal(typeof v.looseObject, "function");
  assert.equal(typeof v.record, "function");
  assert.equal(typeof v.optional, "function");
  assert.equal(typeof v.union, "function");
  assert.equal(typeof v.enums, "function");
  assert.equal(typeof v.validate, "function");
});

test("removed APIs are not exposed", () => {
  const v = createMiniValidator();

  assert.equal(Object.hasOwn(v, "strictObject"), false);
  assert.equal(Object.hasOwn(v, "parse"), false);
  assert.equal(Object.hasOwn(v, "ValidationError"), false);
  assert.equal(Object.hasOwn(createMiniValidator, "ValidationError"), false);
});

test("CommonJS default and named require styles can create validators", () => {
  const v = namedCreateMiniValidator();

  assert.equal(namedCreateMiniValidator, createMiniValidator);
  assert.equal(createMiniValidator.createMiniValidator, createMiniValidator);
  assert.equal(createMiniValidator.default, createMiniValidator);
  assert.equal(typeof v.validate, "function");
});

test("validate() always returns an issue array", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.string(), "ok"), []);
  assert.ok(Array.isArray(v.validate(v.string(), 123)));
});

test("issue objects have path, code, message, expected, and actual", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.string(), 123);

  assert.equal(typeof issues[0].path, "string");
  assert.equal(typeof issues[0].code, "string");
  assert.equal(typeof issues[0].message, "string");
  assert.ok("expected" in issues[0]);
  assert.ok("actual" in issues[0]);
});

test("validate() does not mutate input values", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
    tags: v.array(v.string()),
  });
  const value = {
    name: "Alice",
    tags: ["a", "b"],
  };
  const snapshot = JSON.stringify(value);

  assert.deepEqual(v.validate(schema, value), []);
  assert.equal(JSON.stringify(value), snapshot);
});

test("invalid schemas return schema.invalid issues", () => {
  const v = createMiniValidator();

  assert.equal(v.validate(/** @type {any} */(null), "abc")[0].code, "schema.invalid");
  assert.equal(v.validate(/** @type {any} */({ k: "object" }), {})[0].code, "schema.invalid");
  assert.equal(v.validate(/** @type {any} */({ k: "looseObject" }), {})[0].code, "schema.invalid");
  assert.equal(v.validate(/** @type {any} */({ k: "record" }), { a: 1 })[0].code, "schema.invalid");
});

test("unknown schema kinds return schema.unknownKind issues", () => {
  const v = createMiniValidator();
  const issues = v.validate(/** @type {any} */({ k: "unknown-kind" }), "abc");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "schema.unknownKind");
});

test("primitive boundary values stay distinct", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.number(), 0), []);
  assert.deepEqual(v.validate(v.boolean(), false), []);
  assert.deepEqual(v.validate(v.string(), ""), []);
  assert.deepEqual(v.validate(v.optional(v.string()), undefined), []);
  assert.deepEqual(v.validate(v.null(), null), []);
});
