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
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not logged in" }, { status: 401 });

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) return NextResponse.json({ ok: false, error: "Not admin" }, { status: 403 });

  const { payment_id } = await req.json();
  if (!payment_id) return NextResponse.json({ ok: false, error: "payment_id missing" }, { status: 400 });

  const { data: pay, error: payErr } = await supabase
    .from("tour_payments")
    .select("id, status")
    .eq("id", payment_id)
    .maybeSingle();

  if (payErr || !pay) return NextResponse.json({ ok: false, error: payErr?.message ?? "Not found" }, { status: 400 });
  if (pay.status === "paid") return NextResponse.json({ ok: true }); // idempotent

  const { error: updErr } = await supabase
    .from("tour_payments")
    .update({ status: "paid" })
    .eq("id", payment_id);

    // ... after update status = "paid"

const { data: pay2 } = await supabase
  .from("tour_payments")
  .select("id, slot_id, guide_id, amount_pence")
  .eq("id", payment_id)
  .maybeSingle();

if (process.env.ADMIN_NOTIFY_URL && pay2?.guide_id && pay2?.slot_id) {
  const { data: slot } = await supabase
    .from("schedule_slots")
    .select("slot_date, slot_time")
    .eq("id", pay2.slot_id)
    .maybeSingle();

  // best-effort notify: failure should not break the payment
  try {
    await fetch(process.env.ADMIN_NOTIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": process.env.ADMIN_NOTIFY_SECRET ?? "",
      },
      body: JSON.stringify({
        guide_id: pay2.guide_id,
        slot_id: pay2.slot_id,
        slot_date: slot?.slot_date,
        slot_time: slot?.slot_time,
        amount_pence: pay2.amount_pence ?? 0,
      }),
    });
  } catch {
    // ignore
  }
}


  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });

  return res;
}
