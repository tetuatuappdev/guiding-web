"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function AllowlistForm() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function onAdd() {
    setErr(null);
    const r = await fetch("/api/allowlist/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const j = await r.json();
    if (!r.ok) return setErr(j?.error ?? "Failed");

    setEmail("");
    startTransition(() => router.refresh());
  }

  return (
    <div className="stack">
      <label className="muted">New approved email</label>
      <div className="inline-actions">
        <input
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="guide email"
        />
        <button className="button" onClick={onAdd} disabled={isPending}>
          {isPending ? "Adding..." : "Add"}
        </button>
      </div>
      {err && <p className="error">{err}</p>}
    </div>
  );
}
