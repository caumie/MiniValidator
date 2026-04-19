/**
 * MiniValidator
 *
 * 小規模な JavaScript 向けのバリデータ生成関数。
 *
 * - createMiniValidator() を呼ぶと、schema builder と検証関数を持つ validator を返す
 * - 主用途は、JSON.parse() 後の値や non-array object が想定した型・制約に合うかの検証
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
 * - v.looseObject(shape)
 * - v.record(keySchema, valueSchema)
 * - v.optional(schema)
 * - v.union(a, b, ...)
 * - v.enums(...literals)
 * - v.validate(schema, value) -> issue 配列を返す
 *
 * 設計方針:
 * - boolean を返すだけではなく、失敗箇所を issues として収集する
 * - issue には path, code, message, expected, actual を持たせる
 * - union は「どれか1つに一致すれば通る」
 * - object は未知キーを拒否し、欠落キーと undefined 値を区別する
 * - object のキー欠落は field schema の最外側が optional の場合だけ許可する
 * - looseObject は schema に定義されたキーだけを検証し、未知キーは無視する
 * - record は各 key と value をそれぞれ schema で検証する
 * - validate は検証のみを行い、入力値の整形・除去・変換は行わない
 * - 内部実装関数は "_" プレフィックスを付け、公開 API と区別する
 *
 * 制限:
 * - transform / default 値 / 非同期検証 は未対応
 * - union の分岐ごとの詳細エラーは返さず、union 全体の不一致として扱う
 * - plain object 判定は行わず、一般的な object 判定に留める
 * - 危険キーの除去や sanitizer 的な処理は行わない
 *
 * 使用例:
 *   const { createMiniValidator } = require("./mini-validator");
 *   const v = createMiniValidator();
 *
 *   // ESM:
 *   // import createMiniValidator from "./mini-validator.js";
 *
 *   const User = v.object({
 *     id: v.union(v.string(), v.number({ integer: true, min: 1 })),
 *     name: v.string({ minLength: 1, maxLength: 20 }),
 *     tags: v.array(v.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
 *     status: v.enums("new", "done")
 *   });
 *
 *   const issues = v.validate(User, data);
 *   if (issues.length > 0) {
 *     console.error(issues);
 *   }
 */

/**
 * Validation issue.
 *
 * @typedef {Object} ValidationIssue
 * @property {string} path
 * @property {string} code
 * @property {string} message
 * @property {any} expected
 * @property {any} actual
 */

