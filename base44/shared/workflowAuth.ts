import { secrets } from "base44:runtime";

/**
 * Authorize a backend function call that is meant to run either:
 *   - as an authenticated admin action (via user context), or
 *   - as an internal scheduled-workflow invocation (no user context).
 *
 * External unauthenticated HTTP callers are rejected: a swallowed
 * `auth.me()` error is NOT treated as a trusted workflow signal.
 * Workflow invocations must present a shared secret token (passed via the
 * workflow `args` body or `x-workflow-token` header) matching the
 * WORKFLOW_TOKEN secret.
 */
export async function isAuthorizedCall(req, base44): Promise<boolean> {
  // 1) Authenticated user context — must be an admin
  try {
    const user = await base44.auth.me();
    if (user) return user.role === "admin";
  } catch {
    // no user context — fall through to shared-secret check
  }

  // 2) Internal workflow invocation — verify shared secret
  const expected = secrets.get("WORKFLOW_TOKEN");
  if (!expected) return false;

  let provided = "";
  try {
    const h = req?.headers;
    if (h && typeof h.get === "function") provided = h.get("x-workflow-token") || "";
  } catch {
    // ignore header read errors
  }
  if (!provided) {
    try {
      if (req?.body) {
        const body = await req.json();
        provided = (body && body.token) || "";
      }
    } catch {
      // body not JSON or already consumed
    }
  }
  if (!provided || provided.length !== expected.length) return false;

  // constant-time comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}