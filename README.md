# MiniValidator

Tiny single-file runtime validator for plain JavaScript data.

MiniValidator は、手で持ち込める 1 ファイルの runtime validator です。
npm package、build step、TypeScript 環境を前提にしません。
`mini-validator.js` をプロジェクトに置けば、Node.js だけで使えます。

> Validation without adopting a validation ecosystem.

## What It Is

MiniValidator は、主に `JSON.parse()` 後の plain data や設定値を検証するための小さなライブラリです。
大きな schema ecosystem が欲しいのではなく、次のようなものが欲しいときに使います。

- 依存なし
- build step なし
- TypeScript 前提なし
- 何をしているか全部読める
- 必要なら自分の用途に合わせて直せる
- JSON や設定データの runtime validation だけ欲しい

MiniValidator は Zod、Ajv、Yup の置き換えを目指すものではありません。
型推論、JSON Schema 連携、transform、default 値、async validation などを必要とする場合は、
それらの専用ライブラリの方が向いています。

## Features

- 依存なし
- 1 ファイル
- CommonJS / ES Modules から利用可能
- `validate()` は boolean ではなく issue 配列を返す
- `string`, `number`, `boolean`, `null`, `literal` をサポート
- `array`, `object`, `looseObject`, `record` をサポート
- `optional`, `union`, `enums` をサポート
- 入力値を変換、削除、補完しない

## Install

npm install は不要です。
このリポジトリの `mini-validator.js` を利用するプロジェクトに配置して使います。

CommonJS:

```js
const { createMiniValidator } = require("./mini-validator");
```

CommonJS default style:

```js
const createMiniValidator = require("./mini-validator");
```

ES Modules:

```js
import createMiniValidator from "./mini-validator.js";
```

## Quick Start

```js
const { createMiniValidator } = require("./mini-validator");

const v = createMiniValidator();

const User = v.object({
  id: v.union(v.string(), v.number({ integer: true, min: 1 })),
  name: v.string({ minLength: 1, maxLength: 20 }),
  tags: v.array(v.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
  status: v.enums("new", "done"),
  memo: v.optional(v.string({ maxLength: 200 })),
});

const issues = v.validate(User, {
  id: false,
  name: "",
  tags: [],
  status: "hold",
});

if (issues.length > 0) {
  console.error(issues);
}
```

```js
[
  {
    path: "$.id",
    code: "union.base",
    message: "Value did not match any union branch",
    expected: ["string", "number"],
    actual: false
  },
  {
    path: "$.name",
    code: "string.minLength",
    message: "Expected string length >= 1",
    expected: { minLength: 1 },
    actual: ""
  },
  {
    path: "$.tags",
    code: "array.minLength",
    message: "Expected array length >= 1",
    expected: { minLength: 1 },
    actual: []
  }
]
```

---

## Usage

```js
const { createMiniValidator } = require("./mini-validator");
const v = createMiniValidator();
```

```js
const Config = v.object({
  host: v.string({ minLength: 1 }),
  port: v.number({ integer: true, min: 1, max: 65535 }),
  debug: v.optional(v.boolean()),
});
```

```js
const issues = v.validate(Config, input);
```

`validate(schema, value)` は issue 配列を返します。
成功時は `[]`、失敗時は 1 件以上の issue です。

---

## Schema API

### `v.string(options?)`

```js
v.string()
v.string({ minLength: 1 })
v.string({ maxLength: 20 })
v.string({ pattern: /^[A-Z]{3}\d{2}$/ })
```

文字列を検証します。
フォーム値、設定名、ID、短いテキストなどに使います。

Options:

* `minLength`: 文字列長の下限
* `maxLength`: 文字列長の上限
* `pattern`: `RegExp` による一致条件

Notes:

* `pattern` は呼び出し側が安全な `RegExp` を渡してください。
* global / sticky flag 付きの `RegExp` でも、元の `lastIndex` に依存しないように検証します。

### `v.number(options?)`

```js
v.number()
v.number({ min: 0, max: 100 })
v.number({ integer: true, min: 1 })
```

数値を検証します。
設定値、件数、範囲指定、ポート番号などに使います。

Options:

* `min`: 数値の下限
* `max`: 数値の上限
* `integer`: `true` の場合は整数だけを許可

Notes:

* `NaN` は拒否します。
* 現在の実装では `Infinity` / `-Infinity` は JavaScript の number として扱います。
* `min`, `max` などの制約値は、呼び出し側が妥当な値を渡してください。

