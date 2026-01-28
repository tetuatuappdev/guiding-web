"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";


export default function Home() {
  const [status, setStatus] = useState<"loading" | "admin" | "nope">("loading");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      if (!user) return setStatus("nope");

      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setStatus(!error && data ? "admin" : "nope");
    })();
  }, []);

  if (status === "loading") return <p className="muted">Loading...</p>;

  if (status === "nope") {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1>Restricted access</h1>
          <p className="helper">
            This dashboard is reserved for Guiding administrators.
          </p>
          <div className="hero-actions spaced">
            <Link className="button" href="/login">Sign in</Link>
            <a className="button ghost" href="https://guiding.fr" rel="noreferrer">
              Public site
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>Welcome</h1>
        <p className="helper">
          You are signed in as an administrator.
        </p>
        <p className="muted">ID: {userId ?? "-"}</p>
        <div className="hero-actions spaced">
          <Link className="button" href="/tours">Go to dashboard</Link>
          <Link className="button ghost" href="/allowlist">Manage allowlist</Link>
        </div>
      </div>
    </div>
  );
}
