import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slotId = searchParams.get("slot_id");

  if (!slotId) {
    return NextResponse.json({ ok: false, error: "Missing slot_id." }, { status: 400 });
  }

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

  const { data: invoice, error: iErr } = await adminClient
    .from("tour_invoices")
    .select("pdf_path")
    .eq("slot_id", slotId)
    .maybeSingle();

  if (iErr) {
    return NextResponse.json(
      { ok: false, error: `Failed to load invoice: ${iErr.message}` },
      { status: 500 }
    );
  }

  if (!invoice?.pdf_path) {
    return NextResponse.json({ ok: true, url: null });
  }

  let path = String(invoice.pdf_path || "");
  while (path.startsWith("invoices/")) path = path.slice("invoices/".length);

  const { data } = adminClient.storage.from("invoices").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data?.publicUrl ?? null });
}
