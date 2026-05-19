#!/usr/bin/env node
/**
 * Build every example in `examples/`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawn } from "node:child_process";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const examplesDir = path.resolve(__dirname, "..", "examples");
const buildOne = path.resolve(__dirname, "build-example.mjs");

async function listExamples() {
  const entries = await fs.readdir(examplesDir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const full = path.join(examplesDir, e.name);
    try {
      await fs.access(path.join(full, "extension.json"));
      out.push(full);
    } catch {
      // Not an example dir.
    }
  }
  out.sort();
  return out;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });
}

const examples = await listExamples();
for (const dir of examples) {
  await run(process.execPath, [buildOne, dir]);
}
