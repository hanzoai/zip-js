#!/usr/bin/env node
/**
 * Verify every built example by loading it into a fresh V8 context
 * (Node's `vm` module) and calling the exported globals exactly the
 * way the production goja host does:
 *
 *   1. Run the script once. Trailer sets `globalThis.<fn>`.
 *   2. Call `globalThis.<fn>(payload)` where payload is a parsed JS
 *      value.
 *   3. JSON.stringify the return. Compare bytes against the canonical
 *      reference output.
 *
 * V8's JSON.stringify and goja's stringify use the same key-insertion
 * order for plain objects, so byte-equivalence holds across both hosts.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const examplesDir = path.resolve(__dirname, "..", "examples");

/** Each row: [example dir, exported fn, payload object, expected JSON string]. */
const cases = [
  ["hello", "hello", { name: "world" }, '{"greeting":"hello, world!"}'],
  ["hello", "hello", { name: "" }, '{"ok":false,"error":"name required"}'],
  ["hello", "hello", {}, '{"ok":false,"error":"name required"}'],

  ["validate-email", "validate", { email: "Foo@Example.COM ", age: 25 }, '{"ok":true,"email":"foo@example.com","age":25}'],
  ["validate-email", "validate", { email: "", age: 25 }, '{"ok":false,"error":"email required"}'],
  ["validate-email", "validate", { email: "a@b.com", age: -1 }, '{"ok":false,"error":"age out of range"}'],
  ["validate-email", "validate", { email: "a@b.com", age: 200 }, '{"ok":false,"error":"age out of range"}'],
  ["validate-email", "validate", { email: "bad", age: 30 }, '{"ok":false,"error":"email shape"}'],
  ["validate-email", "validate", { email: "a@nodot", age: 30 }, '{"ok":false,"error":"email domain"}'],
  ["validate-email", "validate", null, '{"ok":false,"error":"input must be an object"}'],

  ["policy-eval", "evaluate", { subject: "alice", action: "read", resource: "public:docs" }, '{"allow":true,"reason":"public resource"}'],
  ["policy-eval", "evaluate", { subject: "alice", action: "write", resource: "alice:doc1" }, '{"allow":true,"reason":"owner"}'],
  ["policy-eval", "evaluate", { subject: "bob", action: "delete", resource: "alice:doc1" }, '{"allow":false,"reason":"not owner"}'],
  ["policy-eval", "evaluate", { subject: "root", action: "x", resource: "y" }, '{"allow":true,"reason":"admin override"}'],
  ["policy-eval", "evaluate", { subject: "alice", action: "list", resource: "anything" }, '{"allow":false,"reason":"no rule matched"}'],
];

async function loadModule(dir) {
  const manifestText = await fs.readFile(path.join(dir, "extension.json"), "utf8");
  const manifest = JSON.parse(manifestText);
  const modulePath = path.join(dir, manifest.module ?? `${manifest.name}.js`);
  const source = await fs.readFile(modulePath, "utf8");
  return { manifest, source, modulePath };
}

let failures = 0;
let passes = 0;

// Group cases by example so each module is compiled exactly once per
// scenario set — matches the goja host's "one program, many invokes"
// pattern.
const grouped = new Map();
for (const c of cases) {
  const arr = grouped.get(c[0]) ?? [];
  arr.push(c);
  grouped.set(c[0], arr);
}

for (const [example, runs] of grouped) {
  const dir = path.join(examplesDir, example);
  let mod;
  try {
    mod = await loadModule(dir);
  } catch (err) {
    process.stderr.write(`FAIL ${example}: cannot load (${err.message})\n`);
    failures += runs.length;
    continue;
  }
  const context = vm.createContext({});
  try {
    vm.runInContext(mod.source, context, { filename: mod.modulePath });
  } catch (err) {
    process.stderr.write(`FAIL ${example}: bundle threw on load (${err.message})\n`);
    failures += runs.length;
    continue;
  }

  for (const [, fnName, payload, expected] of runs) {
    let result;
    try {
      // Equivalent to `globalThis.<fn>(payload)` inside goja: marshal
      // the payload across the V8/host boundary, call the function,
      // stringify the result.
      const fn = context[fnName];
      if (typeof fn !== "function") {
        throw new Error(`globalThis.${fnName} not set`);
      }
      const out = fn(payload);
      result = JSON.stringify(out);
    } catch (err) {
      process.stderr.write(`FAIL ${example}/${fnName}(${JSON.stringify(payload)}): ${err.message}\n`);
      failures++;
      continue;
    }
    if (result !== expected) {
      process.stderr.write(`FAIL ${example}/${fnName}(${JSON.stringify(payload)})\n  want: ${expected}\n  got:  ${result}\n`);
      failures++;
    } else {
      process.stdout.write(`ok   ${example}/${fnName}(${JSON.stringify(payload)}) = ${result}\n`);
      passes++;
    }
  }
}

process.stdout.write(`\n${passes} passed, ${failures} failed\n`);
process.exit(failures > 0 ? 1 : 0);
