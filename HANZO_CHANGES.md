# HANZO_CHANGES

Tracks Hanzo-internal deltas not visible in `CHANGELOG.md` (audit
traceability, version pin justifications, brand-policy decisions, etc.).

## v0.1.0 (initial release)

- First public release of `@hanzo/zip`.
- Source layout: `src/{handler,error,envelope,index}.ts` + `src/runtime/{goja,javy}.ts`
  + `src/build/cli.ts`. Mirrors `zip-rs` (lib + macro + cli) at the file
  layout level, adapted to TS module conventions.
- Three end-to-end examples (`hello`, `validate-email`, `policy-eval`)
  with committed built JS so test harnesses don't depend on the
  toolchain.
- Byte-equivalent JS output to `base/plugins/extbench/fixtures/goja-js/validate.js`
  verified in V8 (Node `vm`). End-to-end verified through the production
  `base/plugins/gojavm` runtime — all nine invocation cases match the
  expected wire bytes (goja path normalizes object keys alphabetically
  per Go's `encoding/json`; this is a host property, not a guest bug).
- Deps pinned: typescript 5.9.3, esbuild 0.28.0, commander 14.0.3,
  tsx 4.22.2, @types/node 22.10.5. No major bumps planned; patch-only.
- License: BSD-3-Clause. Upstream credits in `NOTICE`.
- Built bundle sizes (minified, esbuild):
  - `hello.js` — 1553 B
  - `validate.js` — 1922 B
  - `policy_eval.js` — 1964 B
- Wasm-target backend (compile JS → wasm) is documented in
  `src/runtime/javy.ts` and the build CLI ships the trailer codegen for
  it. The end-to-end compile step requires a host-side WASI-stdio shim
  in `base/plugins/wasmvm` that has not yet landed (tracked in
  `base/plugins/extbench/fixtures/wazero-javy/TODO.md`). Until the shim
  ships, the wasm-target build is API-complete but not invocable; the
  goja target is the production path.
