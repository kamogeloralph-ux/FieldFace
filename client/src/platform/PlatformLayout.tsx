import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { trpc } from "../lib/trpc";
import BrandLogo from "../components/BrandLogo";

const NAV = [
  { to: "/", label: "Companies", end: true },
  { to: "/support", label: "Client Support", end: true },
];

export default function PlatformLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const me = trpc.platform.me.useQuery();
  const logout = trpc.platform.logout.useMutation();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return <div className="app-wallpaper min-h-screen platform-shell">
    {menuOpen && <button className="platform-drawer-backdrop" aria-label="Close navigation" onClick={closeMenu} />}
    <aside className={`platform-sidebar ${menuOpen ? "is-open" : ""}`}>
      <div className="mb-6 flex items-center justify-between gap-3"><div><BrandLogo inverse className="h-7" /><p className="text-xs text-emerald-300 mt-2">Owner platform</p></div><button className="platform-close-button" onClick={closeMenu} aria-label="Close navigation">×</button></div>
      <nav className="space-y-1">{NAV.map((item) => item.label === "Companies" ? <button key={item.to} type="button" onClick={() => window.location.assign("/admin.html/")} className="w-full text-left block rounded-lg px-3 py-2 text-sm font-medium transition text-emerald-100 hover:bg-emerald-800">Companies</button> : <NavLink key={item.to} to={item.to} end={item.end} onClick={closeMenu} className={({ isActive }) => `block rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-emerald-700 text-white" : "text-emerald-100 hover:bg-emerald-800"}`}>{item.label}</NavLink>)}</nav>
      <div className="pt-4 mt-6 border-t border-emerald-800"><p className="text-xs text-emerald-300 mb-2">{me.data?.fullName}</p><a href="/policy" className="text-sm text-emerald-200 underline block mb-2">Policy</a><button className="text-sm text-emerald-200 underline" onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login") })}>Log out</button></div>
    </aside>
    <div className="platform-content-shell"><header className="platform-mobile-header"><button className="platform-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen}><span /><span /><span /></button><div><BrandLogo className="h-7" /><p className="text-xs text-slate-500 mt-1">Owner platform</p></div><span /></header><main className="p-4 sm:p-6 max-w-4xl mx-auto"><Outlet /></main></div>
  </div>;
}
