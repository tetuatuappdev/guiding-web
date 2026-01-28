import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

type PublishSlot = {
  date: string;
  time: string;
  guide_id: string;
};

const isExpoToken = (token: string) =>
  token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");

const chunk = <T,>(list: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

async function sendExpoPush(tokens: string[], payload: { title: string; body: string; data: any }) {
  if (!tokens.length) return;
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data,
  }));

  const batches = chunk(messages, 100);
  for (const batch of batches) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
  }
}

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => null);
  const slots = (body?.slots ?? []) as PublishSlot[];
  if (!Array.isArray(slots) || slots.length === 0) {
    return NextResponse.json({ ok: false, error: "No slots provided." }, { status: 400 });
  }

  const rows = slots
    .filter((s) => s?.date && s?.time && s?.guide_id)
    .map((s) => ({
      slot_date: s.date,
      slot_time: s.time,
      guide_id: s.guide_id,
      status: "planned",
    }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "No valid slots." }, { status: 400 });
  }

  const { error: upErr } = await adminClient
    .from("schedule_slots")
    .upsert(rows, { onConflict: "slot_date,slot_time" });

  if (upErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to publish: ${upErr.message}` },
      { status: 500 }
    );
  }

  const guideIds = Array.from(new Set(rows.map((r) => r.guide_id)));
  const { data: guides, error: gErr } = await adminClient
    .from("guides")
    .select("id, user_id")
    .in("id", guideIds);

  if (gErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load guides: ${gErr.message}` },
      { status: 500 }
    );
  }

  const guideUserIds = Array.from(
    new Set((guides ?? []).map((g) => g.user_id).filter(Boolean))
  );
  if (guideUserIds.length === 0) {
    return NextResponse.json({ ok: true, count: rows.length });
  }

  const sampleDate = rows[0]?.slot_date;
  const monthLabel = sampleDate
    ? new Date(`${sampleDate}T00:00:00`).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : "";

  const { data: tokensRows, error: tErr } = await adminClient
    .from("push_tokens")
    .select("expo_push_token")
    .in("user_id", guideUserIds);

  if (tErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load push tokens: ${tErr.message}` },
      { status: 500 }
    );
  }

  const tokens = (tokensRows ?? [])
    .map((r) => r.expo_push_token)
    .filter((t) => typeof t === "string" && isExpoToken(t));

  const whenText = monthLabel ? ` for ${monthLabel}` : "";
  const message = `New tours published${whenText}. You can consult your affected tour on the app.`;

  await sendExpoPush(tokens, {
    title: "New tours published",
    body: message,
    data: { type: "new_tours_published", month: monthLabel, count: rows.length },
  });

  return NextResponse.json({ ok: true, count: rows.length });
}
