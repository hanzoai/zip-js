/**
 * Wire envelope shapes for zip-mounted route handlers.
 *
 * The Go-side `app.Module(method+path, runtime, dir)` surface sends a
 * `RouteEnvelope` to the guest and accepts either a `RouteResponse`
 * (with status/headers/body) or a bare JSON value (treated as the
 * 200 body).
 *
 * Pure HIP-0105 invocations (no HTTP wrapping) send the user's typed
 * payload directly and receive the user's typed response — these
 * envelopes are only for `app.Module()` route mounts. See README.
 */

/** HTTP request envelope passed to a route-mounted handler. */
export interface RouteEnvelope<TBody = unknown> {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  body?: TBody;

  /** Org slug, populated from JWT `owner` claim by the gateway. */
  org?: string;
  /** User ID, populated from JWT `sub` claim. */
  user?: string;
  /** User email, populated from JWT `email` claim. */
  userEmail?: string;
}

/** HTTP response envelope returned by a route-mounted handler. */
export interface RouteResponse<TBody = unknown> {
  status?: number;
  headers?: Record<string, string>;
  body?: TBody;
}
