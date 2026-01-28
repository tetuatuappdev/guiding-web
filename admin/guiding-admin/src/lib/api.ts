import { supabase } from "@/lib/supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function apiPost(path: string, body?: any) {
  if (!BASE) throw new Error("NEXT_PUBLIC_API_URL is missing");

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await r.text();
  if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
  return text ? JSON.parse(text) : null;
}
