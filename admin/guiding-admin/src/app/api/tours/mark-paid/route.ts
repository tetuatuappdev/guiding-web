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
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { tour_id } = await req.json();
  if (!tour_id) return NextResponse.json({ ok: false, error: "tour_id missing" }, { status: 400 });

  // Update
  const { error } = await supabase
    .from("tours")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", tour_id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return res;
}
