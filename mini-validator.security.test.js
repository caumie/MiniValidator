const test = require("node:test");
const assert = require("node:assert/strict");

const { createMiniValidator } = require("./mini-validator");

function dangerousKeyObject() {
  return JSON.parse(
    '{"__proto__":"attack","constructor":"attack","prototype":"attack","normal":"value"}'
  );
}

test("object() rejects dangerous unknown own keys", () => {
  const v = createMiniValidator();
  const schema = v.object({
    normal: v.string(),
  });

  const issues = v.validate(schema, dangerousKeyObject());
  const unknownKeys = issues.map((issue) => issue.actual).sort();

  assert.deepEqual(unknownKeys, ["__proto__", "constructor", "prototype"]);
  assert.ok(issues.every((issue) => issue.code === "object.unknownKey"));
});

test("looseObject() ignores dangerous unknown own keys", () => {
  const v = createMiniValidator();
  const schema = v.looseObject({
    normal: v.string(),
  });

  assert.deepEqual(v.validate(schema, dangerousKeyObject()), []);
});

test("record() validates dangerous own keys and their values", () => {
  const v = createMiniValidator();
  const schema = v.record(v.string(), v.number());
  const data = JSON.parse('{"__proto__":"attack","normal":1}');

  const issues = v.validate(schema, data);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.__proto__");
  assert.equal(issues[0].code, "number.base");
  assert.equal(issues[0].actual, "attack");
});

test("validation does not mutate Object.prototype", () => {
  const v = createMiniValidator();
  const data = JSON.parse('{"__proto__":{"polluted":true},"normal":"value"}');

  v.validate(v.looseObject({ normal: v.string() }), data);
  v.validate(v.object({ normal: v.string() }), data);
  v.validate(v.record(v.string(), v.union(v.string(), v.object({ polluted: v.boolean() }))), data);

  assert.equal({}.polluted, undefined);
});

test("record() ignores inherited enumerable properties", () => {
  const v = createMiniValidator();
  const proto = { inherited: "not-own" };
  const data = Object.create(proto);
  data.own = "ok";

  assert.deepEqual(v.validate(v.record(v.string(), v.string()), data), []);
});

test("object() rejects inherited required keys as missing", () => {
  const v = createMiniValidator();
  const data = Object.create({ name: "Alice" });
  const schema = v.object({
    name: v.string(),
  });

  const issues = v.validate(schema, data);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].path, "$.name");
  assert.equal(issues[0].code, "object.missingKey");
});

test("string() pattern validation does not mutate RegExp lastIndex", () => {
  const v = createMiniValidator();
  const pattern = /test/g;
  pattern.lastIndex = 1;
  const schema = v.string({ pattern: pattern });

  assert.deepEqual(v.validate(schema, "test"), []);
  assert.equal(pattern.lastIndex, 1);
});

test("union() expected descriptions expose object key names", () => {
  const v = createMiniValidator();
  const schema = v.union(
    v.object({ secretKey: v.string() }),
    v.object({ publicId: v.string() })
  );

  const issues = v.validate(schema, false);

  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].expected, ["object{secretKey}", "object{publicId}"]);
});

test("literal() issue messages include the expected literal value", () => {
  const v = createMiniValidator();
  const schema = v.literal("secret-token");

  const issues = v.validate(schema, "wrong-token");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, "literal.base");
  assert.equal(issues[0].message, "Expected literal secret-token");
  assert.equal(issues[0].expected, "secret-token");
});

test("string() accepts caller-provided RegExp patterns without safety screening", () => {
  const v = createMiniValidator();
  const schema = v.string({
    pattern: /(a+)+b/,
  });

  assert.deepEqual(v.validate(schema, "aaab"), []);
  assert.equal(v.validate(schema, "c")[0].code, "string.pattern");
});

test("constraint options are not rejected or normalized", () => {
  const v = createMiniValidator();

  assert.deepEqual(v.validate(v.string({ minLength: NaN }), ""), []);
  assert.deepEqual(v.validate(v.number({ max: Infinity }), Number.MAX_VALUE), []);
  assert.deepEqual(v.validate(v.array(v.string(), { minLength: -1 }), []), []);
});

test("object() accepts non-plain object instances", () => {
  const v = createMiniValidator();
  const schema = v.object({});

  assert.deepEqual(v.validate(schema, new Date()), []);
  assert.deepEqual(v.validate(schema, new (class User {})()), []);
});

test("object() and record() ignore symbol keys", () => {
  const v = createMiniValidator();
  const hidden = Symbol("hidden");
  const data = {
    visible: "ok",
    [hidden]: 123,
  };

  assert.deepEqual(v.validate(v.object({ visible: v.string() }), data), []);
  assert.deepEqual(v.validate(v.record(v.string(), v.string()), data), []);
});

test("object() and record() ignore non-enumerable keys", () => {
  const v = createMiniValidator();
  const data = {
    visible: "ok",
  };
  Object.defineProperty(data, "hidden", {
    enumerable: false,
    value: 123,
  });

  assert.deepEqual(v.validate(v.object({ visible: v.string() }), data), []);
  assert.deepEqual(v.validate(v.record(v.string(), v.string()), data), []);
});

test("object paths are not escaped for keys containing path syntax", () => {
  const v = createMiniValidator();
  const schema = v.object({
    "key.with.dots": v.string(),
    "key[with]brackets": v.string(),
  });

  const issues = v.validate(schema, {
    "key.with.dots": 123,
    "key[with]brackets": 456,
  });

  assert.equal(issues.length, 2);
  assert.equal(issues[0].path, "$.key.with.dots");
  assert.equal(issues[1].path, "$.key[with]brackets");
});

test("accessor properties are invoked during validation", () => {
  const v = createMiniValidator();
  let readCount = 0;
  const data = {};
  Object.defineProperty(data, "name", {
    enumerable: true,
    get: () => {
      readCount += 1;
      return "Alice";
    },
  });

  assert.deepEqual(v.validate(v.object({ name: v.string() }), data), []);
  assert.equal(readCount, 1);
});

test("Proxy ownKeys errors are not caught", () => {
  const v = createMiniValidator();
  const data = new Proxy({}, {
    ownKeys: () => {
      throw new Error("ownKeys trap");
    },
  });

  assert.throws(
    () => v.validate(v.record(v.string(), v.string()), data),
    /ownKeys trap/
  );
});

test("literal() with BigInt can produce an issue message", () => {
  const v = createMiniValidator();
  const schema = v.literal(1n);

  const issues = v.validate(schema, 2n);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].message, "Expected literal 1");
  assert.equal(issues[0].expected, 1n);
});

test("literal() with a circular object can produce an issue message", () => {
  const v = createMiniValidator();
  const value = {};
  value.self = value;
  const schema = v.literal(value);

  const issues = v.validate(schema, {});

  assert.equal(issues.length, 1);
  assert.equal(issues[0].message, "Expected literal [object Object]");
  assert.equal(issues[0].expected, value);
});

test("union() can throw while describing malformed object branches", () => {
  const v = createMiniValidator();
  const schema = v.union(
    { k: "object" },
    v.number()
  );

  assert.throws(
    () => v.validate(schema, "not-a-number"),
    TypeError
  );
});
