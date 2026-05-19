/**
 * Unit tests for the handler wrapper.
 *
 * The wrapper is tested by calling it the same way the host does —
 * give it a parsed JSON value, inspect the return.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "./handler.js";
import { ZipError } from "./error.js";

interface Req {
  email: string;
  age: number;
}

interface Res {
  ok: boolean;
  email: string;
  age: number;
}

test("handler returns user value verbatim on success", () => {
  const fn = handler<Req, Res>((req) => ({
    ok: true,
    email: req.email.toLowerCase(),
    age: req.age,
  }));
  const out = fn({ email: "A@B.COM", age: 30 });
  assert.deepEqual(out, { ok: true, email: "a@b.com", age: 30 });
});

test("handler catches sync throws into canonical error envelope", () => {
  const fn = handler<{ x: number }, { y: number }>((req) => {
    if (req.x < 0) throw new ZipError("x must be non-negative", 400);
    return { y: req.x * 2 };
  });
  const out = fn({ x: -1 });
  assert.deepEqual(out, { ok: false, error: "x must be non-negative" });
});

test("handler accepts plain Error throws", () => {
  const fn = handler<unknown, unknown>(() => {
    throw new Error("boom");
  });
  const out = fn({});
  assert.deepEqual(out, { ok: false, error: "boom" });
});

test("handler accepts thrown strings", () => {
  const fn = handler<unknown, unknown>(() => {
    throw "raw string error";
  });
  const out = fn({});
  assert.deepEqual(out, { ok: false, error: "raw string error" });
});

test("handler stringifies thrown non-Error objects", () => {
  const fn = handler<unknown, unknown>(() => {
    throw { code: "EBAD", reason: "x" };
  });
  const out = fn({});
  assert.deepEqual(out, { ok: false, error: '{"code":"EBAD","reason":"x"}' });
});

test("handler refuses Promise-returning functions (async constraint)", () => {
  const fn = handler<unknown, unknown>(() => {
    return Promise.resolve({ ok: true }) as unknown as { ok: true };
  });
  const out = fn({});
  assert.match((out as { error: string }).error, /handler returned a Promise/);
});

test("handler preserves key insertion order for success envelope", () => {
  const fn = handler<unknown, { ok: true; email: string; age: number }>(() => ({
    ok: true,
    email: "x@y.z",
    age: 25,
  }));
  const out = fn({}) as { ok: true; email: string; age: number };
  // JSON.stringify preserves insertion order in V8 / goja for
  // string-keyed plain objects. Verify byte order matches the
  // canonical fixture shape.
  assert.equal(JSON.stringify(out), '{"ok":true,"email":"x@y.z","age":25}');
});

test("handler emits error envelope with ok before error (byte order)", () => {
  const fn = handler<unknown, unknown>(() => {
    throw new ZipError("email shape", 400);
  });
  const out = fn({});
  assert.equal(JSON.stringify(out), '{"ok":false,"error":"email shape"}');
});

test("ZipError carries status", () => {
  const e = new ZipError("not allowed", 403);
  assert.equal(e.message, "not allowed");
  assert.equal(e.status, 403);
  assert.equal(e.name, "ZipError");
});

test("ZipError defaults status to 500", () => {
  const e = new ZipError("oops");
  assert.equal(e.status, 500);
});
