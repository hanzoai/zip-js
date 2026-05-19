/**
 * goja codegen — emit the trailer that registers each handler on
 * `globalThis.<export>` so the goja host can find it.
 *
 * The goja host (`base/plugins/gojavm/module.go`) runs the bundle once
 * to populate the global object, then calls `globalThis.<fn>(payload)`
 * for each invocation. Our esbuild output is an ESM/CJS bundle that
 * exports the wrapped handlers; we need to copy those exports onto
 * `globalThis` after the bundle finishes executing.
 *
 * We emit a small JS trailer that the build CLI concatenates after the
 * esbuild output. Keeping it as plain text (not a Function constructor
 * or template) means the runtime bytes are auditable and the goja
 * compile step is a single pass.
 */

/** Manifest fields the goja codegen needs. */
export interface GojaManifest {
  exports: string[];
}

/**
 * Build the trailer that wires each named export onto `globalThis`.
 * The trailer assumes the bundle was wrapped as an IIFE (esbuild
 * `format: "iife"` with `globalName: "__zip"`).
 */
export function gojaTrailer(manifest: GojaManifest): string {
  if (manifest.exports.length === 0) {
    throw new Error("zip-js: manifest.exports is empty — declare at least one handler");
  }

  // Validate names — globals are JS identifiers, no dots / brackets.
  for (const name of manifest.exports) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      throw new Error(`zip-js: export name "${name}" is not a valid JS identifier`);
    }
  }

  const lines: string[] = [];
  lines.push("// zip-js goja trailer: register handlers on globalThis.");
  for (const name of manifest.exports) {
    // The IIFE-wrapped bundle exposes the module's exports at
    // `__zip.<name>`. Copy each requested export onto the global so
    // `globalThis.<name>(payload)` works.
    lines.push(`if (typeof __zip === "undefined" || typeof __zip.${name} !== "function") {`);
    lines.push(`  throw new Error("zip-js: export '${name}' not found in bundle (did you 'export const ${name} = handler(...)'?)");`);
    lines.push(`}`);
    lines.push(`globalThis.${name} = __zip.${name};`);
  }
  return lines.join("\n") + "\n";
}
