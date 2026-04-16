const test = require("node:test");
const assert = require("node:assert/strict");

const { createMiniValidator } = require("./mini-validator");

test("union() はいずれか1枝に合えば通ること", () => {
  const v = createMiniValidator();
  const schema = v.union(v.string(), v.number());

  assert.deepEqual(v.validate(schema, "abc"), []);
  assert.deepEqual(v.validate(schema, 123), []);
});

test("union() は全枝不一致なら union.base を返すこと", () => {
  const v = createMiniValidator();
  const schema = v.union(v.string(), v.number());

  const issues = v.validate(schema, false);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "union.base");
});

test("union() の expected に候補一覧が入ること", () => {
  const v = createMiniValidator();
  const schema = v.union(v.string(), v.number());

  const issues = v.validate(schema, false);

  assert.deepEqual(issues[0].expected, ["string", "number"]);
  assert.equal(issues[0].actual, false);
});

test("union() の expected が literal 候補一覧になること", () => {
  const v = createMiniValidator();
  const schema = v.union(v.literal("new"), v.literal("done"));

  const issues = v.validate(schema, "hold");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "union.base");
  assert.deepEqual(issues[0].expected, ['literal("new")', 'literal("done")']);
});

test("union() の expected に array の説明が含まれること", () => {
  const v = createMiniValidator();
  const schema = v.union(
    v.array(v.string()),
    v.number()
  );

  const issues = v.validate(schema, {});

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "union.base");
  assert.deepEqual(issues[0].expected, ["array<string>", "number"]);
});

test("union() の expected に object の説明が含まれること", () => {
  const v = createMiniValidator();
  const schema = v.union(
    v.object({ id: v.number(), name: v.string() }),
    v.string()
  );

  const issues = v.validate(schema, false);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "union.base");
  assert.deepEqual(issues[0].expected, ["object{id, name}", "string"]);
});

test("union() は null を候補に含められること", () => {
  const v = createMiniValidator();
  const schema = v.union(v.null(), v.string());

  assert.deepEqual(v.validate(schema, null), []);
  assert.deepEqual(v.validate(schema, "abc"), []);
});

test("union() は object と array のどちらかを許可できること", () => {
  const v = createMiniValidator();
  const schema = v.union(
    v.object({ name: v.string() }),
    v.array(v.string())
  );

  assert.deepEqual(v.validate(schema, { name: "Alice" }), []);
  assert.deepEqual(v.validate(schema, ["a", "b"]), []);
});

test("union() は object の各枝のどちらにも一致しない場合に失敗すること", () => {
  const v = createMiniValidator();
  const schema = v.union(
    v.object({ type: v.literal("a"), value: v.string() }),
    v.object({ type: v.literal("b"), value: v.number() })
  );

  const issues = v.validate(schema, {
    type: "c",
    value: true,
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "union.base");
});

test("union() は 0 と false と空文字を厳密に区別すること", () => {
  const v = createMiniValidator();
  const schema = v.union(v.literal(0), v.literal(false), v.literal(""));

  assert.deepEqual(v.validate(schema, 0), []);
  assert.deepEqual(v.validate(schema, false), []);
  assert.deepEqual(v.validate(schema, ""), []);

  const issues = v.validate(schema, null);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "union.base");
});

test("union() は内側 schema に制約がある場合でも、どれか1枝が通れば成功すること", () => {
  const v = createMiniValidator();
  const schema = v.union(
    v.string({ minLength: 3 }),
    v.number({ min: 10 })
  );

  assert.deepEqual(v.validate(schema, "abc"), []);
  assert.deepEqual(v.validate(schema, 10), []);
});

test("union() は全枝が制約違反なら失敗すること", () => {
  const v = createMiniValidator();
  const schema = v.union(
    v.string({ minLength: 3 }),
    v.number({ min: 10 })
  );

  const issues1 = v.validate(schema, "ab");
  const issues2 = v.validate(schema, 5);

  assert.equal(issues1.length, 1);
  assert.equal(issues1[0].code, "union.base");

  assert.equal(issues2.length, 1);
  assert.equal(issues2[0].code, "union.base");
});

test("enums() は指定 literal 群のいずれかを通すこと", () => {
  const v = createMiniValidator();
  const schema = v.enums("new", "done");

  assert.deepEqual(v.validate(schema, "new"), []);
  assert.deepEqual(v.validate(schema, "done"), []);
});

test("enums() は未定義値を拒否すること", () => {
  const v = createMiniValidator();
  const schema = v.enums("new", "done");

  const issues = v.validate(schema, "hold");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "union.base");
});

