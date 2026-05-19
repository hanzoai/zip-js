# hello

Smallest possible zip-js handler — reads `name`, returns a greeting.

```bash
npm install
npm run build      # writes ./hello.js next to extension.json
```

Drop `hello.js` + `extension.json` into a `hz_routes/hello/` directory
on any zip-mounted Hanzo service and the goja runtime picks it up.
