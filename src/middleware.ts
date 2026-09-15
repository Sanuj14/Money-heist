import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: any };

const PROTECTED = ["/admin", "/play"];

/**
 * Auth refresh + route gating.
 *
 * This runs on nearly every request, so anything that throws here takes the
 * whole site down with an opaque MIDDLEWARE_INVOCATION_FAILED. It is therefore
 * written to fail OPEN: if configuration is missing or Supabase errors, the
 * request is passed through untouched and the page itself reports the problem.
 * Worst case is that route gating stops working; the site still renders.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED.some((p) => path.startsWith(p));

  if (!url || !key) {
    console.error(
      "[middleware] Supabase env missing —",
      "NEXT_PUBLIC_SUPABASE_URL:", url ? "set" : "MISSING",
      "publishable/anon key:", key ? "set" : "MISSING",
      "— passing request through. See /api/health."
    );
    return NextResponse.next({ request });
  }

  try {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: CookieToSet[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user && needsAuth) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      redirect.searchParams.set("next", path);
      return NextResponse.redirect(redirect);
    }
    return response;
  } catch (err) {
    console.error("[middleware] failed, passing through:", err);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
