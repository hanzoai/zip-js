/**
 * `handler` — wrap a typed function so a HIP-0105 host can call it.
 *
 * The host (goja, Javy via wasm, native runner) hands the handler a
 * pre-parsed JSON payload and JSON-stringifies whatever the handler
 * returns. Our wrapper's job is narrow:
 *
 *  1. Run the user's function with the typed payload.
 *  2. If the user throws, translate the error into the canonical
 *     `{ok: false, error: <message>}` envelope.
 *  3. If the user returns a value, return it verbatim — the host
 *     handles serialization.
 *
 * Handlers MUST be synchronous on the goja path: the production goja
 * runtime calls the function and immediately serializes the return
 * value (no `await`). Returning a `Promise` from a goja handler would
 * serialize the Promise object literally, which is wrong. The wrapper
 * detects this and throws a clear `ZipError`.
 *
 * For the future Javy path the same constraint holds (Javy wraps
 * QuickJS, which is synchronous by design). Asynchronous IO in
 * extensions belongs in HIP-0060 (FaaS), not HIP-0105 (in-process).
 */

import { errorEnvelope, messageOf, ZipError, type ErrorEnvelope } from "./error.js";

/** Function signature a handler wraps. Sync only — see file docs. */
export type HandlerFn<I, O> = (req: I) => O;

/**
 * The wire-shaped function the host actually calls. Accepts any JSON
 * value the host parsed (we trust the host to have done it; the
 * wrapper validates structure before handing to the user). Returns
 * either the user's typed response or the canonical error envelope.
 */
export type WireHandler<O> = (payload: unknown) => O | ErrorEnvelope;

/**
 * Wrap a typed handler so the goja / Javy host can invoke it.
 *
 * @example
 * ```ts
 * interface Req { name: string }
 * interface Res { greeting: string }
 *
 * export const hello = handler<Req, Res>((req) => {
 *   if (!req.name) throw new ZipError("name required", 400);
 *   return { greeting: `hello, ${req.name}!` };
 * });
 * ```
 *
 * The returned function is what gets assigned to `globalThis.<name>`
 * by the runtime adapter. Users normally don't call it themselves —
 * they `export` it and the build step wires up the global binding.
 */
export function handler<I = unknown, O = unknown>(fn: HandlerFn<I, O>): WireHandler<O> {
  return function wrapped(payload: unknown): O | ErrorEnvelope {
    try {
      // The host already JSON-parsed the payload. Cast is the typed
      // boundary — we trust the host's parse, the user trusts the
      // declared type. Misshapen payloads cause user-side runtime
      // errors that the catch below converts to the error envelope.
      const result = fn(payload as I);

      // Guard against accidental async handlers. A returned Promise
      // would be JSON-serialized as `{}` (no own enumerable fields)
      // on goja — silently wrong. Make it loud.
      if (result !== null && typeof result === "object" && typeof (result as { then?: unknown }).then === "function") {
        throw new ZipError(
          "zip-js: handler returned a Promise. HIP-0105 invocations are synchronous; do async work in HIP-0060 FaaS instead.",
          500,
        );
      }

      return result;
    } catch (err) {
      return errorEnvelope(messageOf(err));
    }
  };
}
