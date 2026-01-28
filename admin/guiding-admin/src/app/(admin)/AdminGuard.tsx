"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<"loading" | "yes" | "no">("loading");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;

      if (error || !uid) {
        window.location.href = "/login";
        return;
      }

      const { data: adminRow } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();

      setOk(adminRow ? "yes" : "no");
    })();
  }, []);

  if (ok === "loading") return <p>Loading…</p>;
  if (ok === "no") return <p>Not admin. Bye.</p>;
  return <>{children}</>;
}
