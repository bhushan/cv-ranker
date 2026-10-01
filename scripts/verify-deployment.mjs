// Unauthenticated smoke test for a deployment: the app is login-only.
import assert from "node:assert/strict";
const base = process.argv[2];
if (!base?.startsWith("https://"))
  throw new Error("Provide the deployed HTTPS URL.");
const url = (path) => new URL(path, base);
const home = await fetch(url("/"), { redirect: "manual" });
assert([307, 308].includes(home.status), "Home redirects");
const app = await fetch(url("/candidates"), { redirect: "manual" });
assert([307, 308].includes(app.status), "App redirects when signed out");
assert(app.headers.get("location")?.endsWith("/login"));
const login = await fetch(url("/login"));
assert.equal(login.status, 200);
assert.equal(login.headers.get("x-content-type-options"), "nosniff");
assert((await login.text()).includes("Sign in"));
for (const path of [
  "/api/candidates",
  "/api/candidates?mode=demo",
  "/api/rankings?mode=demo&role=PM",
  "/api/emails?mode=demo",
  "/api/candidates/00000000-0000-4000-8000-000000000001",
]) {
  const r = await fetch(url(path));
  assert([401, 403, 503].includes(r.status), `Protected: ${path}`);
}
const send = await fetch(
  url("/api/emails/00000000-0000-4000-8000-000000000001/send"),
  {
    method: "POST",
    headers: { Origin: url("/").origin, "Content-Type": "application/json" },
    body: JSON.stringify({ approved: false }),
  },
);
assert([401, 403, 503].includes(send.status));
console.log(
  JSON.stringify({
    url: base,
    loginOnly: true,
    privateEndpointsProtected: true,
    unapprovedSendBlocked: true,
  }),
);
