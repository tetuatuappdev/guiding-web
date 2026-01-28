import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

type AvailabilityRow = {
  date: string | null;
  guide_id: string | null;
};

type GuideRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type GuideSummary = {
  id: string;
  name: string;
};

const formatGuideName = (g: GuideRow | undefined) => {
  if (!g) return null;
  const first = (g.first_name ?? "").trim();
  const last = (g.last_name ?? "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return null;
};

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
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  const startIso = toIsoDateLocal(nextMonthStart);
  const endIso = toIsoDateLocal(nextMonthEnd);

  const { data: availability, error: aErr } = await adminClient
    .from("guide_availability")
    .select("date, guide_id")
    .gte("date", startIso)
    .lt("date", endIso)
    .eq("is_available", true);

  if (aErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load availability: ${aErr.message}` },
      { status: 500 }
    );
  }

  const rows = (availability ?? []) as AvailabilityRow[];
  const guideIds = Array.from(new Set(rows.map((r) => r.guide_id).filter(Boolean))) as string[];

  const { data: guides, error: gErr } = guideIds.length
    ? await adminClient
        .from("guides")
        .select("id, first_name, last_name")
        .in("id", guideIds)
    : { data: [], error: null };

  if (gErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load guides: ${gErr.message}` },
      { status: 500 }
    );
  }

  const guideById = new Map((guides ?? []).map((g) => [g.id, g as GuideRow]));
  const availableByDate = new Map<string, Map<string, GuideSummary>>();

  rows.forEach((r) => {
    if (!r.date || !r.guide_id) return;
    const name = formatGuideName(guideById.get(r.guide_id));
    const safeName = name || `Guide ${String(r.guide_id).slice(0, 6)}`;
    const map = availableByDate.get(r.date) ?? new Map<string, GuideSummary>();
    map.set(r.guide_id, { id: r.guide_id, name: safeName });
    availableByDate.set(r.date, map);
  });

  const availabilityByDate = Array.from(availableByDate.entries()).map(([date, map]) => ({
    date,
    guides: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)),
  }));

  const historyStart = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const historyStartIso = toIsoDateLocal(historyStart);
  const historyEndIso = toIsoDateLocal(now);

  const { data: historyRows, error: hErr } = guideIds.length
    ? await adminClient
        .from("schedule_slots")
        .select("guide_id, slot_date")
        .in("guide_id", guideIds)
        .gte("slot_date", historyStartIso)
        .lte("slot_date", historyEndIso)
    : { data: [], error: null };

  if (hErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load history: ${hErr.message}` },
      { status: 500 }
    );
  }

  const historyByGuideId: Record<string, number> = {};
  (historyRows ?? []).forEach((row) => {
    if (!row.guide_id) return;
    historyByGuideId[row.guide_id] = (historyByGuideId[row.guide_id] ?? 0) + 1;
  });

  return NextResponse.json({
    ok: true,
    startDate: startIso,
    endDate: endIso,
    availability: availabilityByDate,
    historyByGuideId,
  });
}
