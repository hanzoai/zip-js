/**
 * Smallest possible zip-js handler.
 *
 *   in:  {"name":"world"}
 *   out: {"greeting":"hello, world!"}
 *
 * Reads `name` from the parsed payload and returns a greeting.
 * The goja host JSON-parses the input and JSON-stringifies the output —
 * the handler sees typed values on both sides.
 */

import { handler, ZipError } from "@hanzo/zip";

interface HelloRequest {
  name: string;
}

interface HelloResponse {
  greeting: string;
}

export const hello = handler<HelloRequest, HelloResponse>((req) => {
  if (!req?.name) {
    throw new ZipError("name required", 400);
  }
  return { greeting: `hello, ${req.name}!` };
});
