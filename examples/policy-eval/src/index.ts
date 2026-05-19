/**
 * Policy-evaluation handler — realistic shape for an IAM / gateway
 * authz extension.
 *
 * Mirrors the zip-rs analog so a customer can compare equivalent
 * Rust vs TypeScript ergonomics side by side.
 *
 * Contract:
 *   in:  {"subject":"alice","action":"read","resource":"public:docs"}
 *   ok:  {"allow":true,"reason":"public resource"}
 *
 *   in:  {"subject":"alice","action":"write","resource":"alice:doc1"}
 *   ok:  {"allow":true,"reason":"owner"}
 *
 *   in:  {"subject":"bob","action":"delete","resource":"alice:doc1"}
 *   ok:  {"allow":false,"reason":"not owner"}
 *
 *   in:  {"subject":"root","action":"anything","resource":"anything"}
 *   ok:  {"allow":true,"reason":"admin override"}
 */

import { handler, ZipError } from "@hanzo/zip";

interface PolicyRequest {
  subject: string;
  action: string;
  resource?: string;
  context?: Record<string, unknown>;
}

interface PolicyResponse {
  allow: boolean;
  reason: string;
}

export const evaluate = handler<PolicyRequest, PolicyResponse>((req) => {
  if (!req?.subject) throw new ZipError("subject required", 400);
  if (!req?.action) throw new ZipError("action required", 400);

  const resource = req.resource ?? "";
  const role = req.context?.role;

  // Rule 1: superusers can do anything.
  if (req.subject === "root" || role === "admin") {
    return { allow: true, reason: "admin override" };
  }

  // Rule 2: read actions on public resources are allowed.
  if (req.action === "read" && resource.startsWith("public:")) {
    return { allow: true, reason: "public resource" };
  }

  // Rule 3: subject must own the resource for any write.
  if (req.action === "write" || req.action === "update" || req.action === "delete") {
    const ownerMatch = resource.startsWith(`${req.subject}:`);
    if (ownerMatch) {
      return { allow: true, reason: "owner" };
    }
    return { allow: false, reason: "not owner" };
  }

  return { allow: false, reason: "no rule matched" };
});
