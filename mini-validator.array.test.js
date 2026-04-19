const test = require("node:test");
const assert = require("node:assert/strict");

const { createMiniValidator } = require("./mini-validator");

test("array() accepts arrays", () => {
  const v = createMiniValidator();
  const schema = v.array(v.string());

  assert.deepEqual(v.validate(schema, ["a", "b"]), []);
});

test("array() rejects non-arrays", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.array(v.string()), "abc");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "array.base");
});

test("array() validates each item and collects item issues", () => {
  const v = createMiniValidator();
  const schema = v.array(v.string({ minLength: 2 }));
  const issues = v.validate(schema, ["a", "bb", "c"]);

  assert.equal(issues.length, 2);
  assert.equal(issues[0].path, "$[0]");
  assert.equal(issues[0].code, "string.minLength");
  assert.equal(issues[1].path, "$[2]");
  assert.equal(issues[1].code, "string.minLength");
});

test("array() enforces minLength and maxLength before item validation", () => {
  const v = createMiniValidator();

  const minIssues = v.validate(v.array(v.string({ minLength: 2 }), { minLength: 2 }), ["a"]);
  assert.equal(minIssues.length, 1);
  assert.equal(minIssues[0].path, "$");
  assert.equal(minIssues[0].code, "array.minLength");

  const maxIssues = v.validate(v.array(v.string(), { maxLength: 2 }), ["a", "b", "c"]);
  assert.equal(maxIssues.length, 1);
  assert.equal(maxIssues[0].path, "$");
  assert.equal(maxIssues[0].code, "array.maxLength");
});
