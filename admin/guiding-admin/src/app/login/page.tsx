"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin() {
  setErr(null);
  setLoading(true);

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  setLoading(false);

  if (error) return setErr(error.message);

  router.replace("/tours"); // or "/tours"
  router.refresh();
}


  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>Admin access</h1>
        <p className="helper">
          Sign in to manage payments and guide access.
        </p>

        <div className="stack login-stack">
          <input
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="button" onClick={onLogin} disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>

        {err && <p className="error login-error">{err}</p>}
      </div>
    </div>
  );
}
