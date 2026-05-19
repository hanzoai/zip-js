/**
 * TypeScript port of the canonical validate-email fixture.
 *
 * Mirrors the byte-for-byte response shape of:
 *  - `base/plugins/extbench/fixtures/goja-js/validate.js` (plain JS)
 *  - `base/plugins/extbench/fixtures/wazero-as/src/assembly/index.ts` (AssemblyScript)
 *  - `base/plugins/extbench/fixtures/wazero-rust/src/lib.rs` (Rust)
 *  - `zip-rs/examples/validate-email/src/lib.rs` (zip-rs)
 *
 * Contract:
 *   in:  {"email":"Foo@Example.COM ","age":25}
 *   ok:  {"ok":true,"email":"foo@example.com","age":25}
 *   err: {"ok":false,"error":"input must be an object"}
 *   err: {"ok":false,"error":"email required"}
 *   err: {"ok":false,"error":"age out of range"}
 *   err: {"ok":false,"error":"email shape"}
 *   err: {"ok":false,"error":"email domain"}
 *
 * Errors are returned by `throw` and the handler wrapper converts them
 * into the canonical `{ok:false,error:<msg>}` envelope. The shape of
 * the error envelope is identical across every reference fixture —
 * extbench compares bytes.
 */

import { handler, ZipError } from "@hanzo/zip";

interface ValidateRequest {
  email: string;
  age: number;
}

interface ValidateResponse {
  ok: true;
  email: string;
  age: number;
}

export const validate = handler<ValidateRequest, ValidateResponse>((req) => {
  // Shape check up front — the goja-js reference rejects null / non-object.
  if (req === null || typeof req !== "object") {
    throw new ZipError("input must be an object", 400);
  }

  const email = (req as ValidateRequest).email;
  const age = (req as ValidateRequest).age;

  if (typeof email !== "string" || email.length === 0) {
    throw new ZipError("email required", 400);
  }
  if (typeof age !== "number" || age < 0 || age > 150) {
    throw new ZipError("age out of range", 400);
  }

  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0 || at === normalized.length - 1) {
    throw new ZipError("email shape", 400);
  }
  const domain = normalized.substring(at + 1);
  if (domain.indexOf(".") < 0) {
    throw new ZipError("email domain", 400);
  }

  // Field order matches the reference fixtures byte-for-byte: ok, email, age.
  return { ok: true, email: normalized, age };
});
