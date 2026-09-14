"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewRoom() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("rooms")
      .insert({ name: name.trim(), tagline: tagline.trim() || null, owner_id: user!.id })
      .select("id")
      .single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.push(`/admin/${data.id}`);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="pill-red mt-7 !px-7 !py-3.5">
        + New heist room
      </button>
    );
  }

  return (
    <form onSubmit={create} className="paper mt-7 grid gap-4 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <label className="label">Room name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus
          placeholder="Hunt for Money — Round 2" className="field" />
      </div>
      <div>
        <label className="label">Tagline (optional)</label>
        <input value={tagline} onChange={(e) => setTagline(e.target.value)}
          placeholder="Campus-wide, 6 clues" className="field" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="pill-ghost">Cancel</button>
        <button disabled={busy || !name.trim()} className="pill-gold">{busy ? "…" : "Create"}</button>
      </div>
      {err && <p className="text-[12px] text-dali-soft sm:col-span-3">{err}</p>}
    </form>
  );
}
