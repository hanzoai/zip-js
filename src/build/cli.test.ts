import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { readManifest } from "./cli.js";

test("readManifest rejects missing file", async () => {
  await assert.rejects(() => readManifest("/no/such/path"), /cannot read/);
});

test("readManifest rejects malformed JSON", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zipjs-"));
  await fs.writeFile(path.join(dir, "extension.json"), "{not json");
  await assert.rejects(() => readManifest(dir), /not valid JSON/);
  await fs.rm(dir, { recursive: true });
});

test("readManifest validates required fields", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zipjs-"));
  await fs.writeFile(path.join(dir, "extension.json"), JSON.stringify({}));
  await assert.rejects(() => readManifest(dir), /missing "name"/);
  await fs.writeFile(path.join(dir, "extension.json"), JSON.stringify({ name: "x" }));
  await assert.rejects(() => readManifest(dir), /missing "version"/);
  await fs.writeFile(path.join(dir, "extension.json"), JSON.stringify({ name: "x", version: "0.1.0" }));
  await assert.rejects(() => readManifest(dir), /missing "runtime"/);
  await fs.writeFile(
    path.join(dir, "extension.json"),
    JSON.stringify({ name: "x", version: "0.1.0", runtime: "goja" }),
  );
  await assert.rejects(() => readManifest(dir), /missing "exports"/);
  await fs.rm(dir, { recursive: true });
});

test("readManifest accepts a full manifest", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zipjs-"));
  await fs.writeFile(
    path.join(dir, "extension.json"),
    JSON.stringify({
      name: "x",
      version: "0.1.0",
      runtime: "goja",
      module: "x.js",
      exports: ["fn"],
    }),
  );
  const m = await readManifest(dir);
  assert.equal(m.name, "x");
  assert.deepEqual(m.exports, ["fn"]);
  await fs.rm(dir, { recursive: true });
});

test("built bundle from end-to-end build invocation is runnable", async () => {
  // Pull our example output (built by `npm run examples`) into a fresh
  // V8 context and call the global. This double-checks that the trailer
  // wires up correctly without depending on goja being installed in CI.
  const root = path.resolve(new URL(".", import.meta.url).pathname, "../..");
  const bundlePath = path.join(root, "examples", "hello", "hello.js");
  let source: string;
  try {
    source = await fs.readFile(bundlePath, "utf8");
  } catch {
    // Examples not built — skip rather than fail the unit suite.
    return;
  }
  const ctx = vm.createContext({});
  vm.runInContext(source, ctx, { filename: bundlePath });
  // VM-realm objects have a different prototype than this realm's
  // Object — compare by JSON bytes (which is also what the host does).
  const ok = (ctx as { hello: (p: unknown) => unknown }).hello({ name: "world" });
  assert.equal(JSON.stringify(ok), '{"greeting":"hello, world!"}');
  const err = (ctx as { hello: (p: unknown) => unknown }).hello({});
  assert.equal(JSON.stringify(err), '{"ok":false,"error":"name required"}');
});
