/**
 * Javy codegen — emit the stdin/stdout glue the upstream JS-to-wasm
 * compiler expects.
 *
 * Upstream tool reads the JSON payload from FD 0 and writes the JSON
 * result to FD 1. Our trailer wires the named export through that
 * convention so the same handler source compiles to either goja or
 * wasm without per-runtime branching in user code.
 *
 * Status: the wasm host shim that adapts the FD-based ABI to the
 * HIP-0105 pointer/len ABI is not yet shipped. Code emitted here is
 * compile-ready against the upstream tool, but the resulting wasm
 * module won't load in the `wasmvm` runtime until that shim lands.
 * Tracked in `base/plugins/extbench/fixtures/wazero-javy/TODO.md`.
 */

export interface JavyManifest {
  /** Exactly one export per Javy module — the upstream tool conflates
   * the module with its `_start` entry. To export multiple functions,
   * compile one wasm per handler. */
  exports: [string];
}

/**
 * Build the trailer that reads JSON from stdin, runs the named export,
 * writes JSON to stdout. Mirrors the upstream "JS-to-wasm" sample.
 *
 * The trailer assumes the bundle was wrapped as an IIFE with
 * `globalName: "__zip"` (same convention as the goja trailer for
 * orthogonality).
 */
export function javyTrailer(manifest: JavyManifest): string {
  const [name] = manifest.exports;
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
    throw new Error(`zip-js: export name "${name}" is not a valid JS identifier`);
  }

  const lines: string[] = [];
  lines.push("// zip-js javy trailer: stdin -> handler -> stdout.");
  lines.push("(function () {");
  // Read entire stdin. The upstream runtime exposes a small `Javy.IO`
  // surface; we'd assume that's mounted. Without it (i.e. running the
  // emitted bundle in Node for tests) we no-op so the import doesn't
  // crash.
  lines.push("  var io = globalThis.Javy && globalThis.Javy.IO;");
  lines.push("  if (!io) return; // Not running inside the JS-to-wasm host.");
  lines.push("  var chunkSize = 1024;");
  lines.push("  var buffer = new Uint8Array(chunkSize);");
  lines.push("  var bytesRead = 0;");
  lines.push("  while (true) {");
  lines.push("    var grow = new Uint8Array(buffer.length + chunkSize);");
  lines.push("    grow.set(buffer);");
  lines.push("    buffer = grow;");
  lines.push("    var n = io.readSync(0, buffer.subarray(bytesRead));");
  lines.push("    bytesRead += n;");
  lines.push("    if (n < chunkSize) break;");
  lines.push("  }");
  lines.push("  var input = buffer.subarray(0, bytesRead);");
  lines.push("  var payload = JSON.parse(new TextDecoder().decode(input));");
  lines.push(`  if (typeof __zip === "undefined" || typeof __zip.${name} !== "function") {`);
  lines.push(`    throw new Error("zip-js: export '${name}' not found in bundle");`);
  lines.push("  }");
  lines.push(`  var result = __zip.${name}(payload);`);
  lines.push("  var output = new TextEncoder().encode(JSON.stringify(result));");
  lines.push("  io.writeSync(1, output);");
  lines.push("})();");
  return lines.join("\n") + "\n";
}
