/**
 * 小規模な JavaScript 向けのバリデータ生成関数。
 *
 * - createMiniValidator() を呼ぶと、schema builder と検証関数を持つ validator を返す
 * - 主用途は、JSON.parse() 後の値や plain object が想定した型・制約に合うかの検証
 * - 依存なし、1ファイル、ランタイム検証専用
 *
 * 提供する主な機能:
 * - v.string({ minLength, maxLength, pattern })
 * - v.number({ min, max, integer })
 * - v.boolean()
 * - v.null()
 * - v.literal(value)
 * - v.array(itemSchema, { minLength, maxLength })
 * - v.object(shape)
 * - v.optional(schema)
 * - v.union(a, b, ...)
 * - v.enums(...literals)
 * - v.validate(schema, value) -> issue 配列を返す
 * - v.parse(schema, value) -> 妥当なら value を返し、不正なら ValidationError を投げる
 *
 * 設計方針:
 * - boolean を返すだけではなく、失敗箇所を issues として収集する
 * - issue には path, code, message, expected, actual を持たせる
 * - union は「どれか1つに一致すれば通る」
 * - object は schema に定義されたキーだけを検証し、未知キーは無視する
 * - 内部実装関数は "_" プレフィックスを付け、公開 API と区別する
 *
 * 制限:
 * - transform / default 値 / 非同期検証 / strict object は未対応
 * - union の分岐ごとの詳細エラーは返さず、union 全体の不一致として扱う
 *
 * 使用例:
 *   const v = createMiniValidator();
 *
 *   const User = v.object({
 *     id: v.union(v.string(), v.number({ integer: true, min: 1 })),
 *     name: v.string({ minLength: 1, maxLength: 20 }),
 *     tags: v.array(v.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
 *     status: v.enums("new", "done")
 *   });
 *
 *   const issues = v.validate(User, data);
 *   const value = v.parse(User, data);
 */

