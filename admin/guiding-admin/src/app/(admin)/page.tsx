import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="page">
      <section className="hero">
        <p className="chip">Dashboard</p>
        <h1 className="hero-title">Tour administration</h1>
        <p className="page-subtitle">
          Centralize payments, scans, and access. Track critical flows in one place.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/tours">View payments</Link>
          <Link className="button ghost" href="/allowlist">Manage access</Link>
        </div>
      </section>
      <section className="card">
        <div className="page-header">
          <div>
            <h2 className="page-title">Quick actions</h2>
            <p className="page-subtitle">
              Essential actions to keep operations moving.
            </p>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-value">Payments</div>
            <div className="stat-label">Approve completed tours</div>
          </div>
          <div className="stat">
            <div className="stat-value">Allowlist</div>
            <div className="stat-label">Approve new guides</div>
          </div>
          <div className="stat">
            <div className="stat-value">Push</div>
            <div className="stat-label">Test notifications</div>
          </div>
        </div>
      </section>
    </div>
  );
}
