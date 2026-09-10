import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";

const NAV = [
  { to: "/", label: "Daily Report", end: true },
  { to: "/employees", label: "Employees" },
  { to: "/sites", label: "Sites" },
  { to: "/payslips", label: "Payslips" },
  { to: "/employer", label: "Employer Settings" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const me = trpc.auth.adminMe.useQuery();
  const logout = trpc.auth.adminLogout.useMutation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const currentLabel = NAV.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)))?.label ?? "";

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-emerald-900 text-emerald-50 px-4 py-3">
        <button
          aria-label="Open menu"
          className="p-1 -ml-1"
          onClick={() => setMenuOpen(true)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <p className="font-semibold text-sm">{currentLabel || "Fieldface"}</p>
        <div className="w-6" />
      </div>

      {/* Backdrop for mobile drawer */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shrink-0 bg-emerald-900 text-emerald-50 flex flex-col p-4 transition-transform duration-200 ease-out
          lg:static lg:z-auto lg:w-56 lg:max-w-none lg:translate-x-0
          ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <img src="/fieldface-logo-white.png" alt="Fieldface" className="h-6 w-auto mb-1" />
            <p className="text-xs text-emerald-300">{me.data?.employer?.name}</p>
          </div>
          <button
            aria-label="Close menu"
            className="p-1 lg:hidden"
            onClick={() => setMenuOpen(false)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
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
          <button
            className="text-sm text-emerald-200 underline"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login") })}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 lg:p-6 lg:max-w-5xl">
        <Outlet />
      </main>
    </div>
  );
}
