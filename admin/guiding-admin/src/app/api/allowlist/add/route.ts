import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: any }>) => {
  cookiesToSet.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, options);
  });
},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { email } = await req.json();
  const clean = String(email || "").trim().toLowerCase();

  if (!clean || !clean.includes("@")) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }

  const { error } = await supabase.from("invite_allowlist").insert({
    email: clean,
    invited_by: user.id,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return res;
}
