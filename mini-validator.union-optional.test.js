const test = require("node:test");
const assert = require("node:assert/strict");

const { createMiniValidator } = require("./mini-validator");

test("union() accepts any matching branch", () => {
  const v = createMiniValidator();
  const schema = v.union(v.string(), v.number());

  assert.deepEqual(v.validate(schema, "abc"), []);
  assert.deepEqual(v.validate(schema, 123), []);
});

test("union() returns one union.base issue when every branch fails", () => {
  const v = createMiniValidator();
  const schema = v.union(v.string(), v.number());
  const issues = v.validate(schema, false);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "union.base");
  assert.deepEqual(issues[0].expected, ["string", "number"]);
  assert.equal(issues[0].actual, false);
});

test("union() expected values describe literal, array, object, and looseObject branches", () => {
  const v = createMiniValidator();

  assert.deepEqual(
    v.validate(v.union(v.literal("new"), v.literal("done")), "hold")[0].expected,
    ["literal(new)", "literal(done)"]
  );
  assert.deepEqual(
    v.validate(v.union(v.array(v.string()), v.number()), {})[0].expected,
    ["array<string>", "number"]
  );
  assert.deepEqual(
    v.validate(v.union(v.object({ id: v.number(), name: v.string() }), v.string()), false)[0].expected,
    ["object{id, name}", "string"]
  );
  assert.deepEqual(
    v.validate(v.union(v.looseObject({ id: v.number() }), v.string()), false)[0].expected,
    ["looseObject{id}", "string"]
  );
});

test("union() can include null, object, and array branches", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.union(v.null(), v.string()), null), []);
  assert.deepEqual(v.validate(v.union(v.null(), v.string()), "abc"), []);

  const objectOrArray = v.union(
    v.object({ name: v.string() }),
    v.array(v.string())
  );
  assert.deepEqual(v.validate(objectOrArray, { name: "Alice" }), []);
  assert.deepEqual(v.validate(objectOrArray, ["a", "b"]), []);
});

test("union() rejects values that match no constrained branch", () => {
  const v = createMiniValidator();
  const schema = v.union(
    v.string({ minLength: 3 }),
    v.number({ min: 10 })
  );

  assert.equal(v.validate(schema, "ab")[0].code, "union.base");
  assert.equal(v.validate(schema, 5)[0].code, "union.base");
});

test("union() keeps literal values distinct", () => {
  const v = createMiniValidator();
  const schema = v.union(v.literal(0), v.literal(false), v.literal(""));

  assert.deepEqual(v.validate(schema, 0), []);
  assert.deepEqual(v.validate(schema, false), []);
  assert.deepEqual(v.validate(schema, ""), []);
  assert.equal(v.validate(schema, null)[0].code, "union.base");
});

test("enums() accepts listed values and reports literal candidates", () => {
  const v = createMiniValidator();
  const schema = v.enums("new", "done", "hold");

  assert.deepEqual(v.validate(schema, "new"), []);
  assert.deepEqual(v.validate(schema, "done"), []);

  const issues = v.validate(schema, "closed");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "union.base");
  assert.deepEqual(issues[0].expected, [
    "literal(new)",
    "literal(done)",
    "literal(hold)",
  ]);
});

test("optional() accepts undefined and matching inner values", () => {
  const v = createMiniValidator();
  const schema = v.optional(v.string({ minLength: 2 }));

  assert.deepEqual(v.validate(schema, undefined), []);
  assert.deepEqual(v.validate(schema, "ab"), []);
});

test("optional() rejects null and invalid inner values", () => {
  const v = createMiniValidator();
  const schema = v.optional(v.string({ minLength: 2 }));

  assert.deepEqual(
    v.validate(schema, null).map((issue) => issue.code),
    ["string.base", "optional.base"]
  );
  assert.deepEqual(
    v.validate(schema, "a").map((issue) => issue.code),
    ["string.minLength", "optional.base"]
  );
  assert.deepEqual(
    v.validate(schema, 123).map((issue) => issue.code),
    ["string.base", "optional.base"]
  );
});

test("optional() can be nested in union()", () => {
  const v = createMiniValidator();
  const schema = v.union(
    v.optional(v.string()),
    v.number()
  );

  assert.deepEqual(v.validate(schema, undefined), []);
  assert.deepEqual(v.validate(schema, "abc"), []);
  assert.deepEqual(v.validate(schema, 123), []);
  assert.equal(v.validate(schema, false)[0].code, "union.base");
});
