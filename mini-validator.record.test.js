const test = require("node:test");
const assert = require("node:assert/strict");

const { createMiniValidator } = require("./mini-validator");

test("record() validates every key and value", () => {
  const v = createMiniValidator();
  const schema = v.record(
    v.string({ pattern: /^[a-z]+$/ }),
    v.number()
  );

  assert.deepEqual(v.validate(schema, { one: 1, two: 2 }), []);
});

test("record() rejects keys that do not match the key schema at the record path", () => {
  const v = createMiniValidator();
  const schema = v.record(
    v.string({ pattern: /^[a-z]+$/ }),
    v.number()
  );
  const issues = v.validate(schema, { Bad: 1 });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "string.pattern");
  assert.equal(issues[0].actual, "Bad");
});

test("record() rejects values that do not match the value schema at the key path", () => {
  const v = createMiniValidator();
  const schema = v.record(v.string(), v.number());
  const issues = v.validate(schema, { ok: "1" });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.ok");
  assert.equal(issues[0].code, "number.base");
  assert.equal(issues[0].actual, "1");
});

test("record() can use enum-like key schemas", () => {
  const v = createMiniValidator();
  const schema = v.record(v.enums("new", "done"), v.boolean());
  const issues = v.validate(schema, {
    new: true,
    closed: false,
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "union.base");
  assert.equal(issues[0].actual, "closed");
});

test("record() rejects arrays and non-objects", () => {
  const v = createMiniValidator();
  const schema = v.record(v.string(), v.number());

  assert.equal(v.validate(schema, [])[0].code, "record.base");

  const issues = v.validate(schema, "not-record");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "record.base");
});