function createMiniValidator() {
  function ValidationError(issues) {
    this.name = "ValidationError";
    this.message = "Validation failed";
    this.issues = issues || [];
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    } else {
      this.stack = (new Error(this.message)).stack;
    }
  }
  ValidationError.prototype = Object.create(Error.prototype);
  ValidationError.prototype.constructor = ValidationError;

  function string(opts) {
    return { k: "string", c: opts || null };
  }

  function number(opts) {
    return { k: "number", c: opts || null };
  }

  function boolean() {
    return { k: "boolean" };
  }

  function nil() {
    return { k: "null" };
  }

  function literal(value) {
    return { k: "literal", v: value };
  }

  function array(item, opts) {
    return { k: "array", i: item, c: opts || null };
  }

  function object(shape) {
    return { k: "object", s: shape };
  }

  function optional(inner) {
    return [literal(undefined), inner];
  }

  function union() {
    return Array.prototype.slice.call(arguments);
  }

  function enums() {
    return Array.prototype.slice.call(arguments).map(literal);
  }

  function _issue(path, code, message, expected, actual) {
    return {
      path: path,
      code: code,
      message: message,
      expected: expected,
      actual: actual
    };
  }

  function _joinPath(path, key) {
    return path === "$" ? "$." + key : path + "." + key;
  }

  function _describe(schema) {
    if (Array.isArray(schema)) {
      return schema.map(_describe);
    }

    if (!schema || typeof schema !== "object") {
      return String(schema);
    }

    switch (schema.k) {
      case "string":
        return "string";
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "null":
        return "null";
      case "literal":
        return "literal(" + JSON.stringify(schema.v) + ")";
      case "array":
        return "array<" + _describe(schema.i) + ">";
      case "object":
        return "object{" + Object.keys(schema.s).join(", ") + "}";
      default:
        return "unknown";
    }
  }

  function _visitString(schema, value, path) {
    if (typeof value !== "string") {
      return [_issue(path, "string.base", "Expected string", "string", value)];
    }

    const c = schema.c;
    if (!c) return [];

    if (c.minLength != null && value.length < c.minLength) {
      return [
        _issue(
          path,
          "string.minLength",
          "Expected string length >= " + c.minLength,
          { minLength: c.minLength },
          value
        )
      ];
    }

    if (c.maxLength != null && value.length > c.maxLength) {
      return [
        _issue(
          path,
          "string.maxLength",
          "Expected string length <= " + c.maxLength,
          { maxLength: c.maxLength },
          value
        )
      ];
    }

    if (c.pattern != null && !c.pattern.test(value)) {
      return [
        _issue(
          path,
          "string.pattern",
          "Expected string to match pattern",
          { pattern: String(c.pattern) },
          value
        )
      ];
    }

    return [];
  }

  function _visitNumber(schema, value, path) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return [_issue(path, "number.base", "Expected number", "number", value)];
    }

    const c = schema.c;
    if (!c) return [];

    if (c.integer && !Number.isInteger(value)) {
      return [
        _issue(
          path,
          "number.integer",
          "Expected integer",
          { integer: true },
          value
        )
      ];
    }

    if (c.min != null && value < c.min) {
      return [
        _issue(
          path,
          "number.min",
          "Expected number >= " + c.min,
          { min: c.min },
          value
        )
      ];
    }

    if (c.max != null && value > c.max) {
      return [
        _issue(
          path,
          "number.max",
          "Expected number <= " + c.max,
          { max: c.max },
          value
        )
      ];
    }

    return [];
  }

  function _visitBoolean(value, path) {
    if (typeof value !== "boolean") {
      return [_issue(path, "boolean.base", "Expected boolean", "boolean", value)];
    }
    return [];
  }

  function _visitNull(value, path) {
    if (value !== null) {
      return [_issue(path, "null.base", "Expected null", "null", value)];
    }
    return [];
  }

  function _visitLiteral(schema, value, path) {
    if (value !== schema.v) {
      return [
        _issue(
          path,
          "literal.base",
          "Expected literal " + JSON.stringify(schema.v),
          schema.v,
          value
        )
      ];
    }
    return [];
  }

  function _visitArray(schema, value, path) {
    if (!Array.isArray(value)) {
      return [_issue(path, "array.base", "Expected array", "array", value)];
    }

    const c = schema.c;
    if (c) {
      if (c.minLength != null && value.length < c.minLength) {
        return [
          _issue(
            path,
            "array.minLength",
            "Expected array length >= " + c.minLength,
            { minLength: c.minLength },
            value
          )
        ];
      }

      if (c.maxLength != null && value.length > c.maxLength) {
        return [
          _issue(
            path,
            "array.maxLength",
            "Expected array length <= " + c.maxLength,
            { maxLength: c.maxLength },
            value
          )
        ];
      }
    }

    let issues = [];
    for (let i = 0; i < value.length; i++) {
      issues = issues.concat(_visit(schema.i, value[i], path + "[" + i + "]"));
    }
    return issues;
  }

  function _visitObject(schema, value, path) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [_issue(path, "object.base", "Expected object", "object", value)];
    }

    let issues = [];
    const keys = Object.keys(schema.s);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      issues = issues.concat(_visit(schema.s[key], value[key], _joinPath(path, key)));
    }

    return issues;
  }

  function _visitUnion(schemaList, value, path) {
    for (let i = 0; i < schemaList.length; i++) {
      const branchIssues = _visit(schemaList[i], value, path);
      if (branchIssues.length === 0) {
        return [];
      }
    }

    return [
      _issue(
        path,
        "union.base",
        "Value did not match any union branch",
        schemaList.map(_describe),
        value
      )
    ];
  }

  function _visit(schema, value, path) {
    if (Array.isArray(schema)) {
      return _visitUnion(schema, value, path);
    }

    if (!schema || typeof schema !== "object") {
      return [_issue(path, "schema.invalid", "Invalid schema", null, schema)];
    }

    switch (schema.k) {
      case "string":
        return _visitString(schema, value, path);
      case "number":
        return _visitNumber(schema, value, path);
      case "boolean":
        return _visitBoolean(value, path);
      case "null":
        return _visitNull(value, path);
      case "literal":
        return _visitLiteral(schema, value, path);
      case "array":
        return _visitArray(schema, value, path);
      case "object":
        return _visitObject(schema, value, path);
      default:
        return [_issue(path, "schema.unknownKind", "Unknown schema kind", schema.k, value)];
    }
  }

  function validate(schema, value) {
    return _visit(schema, value, "$");
  }

  function parse(schema, value) {
    const issues = validate(schema, value);
    if (issues.length > 0) {
      throw new ValidationError(issues);
    }
    return value;
  }

  return {
    ValidationError: ValidationError,
    string: string,
    number: number,
    boolean: boolean,
    null: nil,
    literal: literal,
    array: array,
    object: object,
    optional: optional,
    union: union,
    enums: enums,
    validate: validate,
    parse: parse
  };
}

module.exports = { createMiniValidator };
