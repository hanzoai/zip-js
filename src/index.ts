/**
 * @hanzo/zip — TypeScript SDK for HIP-0105 in-process extensions.
 *
 * Write a typed handler:
 *
 * ```ts
 * import { handler, ZipError } from "@hanzo/zip";
 *
 * interface Req { email: string; age: number }
 * interface Res { ok: true; email: string; age: number }
 *
 * export const validate = handler<Req, Res>((req) => {
 *   if (!req.email) throw new ZipError("email required", 400);
 *   return { ok: true, email: req.email.trim().toLowerCase(), age: req.age };
 * });
 * ```
 *
 * Build it (`zip-js build`) and drop the resulting `.js` next to an
 * `extension.json` with `"runtime": "goja"`. The Hanzo Base / zip
 * host loads it without any per-extension Go code.
 *
 * See HIP-0105 for the full runtime contract.
 */

export { handler, type HandlerFn, type WireHandler } from "./handler.js";
export { ZipError, errorEnvelope, messageOf, type ErrorEnvelope } from "./error.js";
export type { RouteEnvelope, RouteResponse } from "./envelope.js";

/** Manifest shape (extension.json). Re-exported for tooling. */
export interface Manifest {
  name: string;
  version: string;
  runtime: "goja" | "wazero" | "v8go" | "native" | "pyvm" | "starkvm";
  module?: string;
  exports: string[];
}
