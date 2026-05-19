# validate-email

TypeScript port of the canonical validate-email fixture. Produces
byte-equivalent JSON output to the AssemblyScript, Rust, and plain-JS
reference fixtures in `base/plugins/extbench/fixtures/`.

```bash
npm install
npm run build      # writes ./validate.js next to extension.json
```

The output `validate.js` is the goja-loadable JS module — drop it next
to `extension.json` and any HIP-0105 goja host can invoke it.

## Byte equivalence

| Input | Output |
|---|---|
| `{"email":"Foo@Example.COM ","age":25}` | `{"ok":true,"email":"foo@example.com","age":25}` |
| `{"email":"","age":25}` | `{"ok":false,"error":"email required"}` |
| `{"email":"a@b.com","age":-1}` | `{"ok":false,"error":"age out of range"}` |
| `{"email":"bad","age":30}` | `{"ok":false,"error":"email shape"}` |
| `{"email":"a@nodot","age":30}` | `{"ok":false,"error":"email domain"}` |
