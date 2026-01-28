"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkPaidButton({ paymentId }: { paymentId: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onClick() {
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch("/api/payments/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: paymentId }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Failed");
      router.refresh(); // SSR refresh
    } catch (e: any) {
      setErr(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button danger" disabled={loading} onClick={onClick}>
        {loading ? "Marking..." : "Mark paid"}
      </button>
      {err && <p className="error mt-xs">{err}</p>}
    </div>
  );
}