test("enums() の expected が literal 候補一覧になること", () => {
  const v = createMiniValidator();
  const schema = v.enums("new", "done", "hold");

  const issues = v.validate(schema, "closed");

  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].expected, [
    'literal("new")',
    'literal("done")',
    'literal("hold")',
  ]);
});

test("optional() は undefined を通すこと", () => {
  const v = createMiniValidator();
  const schema = v.optional(v.string());

  assert.deepEqual(v.validate(schema, undefined), []);
});

test("optional() は内側 schema に合う値を通すこと", () => {
  const v = createMiniValidator();
  const schema = v.optional(v.string());

  assert.deepEqual(v.validate(schema, "abc"), []);
});

test("optional() は不正値を拒否すること", () => {
  const v = createMiniValidator();
  const schema = v.optional(v.string());

  const issues = v.validate(schema, 123);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$");
  assert.equal(issues[0].code, "union.base");
});

test("optional() は undefined を通すが null は通さないこと", () => {
  const v = createMiniValidator();
  const schema = v.optional(v.string());

  assert.deepEqual(v.validate(schema, undefined), []);

  const issues = v.validate(schema, null);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "union.base");
});

test("optional() は内側 schema の制約を維持すること", () => {
  const v = createMiniValidator();
  const schema = v.optional(v.string({ minLength: 2 }));

  assert.deepEqual(v.validate(schema, undefined), []);
  assert.deepEqual(v.validate(schema, "ab"), []);

  const issues = v.validate(schema, "a");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "union.base");
});

test("object 内の optional キーは欠落していても通ること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
    memo: v.optional(v.string()),
  });

  assert.deepEqual(v.validate(schema, { name: "Alice" }), []);
});

test("object 内の optional キーは undefined でも通ること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
    memo: v.optional(v.string()),
  });

  assert.deepEqual(v.validate(schema, {
    name: "Alice",
    memo: undefined,
  }), []);
});

test("object 内の optional キーに正しい値があれば通ること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    name: v.string(),
    memo: v.optional(v.string({ minLength: 2 })),
  });

  assert.deepEqual(v.validate(schema, {
    name: "Alice",
    memo: "ok",
  }), []);
});

test("object 内の optional キーに不正値が入るとその path で失敗すること", () => {
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

test("必須キーと optional キーを区別できること", () => {
  const v = createMiniValidator();
  const schema = v.object({
    requiredName: v.string(),
    optionalMemo: v.optional(v.string()),
  });

  const issues = v.validate({ ...schema }, {});

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.requiredName");
  assert.equal(issues[0].code, "string.base");
});

test("optional() を含む union を定義できること", () => {
  const v = createMiniValidator();
  const schema = v.union(
    v.optional(v.string()),
    v.number()
  );

  assert.deepEqual(v.validate(schema, undefined), []);
  assert.deepEqual(v.validate(schema, "abc"), []);
  assert.deepEqual(v.validate(schema, 123), []);
});

test("optional() を含む union で全候補不一致なら union.base を返すこと", () => {
  const v = createMiniValidator();
  const schema = v.union(
    v.optional(v.string()),
    v.number()
  );

  const issues = v.validate(schema, false);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "union.base");
});

test("parse() は union 成功時に元の値をそのまま返すこと", () => {
  const v = createMiniValidator();
  const schema = v.union(v.string(), v.number());

  const value = 123;
  const result = v.parse(schema, value);

  assert.equal(result, value);
});

test("parse() は union 失敗時に ValidationError を投げること", () => {
  const v = createMiniValidator();
  const schema = v.union(v.string(), v.number());

  assert.throws(
    () => v.parse(schema, false),
    (err) => {
      assert.ok(err instanceof v.ValidationError);
      assert.equal(err.issues.length, 1);
      assert.equal(err.issues[0].path, "$");
      assert.equal(err.issues[0].code, "union.base");
      return true;
    }
  );
});

test("parse() は optional 成功時に undefined をそのまま返すこと", () => {
  const v = createMiniValidator();
  const schema = v.optional(v.string());

  const result = v.parse(schema, undefined);

  assert.equal(result, undefined);
});

test("parse() は optional 失敗時に ValidationError を投げること", () => {
  const v = createMiniValidator();
  const schema = v.optional(v.string());

  assert.throws(
    () => v.parse(schema, false),
    (err) => {
      assert.ok(err instanceof v.ValidationError);
      assert.equal(err.issues.length, 1);
      assert.equal(err.issues[0].path, "$");
      assert.equal(err.issues[0].code, "union.base");
      return true;
    }
  );
});
