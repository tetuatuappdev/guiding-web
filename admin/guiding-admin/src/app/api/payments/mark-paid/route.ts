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

  const { payment_id } = await req.json();
  if (!payment_id) {
    return NextResponse.json(
      { ok: false, error: "payment_id missing" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("tour_payments")
    .update({ status: "paid" })
    .eq("id", payment_id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }

  return res;
}