### `v.boolean()`

```js
v.boolean()
```

`true` または `false` だけを許可します。
`0`, `1`, `"true"` などへの変換は行いません。

### `v.null()`

```js
v.null()
```

`null` だけを許可します。
`undefined` は許可しません。

### `v.literal(value)`

```js
v.literal("new")
v.literal(0)
v.literal(false)
```

指定した値と厳密等価 (`===`) の値だけを許可します。
固定値、タグ、状態値などに使います。

### `v.array(itemSchema, options?)`

```js
v.array(v.string())
v.array(v.string(), { minLength: 1, maxLength: 10 })
```

配列を検証し、各要素を `itemSchema` で検証します。
リスト、タグ配列、複数アイテムの設定などに使います。

Options:

* `minLength`: 配列長の下限
* `maxLength`: 配列長の上限

Notes:

* 配列長の制約に失敗した場合は、要素ごとの検証に進まず、その配列自体の issue を返します。
* 要素の issue は `$.items[0]` のような path になります。

### `v.object(shape)`

```js
v.object({
  name: v.string(),
  age: v.number(),
})
```

non-array object を検証します。
shape に定義された key を検証し、unknown key は拒否します。

Use when:

* 入力 object の構造を固定したい
* 余計な key を受け取りたくない
* 欠落 key と `undefined` 値を区別したい

Behavior:

* shape にない own enumerable string key は `object.unknownKey`
* 必須 key が存在しない場合は `object.missingKey`
* key が存在して値が `undefined` の場合は、その field schema で検証
* key 欠落を許可するには、その field schema の最外側に `v.optional(...)` を置く

```js
const User = v.object({
  name: v.string(),
  memo: v.optional(v.string()),
});

v.validate(User, { name: "Alice" }); // []
v.validate(User, { name: "Alice", extra: 1 }); // object.unknownKey
```

### `v.looseObject(shape)`

```js
v.looseObject({
  name: v.string(),
  age: v.number(),
})
```

non-array object を検証します。
shape に定義された key だけを検証し、unknown key は無視します。

Use when:

* 大きな object の一部だけを検証したい
* 外部 API response の必要な key だけを確認したい
* unknown key をエラーにしたくない

Behavior:

* shape にない key は検証しません。
* shape にある key は、値が `undefined` でも field schema で検証します。
* missing key と `undefined` 値は厳密には区別しません。
* `v.optional(...)` を使うと、missing key / `undefined` を許可できます。

### `v.record(keySchema, valueSchema)`

```js
v.record(
  v.string({ pattern: /^[a-z]+$/ }),
  v.number()
)
```

object の own enumerable string key と、その値を検証します。
辞書、map 風 object、任意 key の設定値などに使います。

Behavior:

* 各 key を `keySchema` で検証します。
* 各 value を `valueSchema` で検証します。
* inherited property は検証対象にしません。
* symbol key と non-enumerable key は検証対象にしません。
* array は record として扱わず、`record.base` になります。

### `v.optional(schema)`

```js
v.optional(v.string())
v.optional(v.union(v.number(), v.string()))
```

`undefined` または inner schema に合う値を許可します。
`object()` の field schema の最外側に置いた場合だけ、その key の欠落も許可します。

Use when:

* 値として `undefined` を許可したい
* `object()` の key を任意項目にしたい

```js
const User = v.object({
  name: v.string(),
  memo: v.optional(v.string()),
});

v.validate(User, { name: "Alice" }); // []
v.validate(User, { name: "Alice", memo: undefined }); // []
```

Important:

```js
v.object({
  x: v.optional(v.union(v.number(), v.string())),
});
```

この場合、`x` は欠落していても通ります。

```js
v.object({
  x: v.union(v.number(), v.optional(v.string())),
});
```

この場合、`x` が存在すれば `number` / `string` / `undefined` を許可します。
ただし `optional()` が field schema の最外側ではないため、`x` の欠落は `object.missingKey` になります。

Error behavior:

* `undefined` は成功します。
* inner schema が失敗した場合は、inner issue を返します。
* その後に `optional.base` も返します。

### `v.union(...schemas)`

```js
v.union(v.string(), v.number())
v.union(v.literal("new"), v.literal("done"))
```

複数 schema のうち、どれか 1 つに合えば成功します。
値の候補を増やしたいときに使います。

Use when:

* string または number を許可したい
* 複数の literal 値を許可したい
* object または array のような複数形状を許可したい

