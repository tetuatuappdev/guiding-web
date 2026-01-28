"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
type SlotRow = {
  slot_date: string | null;
  slot_time: string | null;
  status: string | null;
};

type PaymentRow = {
  id: string;
  status: string | null;
  amount_pence: number | null;
};

type TicketScan = {
  id: string;
  kind: "paper" | "online" | "scanned" | string;
  persons: number | null;
  ticket_code: string | null;
  tourist_name: string | null;
  scanned_at: string | null;
};

export default function TourDetailClient({ slotId }: { slotId: string }) {
  const [slot, setSlot] = useState<SlotRow | null>(null);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [scans, setScans] = useState<TicketScan[]>([]);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setErr(null);
      if (!slotId || !isUuid(String(slotId))) {
        setErr(`Invalid slot (${String(slotId)})`);
        return;
      }

      const { data: slotData, error: slotErr } = await supabase
        .from("schedule_slots")
        .select("slot_date, slot_time, status")
        .eq("id", slotId)
        .maybeSingle();
      if (slotErr) return setErr(slotErr.message);
      setSlot(slotData);

      const { data: paymentData, error: payErr } = await supabase
        .from("tour_payments")
        .select("id, status, amount_pence")
        .eq("slot_id", slotId)
        .maybeSingle();
      if (payErr) return setErr(payErr.message);
      setPayment(paymentData);

      const { data: scanData, error: scanErr } = await supabase
        .from("ticket_scans")
        .select("id, kind, persons, ticket_code, tourist_name, scanned_at")
        .eq("slot_id", slotId)
        .order("scanned_at", { ascending: false });
      if (scanErr) return setErr(scanErr.message);
      setScans(scanData ?? []);

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (token) {
        const resp = await fetch(`/api/tours/invoice-url?slot_id=${slotId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await resp.json();
        if (resp.ok && body?.ok) {
          setInvoiceUrl(body.url ?? null);
        }
      }
    })();
  }, [slotId]);

  const totalPersons =
    scans?.reduce((sum, s) => sum + (s.persons ?? 0), 0) ?? 0;
  const totalPaper =
    scans?.filter((s) => s.kind === "paper").reduce((sum, s) => sum + (s.persons ?? 0), 0) ?? 0;
  const totalOnline =
    scans?.filter((s) => s.kind === "online").reduce((sum, s) => sum + (s.persons ?? 0), 0) ?? 0;
  const totalScanned =
    scans?.filter((s) => s.kind === "scanned").reduce((sum, s) => sum + (s.persons ?? 0), 0) ?? 0;

  if (err) return <p className="error">{err}</p>;

  return (
    <div className="page">
      <Link className="chip" href="/tours">
        ← Back to payments
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Tour details</h1>
          <p className="page-subtitle">
            Track the slot, payment, and ticket scans.
          </p>
        </div>
        <span className="pill">{totalPersons} people</span>
      </div>

      <section className="card">
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-value">{slot?.slot_date ?? "-"}</div>
            <div className="stat-label">Date</div>
          </div>
          <div className="stat">
            <div className="stat-value">{slot?.slot_time ?? "-"}</div>
            <div className="stat-label">Time</div>
          </div>
          <div className="stat">
            <div className="stat-value">{slot?.status ?? "-"}</div>
            <div className="stat-label">Slot status</div>
          </div>
          <div className="stat">
            <div className="stat-value">{payment?.status ?? "-"}</div>
            <div className="stat-label">Payment</div>
          </div>
          <div className="stat">
            <div className="stat-value">
              {payment
                ? `£${((payment.amount_pence ?? 0) / 100).toFixed(2)}`
                : "-"}
            </div>
            <div className="stat-label">Amount</div>
          </div>
          <div className="stat">
            <div className="stat-value stat-value-inline">
              {invoiceUrl ? (
                <a className="button ghost" href={invoiceUrl} target="_blank" rel="noreferrer">
                  Open invoice
                </a>
              ) : (
                "-"
              )}
            </div>
            <div className="stat-label">Invoice</div>
          </div>
          <div className="stat">
            <div className="stat-value">{totalPaper}</div>
            <div className="stat-label">Paper tickets</div>
          </div>
          <div className="stat">
            <div className="stat-value">{totalOnline}</div>
            <div className="stat-label">Online tickets</div>
          </div>
          <div className="stat">
            <div className="stat-value">{totalScanned}</div>
            <div className="stat-label">Other scans</div>
          </div>
        </div>
      </section>

      {(!scans || scans.length === 0) ? (
        <div className="callout">
          <strong>No scanned tickets.</strong>
          <span className="muted">Scans will appear here in real time.</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>People</th>
                <th>Tourist</th>
                <th>Code</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id}>
                  <td>{s.scanned_at?.slice(11, 16) ?? "-"}</td>
                  <td>{s.kind}</td>
                  <td>{s.persons ?? 0}</td>
                  <td>{s.tourist_name ?? "-"}</td>
                  <td>
                    <code>{s.ticket_code ?? "-"}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
