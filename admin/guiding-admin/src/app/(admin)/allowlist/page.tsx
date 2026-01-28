import { supabaseServer } from "@/lib/supabase/server";
import AllowlistForm from "./ui/AllowlistForm";

type AllowlistRow = {
  email: string | null;
  created_at: string | null;
};

export default async function AllowlistPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("invite_allowlist")
    .select("email, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as AllowlistRow[];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Guide allowlist</h1>
          <p className="page-subtitle">
            Quickly approve new access and track recent additions.
          </p>
        </div>
        <span className="pill">{rows.length} active</span>
      </div>

      <section className="card">
        <AllowlistForm />
      </section>

      <section className="card soft">
        <h2 className="page-title">Latest approved emails</h2>
        {rows.length === 0 ? (
          <div className="callout">
            <strong>No emails in the list.</strong>
            <span className="muted">
              Add the first access using the form above.
            </span>
          </div>
        ) : (
          <ul className="list">
            {rows.map((r) => (
              <li key={r.email}>{r.email}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
