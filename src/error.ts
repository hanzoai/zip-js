/**
 * Error type for zip-js handlers.
 *
 * Thrown errors are translated into the canonical wire envelope
 * `{ok: false, error: <message>}` by the handler wrapper. This matches
 * the AssemblyScript/Rust reference fixtures byte-for-byte so a single
 * host can talk to any guest language.
 *
 * The optional `status` field is consulted only by the module-mounted
 * (`app.Module(...)`) route surface; HIP-0105 stand-alone invocations
 * ignore it (the host treats any non-empty result as 200).
 */
export class ZipError extends Error {
  readonly status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = "ZipError";
    this.status = status;
  }
}

/**
 * Canonical error envelope shape: `{ok: false, error: <message>}`.
 * Key order matters — the reference fixtures (AssemblyScript, Rust,
 * goja-js) emit `ok` before `error`. Build it as a literal object
 * literal so V8/goja serialize in insertion order.
 */
export interface ErrorEnvelope {
  ok: false;
  error: string;
}

/**
 * Build the canonical error envelope. Used by the handler wrapper and
 * by callers that want to construct an error result without throwing.
 */
export function errorEnvelope(message: string): ErrorEnvelope {
  return { ok: false, error: message };
}

/**
 * Extract a human-readable message from any thrown value. JS lets you
 * throw anything; we always emit a string into the envelope.
 */
export function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