function createMiniValidator() {
  /**
   * @typedef {Object} StringConstraints
   * @property {number} [minLength]
   * @property {number} [maxLength]
   * @property {RegExp} [pattern]
   */

  /**
   * @typedef {Object} NumberConstraints
   * @property {number} [min]
   * @property {number} [max]
   * @property {boolean} [integer]
   */

  /**
   * @typedef {Object} ArrayConstraints
   * @property {number} [minLength]
   * @property {number} [maxLength]
   */

  /**
   * @typedef {{ k: "string", c: StringConstraints | null }} StringSchema
   * @typedef {{ k: "number", c: NumberConstraints | null }} NumberSchema
   * @typedef {{ k: "boolean" }} BooleanSchema
   * @typedef {{ k: "null" }} NullSchema
   * @typedef {{ k: "literal", v: any }} LiteralSchema
   * @typedef {{ k: "array", i: Schema, c: ArrayConstraints | null }} ArraySchema
   * @typedef {{ k: "object", s: Record<string, Schema> }} ObjectSchema
   * @typedef {{ k: "looseObject", s: Record<string, Schema> }} LooseObjectSchema
   * @typedef {{ k: "record", ks: Schema, vs: Schema }} RecordSchema
   * @typedef {{ k: "optional", i: Schema }} OptionalSchema
   * @typedef {Schema[]} UnionSchema
   */

  /**
   * 利用可能な schema 全体。
   * union は Schema の配列で表す。
   *
   * @typedef {(
   *   StringSchema |
   *   NumberSchema |
   *   BooleanSchema |
   *   NullSchema |
   *   LiteralSchema |
   *   ArraySchema |
   *   ObjectSchema |
   *   LooseObjectSchema |
   *   RecordSchema |
   *   OptionalSchema |
   *   UnionSchema
   * )} Schema
   */

  /**
   * string schema を作る。
   *
   * @param {StringConstraints} [opts]
   * @returns {StringSchema}
   */
  function string(opts) {
    return { k: "string", c: opts || null };
  }

  /**
   * number schema を作る。
   *
   * @param {NumberConstraints} [opts]
   * @returns {NumberSchema}
   */
  function number(opts) {
    return { k: "number", c: opts || null };
  }

  /**
   * boolean schema を作る。
   *
   * @returns {BooleanSchema}
   */
  function boolean() {
    return { k: "boolean" };
  }

  /**
   * null schema を作る。
   *
   * @returns {NullSchema}
   */
  function nil() {
    return { k: "null" };
  }

  /**
   * literal schema を作る。
   *
   * @template T
   * @param {T} value
   * @returns {{ k: "literal", v: T }}
   */
  function literal(value) {
    return { k: "literal", v: value };
  }

  /**
   * array schema を作る。
   *
   * @param {Schema} item
   * @param {ArrayConstraints} [opts]
   * @returns {ArraySchema}
   */
  function array(item, opts) {
    return { k: "array", i: item, c: opts || null };
  }

  /**
   * strict object schema を作る。
   *
   * - 未知キーを拒否する
   * - 欠落キーと undefined 値を区別する
   *
   * @param {Record<string, Schema>} shape
   * @returns {ObjectSchema}
   */
  function object(shape) {
    return { k: "object", s: shape };
  }

  /**
   * loose object schema を作る。
   *
   * - schema に定義されたキーだけを検証する
   * - 未知キーは無視する
   *
   * @param {Record<string, Schema>} shape
   * @returns {LooseObjectSchema}
   */
  function looseObject(shape) {
    return { k: "looseObject", s: shape };
  }

  /**
   * record schema を作る。
   *
   * - すべてのキーを keySchema で検証する
   * - すべての値を valueSchema で検証する
   *
   * @param {Schema} keySchema
   * @param {Schema} valueSchema
   * @returns {RecordSchema}
   */
  function record(keySchema, valueSchema) {
    return { k: "record", ks: keySchema, vs: valueSchema };
  }

  /**
   * undefined または inner schema を許可する optional schema を作る。
   *
   * object の field schema として最外側に置いた場合だけ、キー欠落も許可する。
   *
   * @param {Schema} inner
   * @returns {OptionalSchema}
   */
  function optional(inner) {
    return { k: "optional", i: inner };
  }

  /**
   * union schema を作る。
   *
   * @param {...Schema} schemas
   * @returns {UnionSchema}
   */
  function union() {
    return Array.prototype.slice.call(arguments);
  }

  /**
   * literal 値の union schema を作る。
   *
   * @param {...any} values
   * @returns {UnionSchema}
   */
  function enums() {
    return Array.prototype.slice.call(arguments).map(literal);
  }

  /**
   * issue を作る。
   *
   * @param {string} path
   * @param {string} code
   * @param {string} message
   * @param {any} expected
   * @param {any} actual
   * @returns {ValidationIssue}
   */
  function _issue(path, code, message, expected, actual) {
    return {
      path: path,
      code: code,
      message: message,
      expected: expected,
      actual: actual
    };
  }

  /**
   * object path を連結する。
   *
   * @param {string} path
   * @param {string} key
   * @returns {string}
   */
  function _joinPath(path, key) {
    return path === "$" ? "$." + key : path + "." + key;
  }

  /**
   * schema の説明文字列を返す。
   *
   * @param {Schema} schema
   * @returns {any}
   */
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
        return "literal(" + String(schema.v) + ")";
      case "array":
        return "array<" + _describe(schema.i) + ">";
      case "object":
        return "object{" + Object.keys(schema.s).join(", ") + "}";
      case "looseObject":
        return "looseObject{" + Object.keys(schema.s).join(", ") + "}";
      case "record":
        return "record<" + _describe(schema.ks) + ", " + _describe(schema.vs) + ">";
      case "optional":
        return "optional<" + _describe(schema.i) + ">";
      default:
        return "unknown";
    }
  }

  /**
   * own property 判定。
   *
   * @param {object} obj
   * @param {string} key
   * @returns {boolean}
   */
  function _hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  /**
   * schema が「キー欠落を許す」かどうかを返す。
   *
   * object の field schema として optional() が最外側にある場合だけ欠落を許可する。
   * union() は値の候補を増やすだけで、キー欠落は許可しない。
   *
   * @param {Schema} schema
   * @returns {boolean}
   */
  function _allowsMissing(schema) {
    return !!schema && typeof schema === "object" && !Array.isArray(schema) && schema.k === "optional";
  }

  /**
   * RegExp を毎回再生成して test する。
   *
   * - /g や /y の state を持ち回らない
   * - schema に入っている RegExp オブジェクトの状態に依存しない
   *
   * @param {RegExp} pattern
   * @param {string} value
   * @returns {boolean}
   */
  function _testPattern(pattern, value) {
    const re = new RegExp(pattern.source, pattern.flags);
    return re.test(value);
  }

  /**
   * @param {StringSchema} schema
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
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

    if (c.pattern != null && !_testPattern(c.pattern, value)) {
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

  /**
   * @param {NumberSchema} schema
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
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

  /**
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
  function _visitBoolean(value, path) {
    if (typeof value !== "boolean") {
      return [_issue(path, "boolean.base", "Expected boolean", "boolean", value)];
    }
    return [];
  }

  /**
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
  function _visitNull(value, path) {
    if (value !== null) {
      return [_issue(path, "null.base", "Expected null", "null", value)];
    }
    return [];
  }

  /**
   * @param {LiteralSchema} schema
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
  function _visitLiteral(schema, value, path) {
    if (value !== schema.v) {
      return [
        _issue(
          path,
          "literal.base",
          "Expected literal " + String(schema.v),
          schema.v,
          value
        )
      ];
    }
    return [];
  }

  /**
   * @param {ArraySchema} schema
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
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

    /** @type {ValidationIssue[]} */
    const issues = [];
    for (let i = 0; i < value.length; i++) {
      const childIssues = _visit(schema.i, value[i], path + "[" + i + "]");
      for (let j = 0; j < childIssues.length; j++) {
        issues.push(childIssues[j]);
      }
    }
    return issues;
  }

  /**
   * strict object を検証する。
   *
   * - 未知キーを拒否する
   * - 欠落キーと undefined 値を区別する
   *
   * @param {ObjectSchema} schema
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
  function _visitObject(schema, value, path) {
    if (!schema || !schema.s) {
      return [_issue(path, "schema.invalid", "Invalid schema", null, schema)];
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [_issue(path, "object.base", "Expected object", "object", value)];
    }

    /** @type {ValidationIssue[]} */
    const issues = [];
    const keys = Object.keys(schema.s);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const childPath = _joinPath(path, key);

      if (!_hasOwn(value, key)) {
        if (!_allowsMissing(schema.s[key])) {
          issues.push(
            _issue(
              childPath,
              "object.missingKey",
              "Expected key to exist",
              { key: key },
              undefined
            )
          );
        }
        continue;
      }

      const childIssues = _visit(schema.s[key], value[key], childPath);
      for (let j = 0; j < childIssues.length; j++) {
        issues.push(childIssues[j]);
      }
    }

    const actualKeys = Object.keys(value);
    for (let i = 0; i < actualKeys.length; i++) {
      const key = actualKeys[i];
      if (_hasOwn(schema.s, key)) {
        continue;
      }

      issues.push(
        _issue(
          _joinPath(path, key),
          "object.unknownKey",
          "Unexpected key",
          keys,
          key
        )
      );
    }

    return issues;
  }

  /**
   * loose object を検証する。
   *
   * - schema に定義されたキーだけ検証する
   * - 未知キーは無視する
   * - 欠落と undefined を厳密には区別しない
   *
   * @param {LooseObjectSchema} schema
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
  function _visitLooseObject(schema, value, path) {
    if (!schema || !schema.s) {
      return [_issue(path, "schema.invalid", "Invalid schema", null, schema)];
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [_issue(path, "object.base", "Expected object", "object", value)];
    }

    /** @type {ValidationIssue[]} */
    const issues = [];
    const keys = Object.keys(schema.s);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const childIssues = _visit(schema.s[key], value[key], _joinPath(path, key));
      for (let j = 0; j < childIssues.length; j++) {
        issues.push(childIssues[j]);
      }
    }

    return issues;
  }

  /**
   * record を検証する。
   *
   * - 各キーを keySchema で検証する
   * - 各値を valueSchema で検証する
   * - キー側の失敗は path をルートのまま返す
   *
   * @param {RecordSchema} schema
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
  function _visitRecord(schema, value, path) {
    if (!schema || !schema.ks || !schema.vs) {
      return [_issue(path, "schema.invalid", "Invalid schema", null, schema)];
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [_issue(path, "record.base", "Expected record", "record", value)];
    }

    /** @type {ValidationIssue[]} */
    const issues = [];
    const keys = Object.keys(value);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const childPath = _joinPath(path, key);

      const keyIssues = _visit(schema.ks, key, path);
      for (let j = 0; j < keyIssues.length; j++) {
        issues.push(keyIssues[j]);
      }

      const valueIssues = _visit(schema.vs, value[key], childPath);
      for (let j = 0; j < valueIssues.length; j++) {
        issues.push(valueIssues[j]);
      }
    }

    return issues;
  }

  /**
   * union を検証する。
   *
   * - どれか1枝に一致すれば成功
   * - 全枝不一致なら union.base を1件返す
   *
   * @param {UnionSchema} schemaList
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
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

  /**
   * optional を検証する。
   *
   * - 値としての undefined を許可する
   * - undefined でなければ inner schema を検証する
   * - object のキー欠落許可は _allowsMissing() で別に扱う
   *
   * @param {OptionalSchema} schema
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
  function _visitOptional(schema, value, path) {
    if (value === undefined) {
      return [];
    }

    /** @type {ValidationIssue[]} */
    const issues = [];

    const innerIssues = _visit(schema.i, value, path);
    if (innerIssues.length === 0) {
      return [];
    }

    for (let i = 0; i < innerIssues.length; i++) {
      issues.push(innerIssues[i]);
    }

    issues.push(
      _issue(
        path,
        "optional.base",
        "Value did not match optional schema",
        ["undefined", _describe(schema.i)],
        value
      )
    );

    return issues;
  }

  /**
   * schema と値を再帰的に検証する。
   *
   * @param {Schema} schema
   * @param {any} value
   * @param {string} path
   * @returns {ValidationIssue[]}
   */
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
      case "looseObject":
        return _visitLooseObject(schema, value, path);
      case "record":
        return _visitRecord(schema, value, path);
      case "optional":
        return _visitOptional(schema, value, path);
      default:
        return [_issue(path, "schema.unknownKind", "Unknown schema kind", schema.k, value)];
    }
  }

  /**
   * 値を schema に照らして検証し、issue 配列を返す。
   *
   * - 成功時は空配列を返す
   * - 失敗時は 1 件以上の issue を返す
   * - 入力値の整形や除去は行わない
   *
   * @param {Schema} schema
   * @param {any} value
   * @returns {ValidationIssue[]}
   */
  function validate(schema, value) {
    return _visit(schema, value, "$");
  }

  return {
    string: string,
    number: number,
    boolean: boolean,
    null: nil,
    literal: literal,
    array: array,
    object: object,
    looseObject: looseObject,
    record: record,
    optional: optional,
    union: union,
    enums: enums,
    validate: validate
  };
}

module.exports = createMiniValidator;
module.exports.createMiniValidator = createMiniValidator;
module.exports.default = createMiniValidator;
