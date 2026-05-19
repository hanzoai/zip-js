#!/usr/bin/env node
/**
 * Build one example directory using the compiled CLI in dist/.
 *
 * Usage: node scripts/build-example.mjs <example-dir>
 *
 * This script is what each example's `npm run build` shells out to.
 * It uses esbuild directly (rather than the published CLI) so that
 * the example build never depends on a published npm tarball — the
 * SDK source is resolved via a path alias to `../../src`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";
import * as esbuild from "esbuild";
import { gojaTrailer } from "../dist/runtime/goja.js";
import { javyTrailer } from "../dist/runtime/javy.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

async function readManifest(dir) {
  const text = await fs.readFile(path.join(dir, "extension.json"), "utf8");
  return JSON.parse(text);
}

async function buildOne(dir) {
  const abs = path.resolve(dir);
  const manifest = await readManifest(abs);
  const entry = path.join(abs, "src", "index.ts");

  const out =
    manifest.module ??
    (manifest.runtime === "wazero" ? `${manifest.name}.bundled.js` : `${manifest.name}.js`);
  const outPath = path.join(abs, out);

  let trailer;
  switch (manifest.runtime) {
    case "goja":
    case "v8go":
      trailer = gojaTrailer({ exports: manifest.exports });
      break;
    case "wazero":
      if (manifest.exports.length !== 1) {
        throw new Error(`wazero (Javy) build needs exactly one export; ${manifest.name} has ${manifest.exports.length}`);
      }
      trailer = javyTrailer({ exports: [manifest.exports[0]] });
      break;
    default:
      throw new Error(`runtime "${manifest.runtime}" cannot be built by the JS toolchain`);
  }

  // Resolve `@hanzo/zip` to the repo's compiled dist so examples never
  // depend on a published npm tarball. This is the "monorepo path alias"
  // pattern.
  const sdkAlias = path.join(repoRoot, "dist", "index.js");

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    globalName: "__zip",
    platform: "neutral",
    target: ["es2020"],
    minify: true,
    write: false,
    treeShaking: true,
    legalComments: "none",
    alias: {
      "@hanzo/zip": sdkAlias,
    },
    logLevel: "warning",
  });

  if (result.errors.length > 0) {
    throw new Error("esbuild errors:\n" + result.errors.map((e) => e.text).join("\n"));
  }

  const bundle = result.outputFiles[0].text;
  const final = bundle + (bundle.endsWith("\n") ? "" : "\n") + trailer;
  await fs.writeFile(outPath, final, "utf8");
  const { size } = await fs.stat(outPath);
  process.stdout.write(`built ${path.relative(process.cwd(), outPath)} (${size} bytes)\n`);
}

const dir = process.argv[2] ?? ".";
buildOne(dir).catch((err) => {
  process.stderr.write(`build-example: ${err.message}\n`);
  process.exit(1);
});
