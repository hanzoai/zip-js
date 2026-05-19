import { test } from "node:test";
import assert from "node:assert/strict";
import { javyTrailer } from "./javy.js";

test("javyTrailer wires stdin -> handler -> stdout", () => {
  const out = javyTrailer({ exports: ["validate"] });
  assert.match(out, /Javy\.IO/);
  assert.match(out, /readSync\(0/);
  assert.match(out, /writeSync\(1/);
  assert.match(out, /__zip\.validate\(payload\)/);
});

test("javyTrailer no-ops outside a Javy host", () => {
  const out = javyTrailer({ exports: ["validate"] });
  assert.match(out, /if \(!io\) return;/);
});

test("javyTrailer rejects bad identifier", () => {
  assert.throws(
    () => javyTrailer({ exports: ["bad-name"] as unknown as [string] }),
    /not a valid JS identifier/,
  );
});
