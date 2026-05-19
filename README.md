# @hanzo/zip

Write zip-mounted handlers in idiomatic TypeScript.

`@hanzo/zip` hides the HIP-0105 calling convention behind a `handler()`
wrapper so your code reads as a typed, ordinary function. The build
step compiles your TypeScript into a single bundled JS file that any
HIP-0105 JS host (goja today, the wasm path later) can load.

```ts
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
  if (!req.email) {
    throw new ZipError("email required", 400);
  }
  return {
    ok: true,
    email: req.email.trim().toLowerCase(),
    age: req.age,
  };
});
```

Build:

```bash
npx zip-js build
# -> writes validate.js next to extension.json
```

Drop the resulting `.js` file plus `extension.json` into any zip- or
Base-mounted handler directory. The goja runtime picks it up.

## Quickstart

```bash
mkdir my-handler && cd my-handler
npm init -y
npm install @hanzo/zip
```

Create `extension.json`:

```json
{
  "name": "my-handler",
  "version": "0.1.0",
  "runtime": "goja",
  "module": "my-handler.js",
  "exports": ["validate"]
}
```

Create `src/index.ts` with a `handler(...)` export named `validate`,
then:

```bash
npx zip-js build
```

That's the whole loop.

## Examples

Three end-to-end examples in `examples/`:

| Example | Purpose | Built size (minified) |
|---|---|---|
| `hello` | minimal `name -> greeting` | 1.5 KB |
| `validate-email` | port of the canonical validate fixture (byte-equivalent in the V8 host) | 1.9 KB |
| `policy-eval` | realistic IAM authz decision handler | 2.0 KB |

Build all:

```bash
npm install
npm run build
npm run examples
npm run verify
```

`npm run verify` loads each built bundle into a fresh V8 context the
same way the production goja host does, calls the exported globals,
and compares the JSON output bytes against the canonical reference
strings.

## Cross-host byte equivalence

For the canonical `validate-email` fixture the output bytes are
identical across:

- `base/plugins/extbench/fixtures/goja-js/validate.js` (plain JS reference)
- `examples/validate-email/validate.js` (this SDK's output)

Verified in a V8 context (Node's `vm`) per the verify-examples harness.

A note on the goja host: when the production `gojavm` runtime invokes a
JS handler that returns a plain object, the result is serialized via
Go's `encoding/json` which marshals map keys in alphabetical order. The
**values** are identical; the **key order** depends on the host. The
pre-formed string fixtures (AssemblyScript, Rust) emit `ok` before
`error` because they hand-build the JSON; an object-returning goja
handler will emit `error` before `ok`. The wire bytes are
host-dependent. Application code that depends on key order is buggy on
its face — every JSON parser is required to accept any order. Verified
end-to-end against the production `gojavm` runtime.

## Public API

```ts
import { handler, ZipError, type Manifest } from "@hanzo/zip";
import type { RouteEnvelope, RouteResponse } from "@hanzo/zip";
```

| Export | Purpose |
|---|---|
| `handler<I, O>(fn)` | Wrap a typed `(req: I) => O` function into the wire shape the host calls. |
| `ZipError(msg, status?)` | Throw to produce a canonical `{ok:false,error:msg}` envelope. The optional `status` is honored when the handler is route-mounted via `app.Module()`. |
| `errorEnvelope(msg)` | Build the error envelope without throwing. |
| `Manifest` | Type for `extension.json`. |
| `RouteEnvelope<TBody>` | Wire shape passed to a route-mounted handler. |
| `RouteResponse<TBody>` | Wire shape a route-mounted handler may return. |

## CLI

```
zip-js build [dir]   # default dir = .
  -e, --entry <path>     entry TS file (default src/index.ts)
  -o, --out <path>       output file (default from manifest.module)
  --no-minify            do not minify (default minified)
```

## Constraints on `handler()`

| Rule | Reason |
|---|---|
| Function MUST be synchronous | HIP-0105 invocations are synchronous. Async work belongs in HIP-0060 (FaaS), not in-process extensions. Returning a `Promise` produces a clear runtime error. |
| Function takes exactly one parameter | The host hands one parsed JSON payload. Multiple parameters are silently dropped. |
| Errors should be `ZipError` | Plain `Error` and thrown strings work but `ZipError` carries `status` for route mounts. |

## Build pipeline

`zip-js build`:

1. Reads `extension.json` (validates `name`, `version`, `runtime`, `exports`).
2. Runs esbuild on `src/index.ts` as a single IIFE bundle with
   `globalName: "__zip"`.
3. Appends a runtime trailer (`globalThis.<fn> = __zip.<fn>` for goja).
4. Writes the result to `manifest.module`.

The output is a single-file bundle with no external dependencies
beyond ES2020 globals (which goja supports). No `import`, no `require`,
no Node built-ins. If your handler depends on a third-party npm
package, it gets bundled inline.

## Sibling SDKs

`@hanzo/zip` is one of a family of language SDKs targeting the
HIP-0105 ABI:

- `zip-rs` (Rust → wasm)
- `@hanzo/zip` (TypeScript → goja/wasm) — this repo
- `zip-as` (AssemblyScript → wasm) — reference

All three produce artifacts the Hanzo Base / zip host can load via a
manifest-only `runtime` switch.

## License

BSD-3-Clause. See `LICENSE`. Upstream credits in `NOTICE`.
