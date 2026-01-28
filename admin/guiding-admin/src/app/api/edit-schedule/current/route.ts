import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const toIsoDateLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startIso = toIsoDateLocal(monthStart);
  const endIso = toIsoDateLocal(monthEnd);

  const { data: slots, error: sErr } = await adminClient
    .from("schedule_slots")
    .select("id, slot_date, slot_time, guide_id, status")
    .gte("slot_date", startIso)
    .lt("slot_date", endIso)
    .eq("status", "planned")
    .order("slot_date", { ascending: true })
    .order("slot_time", { ascending: true });

  if (sErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load slots: ${sErr.message}` },
      { status: 500 }
    );
  }

  const { data: guides, error: gErr } = await adminClient
    .from("guides")
    .select("id, first_name, last_name");

  if (gErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load guides: ${gErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    startDate: startIso,
    endDate: endIso,
    slots: slots ?? [],
    guides: guides ?? [],
  });
}
