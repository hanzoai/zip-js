#!/usr/bin/env node
/**
 * `zip-js build` — compile a typed handler directory to a runtime-ready
 * artifact next to its `extension.json`.
 *
 * Inputs:
 *  - `extension.json` declaring `runtime`, `module`, `exports`.
 *  - `src/index.ts` (or path from `--entry`) exporting one function per
 *    name listed in `exports`.
 *
 * Output: a single bundled JS file written to `module` (resolved
 * relative to the extension directory). For Javy, the JS file is then
 * an input to the upstream JS-to-wasm tool (which the CLI does NOT
 * shell out to today — see runtime/javy.ts).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import * as esbuild from "esbuild";
import { gojaTrailer } from "../runtime/goja.js";
import { javyTrailer } from "../runtime/javy.js";

interface Manifest {
  name: string;
  version: string;
  runtime: string;
  module?: string;
  exports: string[];
}

async function readManifest(dir: string): Promise<Manifest> {
  const p = path.join(dir, "extension.json");
  let text: string;
  try {
    text = await fs.readFile(p, "utf8");
  } catch (err) {
    throw new Error(`zip-js: cannot read ${p}: ${(err as Error).message}`);
  }
  let m: Manifest;
  try {
    m = JSON.parse(text) as Manifest;
  } catch (err) {
    throw new Error(`zip-js: ${p} is not valid JSON: ${(err as Error).message}`);
  }
  if (!m.name) throw new Error(`zip-js: ${p} missing "name"`);
  if (!m.version) throw new Error(`zip-js: ${p} missing "version"`);
  if (!m.runtime) throw new Error(`zip-js: ${p} missing "runtime"`);
  if (!Array.isArray(m.exports) || m.exports.length === 0) {
    throw new Error(`zip-js: ${p} missing "exports" (must be a non-empty array)`);
  }
  return m;
}

interface BuildOptions {
  entry?: string;
  out?: string;
  watch?: boolean;
  minify?: boolean;
}

async function buildExtension(dir: string, opts: BuildOptions): Promise<{ outPath: string; size: number }> {
  const abs = path.resolve(dir);
  const manifest = await readManifest(abs);

  // Default entry: src/index.ts.
  const entry = path.resolve(abs, opts.entry ?? "src/index.ts");
  try {
    await fs.access(entry);
  } catch {
    throw new Error(`zip-js: entry ${entry} does not exist`);
  }

  // Default output: manifest.module, or <name>.js for goja, <name>.bundled.js for javy.
  const defaultOut =
    manifest.module ??
    (manifest.runtime === "wazero" ? `${manifest.name}.bundled.js` : `${manifest.name}.js`);
  const outPath = path.resolve(abs, opts.out ?? defaultOut);

  // Pick the trailer based on the declared runtime. We treat the
  // wazero runtime + JS source as the Javy path; goja takes our
  // goja trailer. v8go can share the goja trailer (same global-thisbinding model).
  let trailer: string;
  switch (manifest.runtime) {
    case "goja":
    case "v8go":
      trailer = gojaTrailer({ exports: manifest.exports });
      break;
    case "wazero":
      // Javy expects exactly one export per wasm module.
      if (manifest.exports.length !== 1) {
        throw new Error(
          `zip-js: wazero (Javy) build needs exactly one export per module; ${manifest.name} declares ${manifest.exports.length}`,
        );
      }
      trailer = javyTrailer({ exports: [manifest.exports[0]] });
      break;
    default:
      throw new Error(`zip-js: runtime "${manifest.runtime}" cannot be built by the JS toolchain`);
  }

  // Bundle. IIFE format with globalName=__zip so the trailer can pick
  // exports off it. esbuild's IIFE wraps as
  // `var __zip = (() => { ... return module.exports; })();`
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    globalName: "__zip",
    platform: "neutral",
    target: ["es2020"],
    minify: opts.minify ?? true,
    write: false,
    treeShaking: true,
    legalComments: "none",
    // Goja and Javy both lack any Node built-ins; refuse to resolve
    // them rather than silently embedding shims.
    external: ["fs", "path", "crypto", "node:*"],
    logLevel: "warning",
  });

  if (result.errors.length > 0) {
    throw new Error("zip-js: esbuild errors:\n" + result.errors.map((e) => e.text).join("\n"));
  }

  const bundle = result.outputFiles[0].text;
  const final = bundle + (bundle.endsWith("\n") ? "" : "\n") + trailer;

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, final, "utf8");
  const { size } = await fs.stat(outPath);
  return { outPath, size };
}

const program = new Command();

program
  .name("zip-js")
  .description("Build a typed TS handler into a runtime-ready zip extension.")
  .version("0.1.0");

program
  .command("build")
  .description("Bundle src/index.ts into the manifest-declared output.")
  .argument("[dir]", "Extension directory (must contain extension.json)", ".")
  .option("-e, --entry <path>", "Entry TS file (default src/index.ts)")
  .option("-o, --out <path>", "Output file (default from manifest.module)")
  .option("--no-minify", "Do not minify output (default minified)")
  .action(async (dir: string, opts: BuildOptions) => {
    try {
      const { outPath, size } = await buildExtension(dir, opts);
      process.stdout.write(`built ${outPath} (${size} bytes)\n`);
    } catch (err) {
      process.stderr.write(`zip-js: ${(err as Error).message}\n`);
      process.exitCode = 1;
    }
  });

// Allow `import { buildExtension }` for the script harness.
export { buildExtension, readManifest };

// Only run if invoked directly (not when imported by the test harness).
const isDirectInvoke = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}` || import.meta.url === fileURLToPath(`file://${process.argv[1]}`);
  } catch {
    return false;
  }
})();

if (isDirectInvoke) {
  program.parseAsync(process.argv).catch((err) => {
    process.stderr.write(`zip-js: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
