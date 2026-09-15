"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";

export default function BoardEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <div className="min-h-screen">
      <Nav back={{ href: "/", label: "Home" }} />
      <main className="grid place-items-center px-4 py-24">
        <form
          onSubmit={(e) => { e.preventDefault(); router.push(`/board/${code.trim().toUpperCase()}`); }}
          className="paper w-full max-w-md p-8"
        >
          <p className="eyebrow">Spectator mode</p>
          <h1 className="display mt-2 text-[34px] text-bone">Open a board</h1>
          <p className="mt-2 text-[13px] text-bone/50">
            Room code only. No sign-in needed — put this on the projector.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="——————"
            className="field-code mt-6"
            autoFocus
          />
          <button disabled={code.length < 4} className="pill-gold mt-4 w-full !py-3.5">
            Show the board
          </button>
        </form>
      </main>
    </div>
  );
}
