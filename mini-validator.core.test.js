const test = require("node:test");
const assert = require("node:assert/strict");

const { createMiniValidator } = require("./mini-validator");

test("createMiniValidator() が公開API一式を返すこと", () => {
  const v = createMiniValidator();

  assert.equal(typeof v.ValidationError, "function");
  assert.equal(typeof v.string, "function");
  assert.equal(typeof v.number, "function");
  assert.equal(typeof v.boolean, "function");
  assert.equal(typeof v.null, "function");
  assert.equal(typeof v.literal, "function");
  assert.equal(typeof v.array, "function");
  assert.equal(typeof v.object, "function");
  assert.equal(typeof v.optional, "function");
  assert.equal(typeof v.union, "function");
  assert.equal(typeof v.enums, "function");
  assert.equal(typeof v.validate, "function");
  assert.equal(typeof v.parse, "function");
});

test("ValidationError が Error として扱えること", () => {
  const v = createMiniValidator();
  const err = new v.ValidationError([]);

  assert.ok(err instanceof Error);
  assert.equal(err.name, "ValidationError");
  assert.ok(Array.isArray(err.issues));
});

test("validate() は常に配列を返すこと", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.string(), "ok");

  assert.ok(Array.isArray(issues));
  assert.equal(issues.length, 0);
});

test("parse() は成功時に元の値をそのまま返すこと", () => {
  const v = createMiniValidator();
  const value = { name: "Alice" };
  const schema = v.object({
    name: v.string(),
  });

  const result = v.parse(schema, value);

  assert.equal(result, value);
});

test("parse() は失敗時に ValidationError を投げ、issues を持つこと", () => {
  const v = createMiniValidator();
  const schema = v.string();

  assert.throws(
    () => v.parse(schema, 123),
    (err) => {
      assert.ok(err instanceof v.ValidationError);
      assert.ok(Array.isArray(err.issues));
      assert.equal(err.issues.length, 1);
      return true;
    }
  );
});

test("string() は文字列を通すこと", () => {
  const v = createMiniValidator();
  assert.deepEqual(v.validate(v.string(), "abc"), []);
});

test("string() は非文字列を拒否すること", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.string(), 123);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "string.base");
  assert.equal(issues[0].path, "$");
});

test("number() は数値を通すこと", () => {
  const v = createMiniValidator();
  assert.deepEqual(v.validate(v.number(), 123), []);
});

test("number() は NaN を拒否すること", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.number(), NaN);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "number.base");
});

test("boolean() は真偽値のみを通すこと", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.boolean(), true), []);
  assert.deepEqual(v.validate(v.boolean(), false), []);
  assert.equal(v.validate(v.boolean(), 1).length, 1);
});

test("null() は null のみを通すこと", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.null(), null), []);
  assert.equal(v.validate(v.null(), {}).length, 1);
});

test("literal() は完全一致のみを通すこと", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.literal("ok"), "ok"), []);
  const issues = v.validate(v.literal("ok"), "ng");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "literal.base");
});

test("string() の minLength 未満で失敗すること", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.string({ minLength: 3 }), "ab");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "string.minLength");
});

test("string() の maxLength 超過で失敗すること", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.string({ maxLength: 3 }), "abcd");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "string.maxLength");
});

test("string() の pattern 不一致で失敗すること", () => {
  const v = createMiniValidator();
  const issues = v.validate(
    v.string({ pattern: /^[A-Z]{3}$/ }),
    "abc"
  );

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "string.pattern");
});

test("string() の pattern に一致する値は通ること", () => {
  const v = createMiniValidator();
  const schema = v.string({ pattern: /^[A-Z]{3}\d{2}$/ });

  assert.deepEqual(v.validate(schema, "ABC12"), []);
});

test("number() の min 未満で失敗すること", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.number({ min: 10 }), 9);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "number.min");
});

test("number() の max 超過で失敗すること", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.number({ max: 10 }), 11);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "number.max");
});

test("number() の integer: true で小数を拒否すること", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.number({ integer: true }), 1.5);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "number.integer");
});

test("number() は境界値 min / max ちょうどを通すこと", () => {
  const v = createMiniValidator();
  const schema = v.number({ min: 10, max: 20 });

  assert.deepEqual(v.validate(schema, 10), []);
  assert.deepEqual(v.validate(schema, 20), []);
});

test("number() は Infinity を現在の実装では通すこと", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.number(), Infinity);

  assert.deepEqual(issues, []);
});

test("literal() は 0 と false と空文字を厳密に区別すること", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.literal(0), 0), []);
  assert.deepEqual(v.validate(v.literal(false), false), []);
  assert.deepEqual(v.validate(v.literal(""), ""), []);

  assert.equal(v.validate(v.literal(0), false).length, 1);
  assert.equal(v.validate(v.literal(false), 0).length, 1);
  assert.equal(v.validate(v.literal(""), 0).length, 1);
});

test("issue が path, code, message, expected, actual を持つこと", () => {
  const v = createMiniValidator();
  const issues = v.validate(v.string(), 123);

  assert.equal(typeof issues[0].path, "string");
  assert.equal(typeof issues[0].code, "string");
  assert.equal(typeof issues[0].message, "string");
  assert.ok("expected" in issues[0]);
  assert.ok("actual" in issues[0]);
});

test("parse() が投げた ValidationError の issues に path と code が入ること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string({ minLength: 1 }),
  });

  try {
    v.parse(schema, { name: "" });
    assert.fail("ValidationError が投げられるべき");
  } catch (err) {
    assert.ok(err instanceof v.ValidationError);
    assert.equal(err.issues.length, 1);
    assert.equal(err.issues[0].path, "$.name");
    assert.equal(err.issues[0].code, "string.minLength");
  }
});

test("validate() は入力値を変更しないこと", () => {
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

  const issues = v.validate(schema, value);

  assert.deepEqual(issues, []);
  assert.equal(JSON.stringify(value), snapshot);
});

test("parse() は成功時に入力値を変更せずそのまま返すこと", () => {
  const v = createMiniValidator();
  const schema = v.object({
    id: v.number(),
  });
  const value = { id: 1 };

  const result = v.parse(schema, value);

  assert.equal(result, value);
  assert.deepEqual(result, { id: 1 });
});

test("不正な schema を schema.invalid として扱うこと", () => {
  const v = createMiniValidator();
  const issues = v.validate(null, "abc");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "schema.invalid");
});

test("未知の schema kind を schema.unknownKind として扱うこと", () => {
  const v = createMiniValidator();
  const issues = v.validate({ k: "unknown-kind" }, "abc");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "schema.unknownKind");
});

test("parse() は schema 不正でも ValidationError に統一されること", () => {
  const v = createMiniValidator();

  assert.throws(
    () => v.parse({ k: "unknown-kind" }, "abc"),
    (err) => {
      assert.ok(err instanceof v.ValidationError);
      assert.equal(err.issues.length, 1);
      assert.equal(err.issues[0].code, "schema.unknownKind");
      return true;
    }
  );
});

test("0, false, 空文字, undefined, null の境界値をそれぞれ区別すること", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.number(), 0), []);
  assert.deepEqual(v.validate(v.boolean(), false), []);
  assert.deepEqual(v.validate(v.string(), ""), []);
  assert.deepEqual(v.validate(v.optional(v.string()), undefined), []);
  assert.deepEqual(v.validate(v.null(), null), []);
});
