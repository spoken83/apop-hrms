import { NextResponse, type NextRequest } from "next/server";
import { ALL_ENTITIES, ENTITY_COOKIE } from "@/lib/entity-constants";

// Sets the selected-entity cookie via a plain server-side redirect. Reached by
// an ordinary <a> navigation from the switcher, so it works with zero client
// JS — no hydration, no router.refresh, nothing to break from a stale bundle.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? ALL_ENTITIES;
  const nextParam = req.nextUrl.searchParams.get("next") ?? "/";

  // Only accept a local path for the redirect target (no open redirects).
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  // Accept "all" or a UUID; anything else falls back to "all".
  const isValid =
    id === ALL_ENTITIES ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const value = isValid ? id : ALL_ENTITIES;

  // Relative Location so the browser resolves it against whatever origin it is
  // actually on — works identically on localhost (http), *.orb.local, and the
  // Vercel https domain. Reconstructing the origin from headers can produce the
  // wrong protocol (e.g. https://localhost:3000) and a dead redirect.
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: next },
  });
  res.cookies.set(ENTITY_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
