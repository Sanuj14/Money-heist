import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Server-side player registration.
 *
 * Creates an already-confirmed account using the Supabase secret key, which
 * never leaves the server. This sidesteps the confirmation email entirely —
 * no inbox round-trip, and no "email rate limit exceeded" on event day when
 * a room full of people signs up at once.
 *
 * The endpoint is gated on a valid room code + team code, so it can't be used
 * to create accounts by anyone who isn't already holding a crew's credentials.
 */
export async function POST(request: Request) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!secret || !url) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SECRET_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let body: { email?: string; password?: string; roomCode?: string; teamCode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const roomCode = (body.roomCode ?? "").trim();
  const teamCode = (body.teamCode ?? "").trim();

  if (!email || password.length < 6) {
    return NextResponse.json(
      { ok: false, message: "Email and a password of at least 6 characters are required." },
      { status: 400 }
    );
  }

  // --- gate: the caller must hold a working room + team code ----------
  const anon = createClient(url, publishable!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: teamRows } = await anon.rpc("peek_team", {
    p_room_code: roomCode,
    p_team_code: teamCode,
  });
  if (!teamRows?.[0]) {
    return NextResponse.json(
      { ok: false, message: "That room code and team code combination is not valid." },
      { status: 403 }
    );
  }

  // --- create the account, already confirmed --------------------------
  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    // Already registered is fine — the client just signs in instead.
    if (/already (been )?registered|already exists|duplicate/i.test(error.message)) {
      return NextResponse.json({ ok: true, existed: true });
    }
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, existed: false });
}