Behavior:

* どれか 1 branch が成功すれば `[]`
* 全 branch が失敗した場合は `union.base` を 1 件返します。
* branch ごとの詳細 issue は返しません。
* `union()` は `object()` の key 欠落を許可しません。

```js
const Schema = v.object({
  x: v.union(v.number(), v.literal(undefined)),
});

v.validate(Schema, { x: undefined }); // []
v.validate(Schema, {}); // object.missingKey
```

### `v.enums(...values)`

```js
v.enums("new", "done", "hold")
```

`literal()` の union を簡単に書くための sugar です。

```js
v.enums("new", "done")
```

is equivalent to:

```js
v.union(v.literal("new"), v.literal("done"))
```

状態値、種別、固定文字列の候補などに使います。

---

## Return Values

### `v.validate(schema, value)`

issue の配列を返します。

* 成功: `[]`
* 失敗: `[issue, issue, ...]`

MiniValidator は `parse()` を提供しません。
成功時に値を返したり、失敗時に例外を投げたり、入力を変換したりしないためです。

## Issue Shape

```js
{
  path: "$.user.name",
  code: "string.minLength",
  message: "Expected string length >= 1",
  expected: { minLength: 1 },
  actual: ""
}
```

### Fields

* `path`: 失敗箇所
* `code`: エラー種別
* `message`: エラー内容
* `expected`: 期待値または期待条件
* `actual`: 実際の値

---

## Path Format

* ルート: `$`
* オブジェクト: `$.user.name`
* 配列: `$.items[0]`
* ネスト: `$.users[1].name`

`path` は人間向け表示です。
クエリ言語、JSON Pointer、ファイルパスとして再利用することは想定していません。

---

## Responsibility Boundary

MiniValidator は、信頼済みコードで定義した schema を使って plain data を検証するための道具です。
sanitizer、sandbox、schema firewall、error redaction layer ではありません。

### Library responsibilities

* 入力値を変換、削除、補完しない
* 検証中に入力値や `Object.prototype` を変更しない
* `object()` と `looseObject()` の unknown key 方針を分ける
* object / record では own enumerable string key を検証対象にする
* inherited property を required key の代わりとして扱わない
* global / sticky `RegExp` の `lastIndex` に依存しない

### Caller responsibilities

* schema をユーザー入力から生成しない
* `pattern` には安全な `RegExp` だけを渡す
* `minLength`, `maxLength`, `min`, `max` などの制約値を妥当な値にする
* validation 対象は JSON 由来の plain data に寄せる
* accessor property、Proxy、class instance など副作用を持つ object を渡さない
* issue の `message`, `expected`, `actual` を外部ユーザーに返す前に、必要ならマスクする

### Out of scope

* transform
* default 値
* async validation
* TypeScript の高度な型推論
* JSON Schema 生成
* OpenAPI 連携
* ReDoS 完全防御
* 任意の JavaScript object を副作用なしに検証すること

---

## Examples

### Config file

```js
const Config = v.object({
  host: v.string({ minLength: 1 }),
  port: v.number({ integer: true, min: 1, max: 65535 }),
  logLevel: v.enums("debug", "info", "warn", "error"),
  cacheDir: v.optional(v.string({ minLength: 1 })),
});
```

### Nested object

```js
const Schema = v.object({
  user: v.object({
    name: v.string({ minLength: 1 }),
    age: v.number({ integer: true, min: 0 }),
  }),
});
```

### Array of objects

```js
const Schema = v.array(
  v.object({
    id: v.number({ integer: true, min: 1 }),
    name: v.string({ minLength: 1 }),
  }),
  { minLength: 1 }
);
```

### Partial external response

```js
const Response = v.looseObject({
  id: v.string(),
  status: v.enums("queued", "running", "done"),
});
```

### Record-like object

```js
const Scores = v.record(
  v.string({ pattern: /^[a-z]+$/ }),
  v.number({ min: 0 })
);
```

---

## Testing

Node.js 標準の `node:test` を使っています。

```bash
node --test
```

テストは責務ごとに分割しています。

* `mini-validator.api.test.js`
* `mini-validator.primitives.test.js`
* `mini-validator.array.test.js`
* `mini-validator.object.test.js`
* `mini-validator.loose-object.test.js`
* `mini-validator.record.test.js`
* `mini-validator.union-optional.test.js`
* `mini-validator.security.test.js`

---

## License

MIT
