import { test } from "node:test";
import assert from "node:assert/strict";
import { gojaTrailer } from "./goja.js";

test("gojaTrailer registers each export on globalThis", () => {
  const out = gojaTrailer({ exports: ["validate", "ping"] });
  assert.match(out, /globalThis\.validate = __zip\.validate;/);
  assert.match(out, /globalThis\.ping = __zip\.ping;/);
});

test("gojaTrailer guards against missing exports at runtime", () => {
  const out = gojaTrailer({ exports: ["validate"] });
  assert.match(out, /typeof __zip\.validate !== "function"/);
});

test("gojaTrailer rejects empty exports", () => {
  assert.throws(() => gojaTrailer({ exports: [] }), /exports is empty/);
});

test("gojaTrailer rejects non-identifier names", () => {
  assert.throws(() => gojaTrailer({ exports: ["foo-bar"] }), /not a valid JS identifier/);
  assert.throws(() => gojaTrailer({ exports: ["1bad"] }), /not a valid JS identifier/);
  assert.throws(() => gojaTrailer({ exports: ["with.dot"] }), /not a valid JS identifier/);
});

test("gojaTrailer accepts dollar and underscore", () => {
  const out = gojaTrailer({ exports: ["$ok", "_internal"] });
  assert.match(out, /globalThis\.\$ok/);
  assert.match(out, /globalThis\._internal/);
});
