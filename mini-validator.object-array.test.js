const test = require("node:test");
const assert = require("node:assert/strict");

const { createMiniValidator } = require("./mini-validator");

test("array() は配列を通すこと", () => {
  const v = createMiniValidator();
  const schema = v.array(v.string());

  assert.deepEqual(v.validate(schema, ["a", "b"]), []);
});

test("array() は配列以外を拒否すること", () => {
  const v = createMiniValidator();
  const schema = v.array(v.string());

  const issues = v.validate(schema, "abc");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "array.base");
});

test("array() は各要素を検証すること", () => {
  const v = createMiniValidator();
  const schema = v.array(v.string());

  const issues = v.validate(schema, ["ok", 123]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$[1]");
  assert.equal(issues[0].code, "string.base");
});

test("array() は複数要素のエラーをまとめて返すこと", () => {
  const v = createMiniValidator();
  const schema = v.array(v.string({ minLength: 2 }));

  const issues = v.validate(schema, ["a", "bb", "c"]);

  assert.equal(issues.length, 2);
  assert.equal(issues[0].path, "$[0]");
  assert.equal(issues[0].code, "string.minLength");
  assert.equal(issues[1].path, "$[2]");
  assert.equal(issues[1].code, "string.minLength");
});

test("array() の minLength 未満で失敗すること", () => {
  const v = createMiniValidator();
  const schema = v.array(v.string(), { minLength: 2 });

  const issues = v.validate(schema, ["a"]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "array.minLength");
});

test("array() の maxLength 超過で失敗すること", () => {
  const v = createMiniValidator();
  const schema = v.array(v.string(), { maxLength: 2 });

  const issues = v.validate(schema, ["a", "b", "c"]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "array.maxLength");
});

test("array() は長さ違反時に要素検証より先に失敗すること", () => {
  const v = createMiniValidator();
  const schema = v.array(v.string({ minLength: 2 }), { minLength: 2 });

  const issues = v.validate(schema, ["a"]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "array.minLength");
});

test("object() は plain object を通すこと", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
  });

  assert.deepEqual(v.validate(schema, { name: "Alice" }), []);
});

test("object() は null を拒否すること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
  });

  const issues = v.validate(schema, null);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "object.base");
});

test("object() は配列を拒否すること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
  });

  const issues = v.validate(schema, []);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "object.base");
});

test("object() は各キーを再帰的に検証すること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
    age: v.number(),
  });

  const issues = v.validate(schema, {
    name: "Alice",
    age: "42",
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.age");
  assert.equal(issues[0].code, "number.base");
});

test("object() は複数キーのエラーをまとめて返すこと", () => {
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

test("object() はネストした object の path を正しく返すこと", () => {
  const v = createMiniValidator();
  const schema = v.object({
    user: v.object({
      name: v.string({ minLength: 1 }),
    }),
  });

  const issues = v.validate(schema, {
    user: { name: "" },
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.user.name");
  assert.equal(issues[0].code, "string.minLength");
});

test("object() は schema にない追加キーを無視すること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
  });

  const issues = v.validate(schema, {
    name: "Alice",
    extra: 123,
  });

  assert.deepEqual(issues, []);
});

test("object() は必須キー欠落時にそのキーの path で失敗すること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
  });

  const issues = v.validate(schema, {});

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.name");
  assert.equal(issues[0].code, "string.base");
});

test("object() の中で optional キーは欠落していても通ること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
    memo: v.optional(v.string()),
  });

  assert.deepEqual(v.validate(schema, { name: "Alice" }), []);
});

test("object() の中で optional キーに不正値が入ると失敗すること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
    memo: v.optional(v.string()),
  });

  const issues = v.validate(schema, {
    name: "Alice",
    memo: 123,
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.memo");
  assert.equal(issues[0].code, "union.base");
});

test("object() のネストした配列要素で path が正しく出ること", () => {
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

test("array(object(...)) の複数要素でエラーを収集できること", () => {
  const v = createMiniValidator();
  const schema = v.array(
    v.object({
      id: v.number(),
      name: v.string({ minLength: 1 }),
    })
  );

  const issues = v.validate(schema, [
    { id: 1, name: "Alice" },
    { id: "x", name: "" },
  ]);

  assert.equal(issues.length, 2);
  assert.equal(issues[0].path, "$[1].id");
  assert.equal(issues[0].code, "number.base");
  assert.equal(issues[1].path, "$[1].name");
  assert.equal(issues[1].code, "string.minLength");
});

test("object(array(...)) の配列長違反を検出できること", () => {
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

test("object() と array() を含む値を parse() が成功時にそのまま返すこと", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
    tags: v.array(v.string()),
  });

  const value = {
    name: "Alice",
    tags: ["a", "b"],
  };

  const result = v.parse(schema, value);

  assert.equal(result, value);
});

test("object() と array() を含む値を parse() が失敗時に ValidationError で返すこと", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
    tags: v.array(v.string()),
  });

  assert.throws(
    () => v.parse(schema, {
      name: "Alice",
      tags: ["ok", 123],
    }),
    (err) => {
      assert.ok(err instanceof v.ValidationError);
      assert.equal(err.issues.length, 1);
      assert.equal(err.issues[0].path, "$.tags[1]");
      assert.equal(err.issues[0].code, "string.base");
      return true;
    }
  );
});
