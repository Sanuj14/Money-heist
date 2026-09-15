import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Configuration check. Reports whether each environment variable is visible to
 * the running server and whether its value has the expected shape — never the
 * value itself. Safe to leave deployed.
 */
function describe(name: string, raw: string | undefined, expect: RegExp, hint: string) {
  if (!raw) return { name, status: "MISSING", hint };
  const value = raw.trim();
  if (value !== raw) {
    return { name, status: "BAD", hint: "has leading or trailing whitespace — re-enter it" };
  }
  if (!expect.test(value)) {
    return {
      name,
      status: "BAD",
      hint,
      looksLike: value.slice(0, 12) + (value.length > 12 ? "…" : ""),
      length: value.length,
    };
  }
  return { name, status: "OK", length: value.length };
}

export async function GET() {
  const checks = [
    describe(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i,
      "should look like https://xxxx.supabase.co"
    ),
    describe(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      /^(sb_publishable_|eyJ)/,
      "should start with sb_publishable_ (or eyJ for a legacy anon key)"
    ),
    describe(
      "NEXT_PUBLIC_SITE_URL",
      process.env.NEXT_PUBLIC_SITE_URL,
      /^https?:\/\/[^\/]+$/,
      "should be a full URL with no trailing slash"
    ),
    describe(
      "SUPABASE_SECRET_KEY",
      process.env.SUPABASE_SECRET_KEY,
      /^(sb_secret_|eyJ)/,
      "should start with sb_secret_ — server-side only, no NEXT_PUBLIC_ prefix"
    ),
  ];

  const blocking = checks.filter(
    (c) => c.status !== "OK" && c.name !== "NEXT_PUBLIC_SITE_URL"
  );

  return NextResponse.json(
    {
      ok: blocking.length === 0,
      summary: blocking.length
        ? `${blocking.length} variable(s) are missing or malformed — this is what breaks the site.`
        : "All required environment variables look correct.",
      checks,
    },
    { status: blocking.length ? 500 : 200 }
  );
}
