import Link from "next/link";
import AdminGuard from "./AdminGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">GA</span>
            Guiding Admin
          </div>
          <nav className="nav">
            <Link className="nav-link" href="/tours">
              Payments
              <span className="nav-pill">Tours</span>
            </Link>
            <Link className="nav-link" href="/allowlist">
              Allowlist
              <span className="nav-pill">Access</span>
            </Link>
            <Link className="nav-link" href="/publish">
              Publish new tours
              <span className="nav-pill">Next month</span>
            </Link>
            <Link className="nav-link" href="/edit">
              Edit current month
              <span className="nav-pill">Planned</span>
            </Link>
          </nav>
        </aside>
        <main className="shell-main">{children}</main>
      </div>
    </AdminGuard>
  );
}
