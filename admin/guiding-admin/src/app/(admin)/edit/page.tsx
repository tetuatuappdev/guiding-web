"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type GuideSummary = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type SlotRow = {
  id: string;
  slot_date: string;
  slot_time: string;
  guide_id: string | null;
};

type ApiResponse = {
  ok: boolean;
  startDate: string;
  endDate: string;
  slots: SlotRow[];
  guides: GuideSummary[];
  error?: string;
};

const formatGuideName = (g: GuideSummary) => {
  const first = (g.first_name ?? "").trim();
  const last = (g.last_name ?? "").trim();
  const full = `${first} ${last}`.trim();
  return full || `Guide ${g.id.slice(0, 6)}`;
};

export default function EditCurrentMonthPage() {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [guides, setGuides] = useState<GuideSummary[]>([]);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);
      let token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
      if (!token) {
        const refresh = await supabase.auth.refreshSession();
        if (refresh.error) {
          setErr(refresh.error.message);
          setLoading(false);
          return;
        }
        token = refresh.data.session?.access_token ?? null;
      }
      if (!token) {
        setErr("Not logged in.");
        setLoading(false);
        return;
      }

      const resp = await fetch("/api/edit-schedule/current", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await resp.json()) as ApiResponse;
      if (!resp.ok || !body.ok) {
        setErr(body.error ?? "Failed to load schedule.");
        setLoading(false);
        return;
      }

      setSlots(body.slots ?? []);
      setGuides(body.guides ?? []);
      setRange({ start: body.startDate, end: body.endDate });
      setLoading(false);
    })();
  }, []);

  const guideOptions = useMemo(
    () =>
      (guides ?? [])
        .map((g) => ({ id: g.id, name: formatGuideName(g) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [guides]
  );

  const onReset = () => {
    setOverrides({});
    setMsg(null);
  };

  const onUpdate = async () => {
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      let token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
      if (!token) {
        const refresh = await supabase.auth.refreshSession();
        if (refresh.error) throw refresh.error;
        token = refresh.data.session?.access_token ?? null;
      }
      if (!token) throw new Error("Not logged in.");

      const updates = slots.map((slot) => ({
        id: slot.id,
        guide_id: overrides[slot.id] ?? slot.guide_id,
      }));

      const resp = await fetch("/api/edit-schedule/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ updates }),
      });
      const body = await resp.json();
      if (!resp.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to update schedule.");
      }
      const updatedMap = new Map(
        updates.map((u) => [u.id, u.guide_id ?? null])
      );
      setSlots((prev) =>
        prev.map((slot) => ({
          ...slot,
          guide_id: updatedMap.get(slot.id) ?? slot.guide_id,
        }))
      );
      setMsg("Schedule updated.");
      setOverrides({});
    } catch (e: any) {
      setErr(e.message ?? "Failed to update schedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Edit current month</h1>
          <p className="page-subtitle">Update planned tours for the current month.</p>
        </div>
        <span className="pill">{slots.length} tours</span>
      </div>

      {err && <p className="error">{err}</p>}
      {msg && <p className="muted">{msg}</p>}
      {loading && <p className="muted">Loading...</p>}

      <div className="card soft">
        <div className="inline-actions">
          <span className="muted">
            {range
              ? `For ${new Date(range.start + "T00:00:00").toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}`
              : "Current month"}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button type="button" className="button ghost" onClick={onReset}>
              Reset
            </button>
            <button type="button" className="button" onClick={onUpdate} disabled={saving}>
              {saving ? "Updating..." : "Update"}
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="publish-table">
          <thead>
            <tr>
              <th className="col-date">Date</th>
              <th className="col-time">Time</th>
              <th className="col-proposed">Assigned guide</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => {
              const selectedId = overrides[slot.id] ?? slot.guide_id ?? "";
              const selectedName =
                guideOptions.find((g) => g.id === selectedId)?.name ?? "Unassigned";
              return (
                <tr key={slot.id}>
                  <td className="col-date">{slot.slot_date}</td>
                  <td className="col-time">{String(slot.slot_time || "").slice(0, 5)}</td>
                  <td className="col-proposed">
                    <select
                      className="input"
                      value={selectedId}
                      onChange={(e) =>
                        setOverrides((prev) => ({
                          ...prev,
                          [slot.id]: e.target.value,
                        }))
                      }
                    >
                      <option value={selectedId}>{selectedName}</option>
                      {guideOptions
                        .filter((g) => g.id !== selectedId)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
