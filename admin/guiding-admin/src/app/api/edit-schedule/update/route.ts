import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

type UpdateRow = {
  id: string;
  guide_id: string | null;
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
  const updates = (body?.updates ?? []) as UpdateRow[];
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ ok: false, error: "No updates provided." }, { status: 400 });
  }

  const ids = updates.map((u) => u.id).filter(Boolean);
  const { data: beforeRows, error: bErr } = await adminClient
    .from("schedule_slots")
    .select("id, guide_id")
    .in("id", ids);

  if (bErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load current slots: ${bErr.message}` },
      { status: 500 }
    );
  }

  const beforeMap = new Map((beforeRows ?? []).map((r) => [r.id, r.guide_id]));

  for (const update of updates) {
    const { error: upErr } = await adminClient
      .from("schedule_slots")
      .update({ guide_id: update.guide_id })
      .eq("id", update.id);

    if (upErr) {
      return NextResponse.json(
        { ok: false, error: `Failed to update slots: ${upErr.message}` },
        { status: 500 }
      );
    }
  }

  const changedGuideIds = new Set<string>();
  updates.forEach((u) => {
    const before = beforeMap.get(u.id) ?? null;
    const after = u.guide_id ?? null;
    if (before !== after) {
      if (before) changedGuideIds.add(before);
      if (after) changedGuideIds.add(after);
    }
  });

  if (changedGuideIds.size === 0) {
    return NextResponse.json({ ok: true, count: updates.length, notifiedUsers: 0, tokens: 0 });
  }

  const { data: guides, error: gErr } = await adminClient
    .from("guides")
    .select("id, user_id")
    .in("id", Array.from(changedGuideIds));

  if (gErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load guides: ${gErr.message}` },
      { status: 500 }
    );
  }

  const userIds = Array.from(
    new Set((guides ?? []).map((g) => g.user_id).filter(Boolean))
  );

  if (!userIds.length) {
    return NextResponse.json({ ok: true, count: updates.length, notifiedUsers: 0, tokens: 0 });
  }

  const { data: tokensRows, error: tErr } = await adminClient
    .from("push_tokens")
    .select("expo_push_token")
    .in("user_id", userIds);

  if (tErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load push tokens: ${tErr.message}` },
      { status: 500 }
    );
  }

  const tokens = (tokensRows ?? [])
    .map((r) => r.expo_push_token)
    .filter((t) => typeof t === "string" && isExpoToken(t));

  await sendExpoPush(tokens, {
    title: "Schedule updated",
    body: "Your schedule has been updated, please consult the app.",
    data: { type: "schedule_updated" },
  });

  return NextResponse.json({
    ok: true,
    count: updates.length,
    notifiedUsers: userIds.length,
    tokens: tokens.length,
  });
}
