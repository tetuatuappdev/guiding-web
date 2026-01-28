import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const toMonthValue = (dateStr: string) => {
  const [y, m] = String(dateStr).split("-");
  if (!y || !m) return null;
  return `${y}-${m}`;
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token." }, { status: 401 });
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: adminRow, error: adminErr } = await adminClient
    .from("admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminErr) {
    return NextResponse.json({ ok: false, error: "Admin check failed." }, { status: 500 });
  }

  if (!adminRow) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  const { data: slots, error: sErr } = await adminClient
    .from("schedule_slots")
    .select("slot_date")
    .eq("status", "completed")
    .not("guide_id", "is", null);

  if (sErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load months: ${sErr.message}` },
      { status: 500 }
    );
  }

  const monthSet = new Set<string>();
  (slots ?? []).forEach((row) => {
    if (!row.slot_date) return;
    const value = toMonthValue(row.slot_date);
    if (value) monthSet.add(value);
  });

  const months = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  const options = months.map((value) => ({
    value,
    label: new Date(`${value}-01T00:00:00`).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    }),
  }));

  return NextResponse.json({ ok: true, months: options });
}
