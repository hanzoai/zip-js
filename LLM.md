# zip-js

`@hanzo/zip` — a TypeScript SDK for writing HIP-0105 zip handlers. `handler()`
hides the calling convention so guest code reads as an ordinary typed function;
`zip-js build` bundles it to a single JS file any HIP-0105 JS host loads (goja
today, the wasm/javy path API-complete but gated on a host WASI-stdio shim).
Layout and usage in `README.md`; release-by-release deltas in
`HANZO_CHANGES.md`.

Despite the name this contains **no ZIP-archive code** — no deflate, inflate, or
CRC-32, and no relation to `gildas-lormeau/zip.js`. "zip" here is the Hanzo
handler format.

## Licensing

`MIT OR Apache-2.0`, at your option — per HIP-0137 (`hanzoai/hips`, `HIPs/hip-0137-one-license.md`). Relicensed from BSD-3-Clause,
which HIP-0137 puts out of scope for `hanzoai`. `package.json` and the root
entry of `package-lock.json` follow; dependency entries in the lockfile keep
their own licences.

`NOTICE` is unchanged and remains accurate: it credits esbuild, commander and
TypeScript as **build-time** dependencies under their own licences. None of them
is redistributed in this repo's source, and none constrains these terms.
