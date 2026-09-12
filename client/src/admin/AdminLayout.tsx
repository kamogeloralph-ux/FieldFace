import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { trpc } from "../lib/trpc";

const NAV = [
  { to: "/company", label: "Home", end: true },
  { to: "/company/employees", label: "Employees" },
  { to: "/company/sites", label: "Sites" },
  { to: "/company/payslips", label: "Payslips" },
  { to: "/company/leave", label: "Leave Requests" },
  { to: "/company/sick-notes", label: "Sick Notes" },
  { to: "/company/schedule", label: "Schedule" },
  { to: "/company/employer", label: "Employer Settings" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const me = trpc.auth.adminMe.useQuery();
  const logout = trpc.auth.adminLogout.useMutation();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="admin-shell app-wallpaper min-h-screen">
      {menuOpen && <button className="admin-drawer-backdrop" aria-label="Close navigation" onClick={closeMenu} />}
      <aside className={`admin-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-lg">FieldFace</p>
            <button className="admin-close-button" onClick={closeMenu} aria-label="Close navigation">×</button>
          </div>
          <p className="text-xs text-emerald-300">{me.data?.employer?.name}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeMenu}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-emerald-700 text-white" : "text-emerald-100 hover:bg-emerald-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="pt-4 border-t border-emerald-800">
          <p className="text-xs text-emerald-300 mb-2">{me.data?.fullName}</p>
          <a href="/policy" className="text-sm text-emerald-200 underline block mb-2">Client policy</a>
          <button
            className="text-sm text-emerald-200 underline"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/company/login") })}
          >
            Log out
          </button>
        </div>
      </aside>
      <div className="admin-content-shell">
        <header className="admin-mobile-header">
          <button className="admin-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
            <span />
            <span />
            <span />
          </button>
          <div>
            <p className="font-bold text-emerald-900">FieldFace</p>
            <p className="text-xs text-slate-500">{me.data?.employer?.name}</p>
          </div>
        </header>
        <main className="admin-main">
        <Outlet />
        </main>
      </div>
    </div>
  );
}
