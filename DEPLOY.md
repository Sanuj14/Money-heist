# Deploying to Vercel — start to finish

Follow these in order. Steps 1–3 happen on your machine, 4–5 in Supabase,
6–8 in GitHub and Vercel, 9 back in Supabase to close the loop.

Budget about 25 minutes the first time.

---

## 1. Install and check the build locally

Deploy a build that has never run and Vercel will just show you the same error
ten minutes later. Run it here first.

```powershell
cd E:\Projects\Moneyhiest
npm install
```

Delete the leftover prototype so it doesn't end up in the repo:

```powershell
del money-heist-hunt.jsx
```

Now try a production build. It will **fail at this point** — that's expected,
because there's no `.env.local` yet. Do step 2 first, then come back:

```powershell
npm run build
```

If it reports errors that aren't about missing Supabase env vars, stop and send
me the output before going further.

---

## 2. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Name it `money-heist-hunt`. Pick the region closest to your event —
   **Southeast Asia (Singapore)** is the right one from Vellore.
3. Set a database password and save it somewhere. You won't need it for this
   app, but you'll be locked out of the SQL console without it.
4. Wait for provisioning (~2 min).

### Run the schema

1. Left sidebar → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from the project, copy the **whole file**, paste it in.
3. Hit **Run**.

You should see `Success. No rows returned`. If you see an error, copy it to me —
the script is written to be re-runnable, so you can safely fix and re-run.

### Grab your keys

**Project Settings → API**, copy:

- **Project URL** → `https://xxxxxxxx.supabase.co`
- **publishable** key → `sb_publishable_...`

> Use the **anon** key, never the `service_role` key. The service role key
> bypasses every security rule in the schema. It must never appear in a
> `NEXT_PUBLIC_` variable or in your repo.

---

## 3. Create `.env.local`

In `E:\Projects\Moneyhiest`, make a new file called exactly `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=sb_secret_...
```

`.gitignore` already excludes it, so it will never be committed.

Now re-run the build, and then the dev server:

```powershell
npm run build
npm run dev
```

Open http://localhost:3000, sign in, create a room, add one clue and one team,
and confirm the admin console loads. Fix anything broken **before** deploying.

---

## 4. Turn off email confirmation (do this before your event)

**Authentication → Sign In / Providers → Email** → switch **Confirm email** off.

With it on, every player waits on an inbox before they can join. With it off,
the password tab on the login screen signs them up and in instantly. For a timed
campus event this is the difference between a smooth start and fifteen minutes
of people refreshing Gmail.

---

## 5. Push to GitHub

If you don't have Git configured yet:

```powershell
git config --global user.name "Sanuj Dhote"
git config --global user.email "clashwork00@gmail.com"
```

Then, from the project folder:

```powershell
git init
git add .
git commit -m "Money Heist hunt — Next.js + Supabase"
git branch -M main
```

Create an **empty** repo on [github.com/new](https://github.com/new) — no README,
no .gitignore, no license, or the first push will conflict. Call it
`money-heist-hunt`. Then:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/money-heist-hunt.git
git push -u origin main
```

Before you push, sanity-check that the env file is not staged:

```powershell
git status
```

`.env.local` must **not** appear in the list. If it does, stop and tell me.

---

## 6. Import into Vercel

1. [vercel.com](https://vercel.com) → sign in **with GitHub**.
2. **Add New → Project** → find `money-heist-hunt` → **Import**.
3. Vercel detects Next.js on its own. Leave framework, build command, output
   directory and install command exactly as they are.
4. Expand **Environment Variables** and add all three:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your publishable key |
| `NEXT_PUBLIC_SITE_URL` | `https://money-heist-hunt.vercel.app` |
| `SUPABASE_SECRET_KEY` | your **secret** key — server-side only, no `NEXT_PUBLIC_` prefix |

For `NEXT_PUBLIC_SITE_URL` you're guessing your own URL before it exists. Vercel
almost always gives you `https://<repo-name>.vercel.app`. If it hands you
something different, fix the variable in step 8 and redeploy.

5. **Deploy**. First build takes 2–4 minutes.

---

## 7. Point Supabase at the deployed URL

This is the step people skip, and then magic links silently break.

**Supabase → Authentication → URL Configuration:**

- **Site URL**: `https://money-heist-hunt.vercel.app`
- **Redirect URLs** — add all three:
  ```
  http://localhost:3000/**
  https://money-heist-hunt.vercel.app/**
  https://money-heist-hunt-*.vercel.app/**
  ```

The third line covers Vercel's preview deployments, which get a fresh random
subdomain on every branch push. Without it, auth works in production but dies on
every preview.

---

## 8. Verify the deployment

Walk the whole loop before you trust it:

- [ ] Landing page loads with the red hero and the grid background
- [ ] `/login` → sign in works on the deployed URL (not just localhost)
- [ ] `/admin` → create a room, add 2 clues and 2 teams
- [ ] **QR sheet** tab → QR codes render, **Print sheet** opens a clean preview
- [ ] Open `/board/<ROOM CODE>` in a second tab — no sign-in required
- [ ] On your **phone**, open the deployed URL, join with the room + team code
- [ ] Tap **Scan** — the browser asks for camera permission and the viewfinder opens
- [ ] Scan a clue's QR off your laptop screen → points bank, next clue appears
- [ ] The board tab updates within a second or two, without a refresh

The phone test is the one that matters. Camera access requires HTTPS, so it can
only be verified on the deployed URL — `npm run dev` on your laptop won't prove it.

---

## 9. After this

Every `git push` to `main` redeploys automatically. To change scoring, clues or
teams you don't redeploy at all — that's all live data in Supabase, editable from
the admin console mid-event.

### If something breaks

| Symptom | Cause |
|---|---|
| Build fails: `supabaseUrl is required` | Env vars missing or misspelled in Vercel. They must start with `NEXT_PUBLIC_` |
| Magic link opens a login page again | Redirect URLs not added in step 7 |
| Camera button does nothing | Not on HTTPS, or permission was denied — reset it in site settings |
| Leaderboard doesn't move | Realtime block at the end of `schema.sql` didn't run |
| `permission denied for table` | Schema ran partially — re-run the whole file |
| Player sees "no room with that code" | Room code is case-sensitive in display only; check the room still exists |

Send me the exact error text and I'll work through it.

---

## Event-day notes

- Free-tier Supabase pauses a project after 7 days of no activity. Open the
  dashboard the day before your event to make sure it's awake.
- Free tier handles a campus-sized round comfortably — the load is a handful of
  writes per team per twenty minutes.
- Have the room code and every team code written down on paper. If a phone dies,
  a player signs in on a teammate's device with the same codes and picks up where
  the crew left off — progress lives on the team, not the device.
