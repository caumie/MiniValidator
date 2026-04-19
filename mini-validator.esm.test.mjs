import test from "node:test";
import assert from "node:assert/strict";

import createMiniValidator from "./mini-validator.js";

test("ESM default import can use MiniValidator", () => {
  const v = createMiniValidator();

  assert.equal(createMiniValidator.createMiniValidator, createMiniValidator);
  assert.equal(createMiniValidator.default, createMiniValidator);
  assert.equal(createMiniValidator.ValidationError, undefined);
  assert.deepEqual(v.validate(v.string(), "ok"), []);
});
