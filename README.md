# MiniValidator

Tiny runtime validator for JavaScript.

依存なし・1ファイル・Node向けの小さなバリデータです。  
`JSON.parse()` 後の値や plain object を、手元で読める小ささのまま検証できます。

> Small enough to read.  
> Useful enough to ship.

- 依存なし
- 1ファイル
- `createValidator()` で生成
- `validate()` で issue 配列を取得
- `parse()` で `ValidationError` を投げる
- `string / number / boolean / null / literal / array / object / union / optional / enums` をサポート

---

## Quick Start

```js
const { createValidator } = require("./validator");

const v = createValidator();

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

console.log(issues);
````

---

## Why

大きな validator ライブラリが欲しいのではなく、次のようなものが欲しいときのための実装です。

* 自分で読める
* 自分で直せる
* 小さい
* 外部依存を増やしたくない
* JSON や設定データの runtime validation だけ欲しい

つまり、これは **高機能な schema ecosystem** ではなく、
**掌握可能な最小 validator** です。

---

## Features

* **runtime validation**
* **issue 配列で失敗理由を返す**
* **失敗箇所を path で返す**
* **union / optional / enums をサポート**
* **文字列長 / 数値範囲 / 配列長の制約**
* **Node.js 標準だけでテスト可能**

---

## Install

このリポジトリの `validator.js` をそのまま配置して使います。

```js
const { createValidator } = require("./validator");
```

npm パッケージ前提ではなく、**そのまま持ち込んで使う** ことを想定しています。

---

## Usage

### 1. validator を作る

```js
const { createValidator } = require("./validator");
const v = createValidator();
```

### 2. schema を定義する

```js
const User = v.object({
  id: v.union(v.string(), v.number({ integer: true, min: 1 })),
  name: v.string({ minLength: 1, maxLength: 20 }),
  age: v.number({ integer: true, min: 0, max: 120 }),
  tags: v.array(v.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
  status: v.enums("new", "done"),
  memo: v.optional(v.string({ maxLength: 200 })),
});
```

### 3. validate() を使う

`validate(schema, value)` は issue 配列を返します。

```js
const issues = v.validate(User, input);

if (issues.length > 0) {
  console.error(issues);
}
```

### 4. parse() を使う

`parse(schema, value)` は、妥当なら値を返し、不正なら `ValidationError` を投げます。

```js
try {
  const user = v.parse(User, input);
  console.log(user);
} catch (err) {
  if (err instanceof v.ValidationError) {
    console.error(err.issues);
  } else {
    throw err;
  }
}
```

---

## Example Issues

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

## Schema API

### Primitive

#### `v.string(options?)`

```js
v.string()
v.string({ minLength: 1, maxLength: 20 })
v.string({ pattern: /^[A-Z]{3}\d{2}$/ })
```

Options:

* `minLength`
* `maxLength`
* `pattern`

#### `v.number(options?)`

```js
v.number()
v.number({ min: 0, max: 100 })
v.number({ integer: true, min: 1 })
```

Options:

* `min`
* `max`
* `integer`

#### `v.boolean()`

```js
v.boolean()
```

#### `v.null()`

```js
v.null()
```

#### `v.literal(value)`

```js
v.literal("new")
v.literal(0)
v.literal(false)
```

---

### Composite

#### `v.array(itemSchema, options?)`

```js
v.array(v.string())
v.array(v.string(), { minLength: 1, maxLength: 10 })
```

Options:

* `minLength`
* `maxLength`

#### `v.object(shape)`

```js
v.object({
  name: v.string(),
  age: v.number(),
})
```

#### `v.union(...schemas)`

```js
v.union(v.string(), v.number())
```

#### `v.optional(schema)`

```js
v.optional(v.string())
```

`undefined` または指定 schema を許可します。

#### `v.enums(...values)`

```js
v.enums("new", "done", "hold")
```

`literal()` の union を簡単に書くための sugar です。

---

## Return Values

### `v.validate(schema, value)`

issue の配列を返します。

* 成功: `[]`
* 失敗: `[issue, issue, ...]`

### `v.parse(schema, value)`

* 成功: `value`
* 失敗: `throw new ValidationError(issues)`

---

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

---

## Behavior Notes

### unknown key は無視されます

```js
const schema = v.object({
  name: v.string(),
});

v.validate(schema, {
  name: "Alice",
  extra: 123,
}); // []
```

### `optional()` は `undefined` を許可します

```js
const schema = v.object({
  name: v.string(),
  memo: v.optional(v.string()),
});
```

`memo` が欠落していても通ります。

### union の詳細分岐エラーは返しません

union は「どれにも一致しなかった」という 1 件の issue を返します。

---

## More Examples

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
    id: v.number(),
    name: v.string({ minLength: 1 }),
  }),
  { minLength: 1 }
);
```

### Optional field

```js
const Schema = v.object({
  name: v.string(),
  memo: v.optional(v.string({ maxLength: 200 })),
});
```

### Enum-like values

```js
const Schema = v.object({
  status: v.enums("new", "done", "hold"),
});
```

---

## Limitations

このライブラリは intentionally small です。
次の機能は未対応です。

* transform
* default 値
* async validation
* strict object
* unknown key の拒否
* union 各枝の詳細 issue
* discriminated union 専用最適化
* TypeScript の高度な型推論機能

---

## Design Goals

* 小さいこと
* 依存がないこと
* コードを自分で読めること
* 必要なら自分で直せること
* runtime validation に絞ること
* boolean ではなく issue 配列を返すこと

---

## Testing

Node.js 標準の `node:test` を使っています。

```bash
node --test
```

テストは責務ごとに分割しています。

* `validator.core.test.js`
* `validator.object-array.test.js`
* `validator.union-optional.test.js`

---

## License

MIT

