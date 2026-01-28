"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type GuideSummary = {
  id: string;
  name: string;
};

type AvailabilityItem = {
  date: string;
  guides: GuideSummary[];
};

type AvailabilityResponse = {
  ok: boolean;
  startDate: string;
  endDate: string;
  availability: AvailabilityItem[];
  historyByGuideId?: Record<string, number>;
  error?: string;
};

const toIsoDateLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const parseLocalDate = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map((v) => Number(v));
  return new Date(y, (m || 1) - 1, d || 1);
};

const buildDates = (startIso: string, endIso: string) => {
  const start = parseLocalDate(startIso);
  const end = parseLocalDate(endIso);
  const out: string[] = [];
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    out.push(toIsoDateLocal(d));
  }
  return out;
};

export default function PublishToursPage() {
  const [items, setItems] = useState<AvailabilityItem[]>([]);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [historyByGuideId, setHistoryByGuideId] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [includeAfternoon, setIncludeAfternoon] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [publishing, setPublishing] = useState(false);

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

      const resp = await fetch("/api/publish/availability", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await resp.json()) as AvailabilityResponse;

      if (!resp.ok || !body.ok) {
        setErr(body.error ?? "Failed to load availability.");
        setLoading(false);
        return;
      }

      setItems(body.availability ?? []);
      setRange({ start: body.startDate, end: body.endDate });
      setHistoryByGuideId(body.historyByGuideId ?? {});
      setLoading(false);
    })();
  }, []);

  const dates = useMemo(() => {
    if (!range) return [];
    return buildDates(range.start, range.end);
  }, [range]);

  const slots = useMemo(() => {
    const out: { date: string; time: string }[] = [];
    dates.forEach((date) => {
      out.push({ date, time: "10:30" });
      if (includeAfternoon) {
        out.push({ date, time: "14:00" });
      }
    });
    return out;
  }, [dates, includeAfternoon]);

  const byDate = useMemo(() => {
    const map = new Map<string, GuideSummary[]>();
    items.forEach((item) => {
      map.set(item.date, item.guides);
    });
    return map;
  }, [items]);

  const { selectedBySlot, counts, allGuides, unassignedCount } = useMemo(() => {
    const guideMap = new Map<string, GuideSummary>();
    items.forEach((item) => {
      item.guides.forEach((g) => guideMap.set(g.id, g));
    });

    const baseCounts = new Map<string, number>();
    const baseAssignments = new Map<string, GuideSummary>();
    let unassigned = 0;

    slots.forEach((slot) => {
      const guidesForDate = byDate.get(slot.date) ?? [];
      if (guidesForDate.length === 0) {
        unassigned += 1;
        return;
      }
      let chosen = guidesForDate[0];

      if (guidesForDate.length > 1) {
        chosen = guidesForDate.reduce((best, candidate) => {
          const bestCount = baseCounts.get(best.id) ?? 0;
          const candidateCount = baseCounts.get(candidate.id) ?? 0;
          if (candidateCount < bestCount) return candidate;
          if (candidateCount > bestCount) return best;
          const candidateName = candidate.name ?? "";
          const bestName = best.name ?? "";
          return candidateName.localeCompare(bestName) < 0 ? candidate : best;
        }, chosen);
      }

      baseAssignments.set(`${slot.date} ${slot.time}`, chosen);
      baseCounts.set(chosen.id, (baseCounts.get(chosen.id) ?? 0) + 1);
    });

    const selectedAssignments = new Map<string, GuideSummary>();
    const countsMap = new Map<string, number>();
    slots.forEach((slot) => {
      const key = `${slot.date} ${slot.time}`;
      const guidesForDate = byDate.get(slot.date) ?? [];
      if (guidesForDate.length === 0) return;
      const overrideId = overrides[key];
      const overrideGuide = guidesForDate.find((g) => g.id === overrideId) ?? null;
      const finalGuide = overrideGuide ?? baseAssignments.get(key);
      if (!finalGuide) return;
      selectedAssignments.set(key, finalGuide);
      countsMap.set(finalGuide.id, (countsMap.get(finalGuide.id) ?? 0) + 1);
    });

    const all = Array.from(guideMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return {
      selectedBySlot: selectedAssignments,
      counts: countsMap,
      allGuides: all,
      unassignedCount: unassigned,
    };
  }, [byDate, items, overrides, slots]);

  const onReset = () => {
    setOverrides({});
    setActionMsg(null);
  };

  const onPublish = async () => {
    setErr(null);
    setActionMsg(null);
    if (unassignedCount > 0) {
      setErr(`Cannot publish: ${unassignedCount} unassigned slots.`);
      return;
    }
    setPublishing(true);

    try {
      let token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
      if (!token) {
        const refresh = await supabase.auth.refreshSession();
        if (refresh.error) throw refresh.error;
        token = refresh.data.session?.access_token ?? null;
      }
      if (!token) throw new Error("Not logged in.");

      const payload = slots
        .map((slot) => {
          const key = `${slot.date} ${slot.time}`;
          const guide = selectedBySlot.get(key);
          if (!guide) return null;
          const timeValue = slot.time.length === 5 ? `${slot.time}:00` : slot.time;
          return { date: slot.date, time: timeValue, guide_id: guide.id };
        })
        .filter(Boolean);

      const resp = await fetch("/api/publish/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slots: payload }),
      });
      const body = await resp.json();
      if (!resp.ok || !body.ok) {
        throw new Error(body.error ?? "Failed to publish.");
      }
      setActionMsg(`Published ${body.count ?? payload.length} slots.`);
    } catch (e: any) {
      setErr(e.message ?? "Failed to publish.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Publish new tours</h1>
          <p className="page-subtitle">Availability for next month by day.</p>
        </div>
        <span className="pill">{dates.length} days</span>
      </div>

      {err && <p className="error">{err}</p>}
      {actionMsg && <p className="muted">{actionMsg}</p>}
      {loading && <p className="muted">Loading...</p>}

      <div className="card soft">
        <div className="inline-actions">
          <span className="muted">Publish time</span>
          <button
            type="button"
            className={`button ${includeAfternoon ? "ghost" : ""}`}
            onClick={() => setIncludeAfternoon(false)}
          >
            10:30 only
          </button>
          <button
            type="button"
            className={`button ${includeAfternoon ? "" : "ghost"}`}
            onClick={() => setIncludeAfternoon(true)}
          >
            10:30 + 2:00 pm
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button type="button" className="button ghost" onClick={onReset}>
              Reset
            </button>
            <button
              type="button"
              className="button"
              onClick={onPublish}
              disabled={publishing || unassignedCount > 0}
              title={unassignedCount > 0 ? "Assign all slots before publishing." : undefined}
            >
              {publishing ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
      </div>

      <section className="card soft">
        <div className="page-header">
          <div>
            <h2 className="page-title">
              Proposed distribution{range ? ` for ${new Date(range.start + "T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}` : ""}
            </h2>
            <p className="page-subtitle">Targeting balanced tour counts per guide.</p>
          </div>
          <span className="pill">{allGuides.length} guides</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Guide</th>
                <th>Assigned tours</th>
                <th>History (last 6 months)</th>
              </tr>
            </thead>
            <tbody>
              {allGuides.length === 0 ? (
                <tr>
                  <td colSpan={3}>No available guides</td>
                </tr>
              ) : (
                <>
                  {allGuides.map((g) => (
                    <tr key={g.id}>
                      <td>{g.name}</td>
                      <td>{counts.get(g.id) ?? 0}</td>
                      <td>{historyByGuideId[g.id] ?? 0}</td>
                    </tr>
                  ))}
                  {unassignedCount > 0 && (
                    <tr className="row-warning">
                      <td>Unassigned</td>
                      <td>{unassignedCount}</td>
                      <td>-</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="table-wrap">
        <table className="publish-table">
          <thead>
            <tr>
              <th className="col-date">Date</th>
              <th className="col-time">Time</th>
              <th className="col-proposed">Proposed guide</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => {
              const guidesForDate = byDate.get(slot.date) ?? [];
              const slotKey = `${slot.date} ${slot.time}`;
              const selectedGuide = selectedBySlot.get(slotKey);
              const selectedId = overrides[slotKey] ?? selectedGuide?.id ?? "";
              const selectedName =
                guidesForDate.find((g) => g.id === selectedId)?.name ??
                selectedGuide?.name ??
                "Unassigned";
              return (
                <tr key={slotKey}>
                  <td className="col-date">{slot.date}</td>
                  <td className="col-time">{slot.time}</td>
                  <td className="col-proposed">
                    {guidesForDate.length === 0 ? (
                      "Unassigned"
                    ) : (
                      <select
                        className="input"
                        value={selectedId}
                        onChange={(e) =>
                          setOverrides((prev) => ({
                            ...prev,
                            [slotKey]: e.target.value,
                          }))
                        }
                      >
                        <option value={selectedId}>{selectedName}</option>
                        {guidesForDate
                          .filter((g) => g.id !== selectedId)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                      </select>
                    )}
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
