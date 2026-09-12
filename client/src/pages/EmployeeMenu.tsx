import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const LINKS = [
  ["/schedule", "Schedule"],
  ["/history", "History"],
  ["/payslips", "Payslips"],
  ["/leave", "Leave"],
  ["/sick-notes", "Sick notes"],
] as const;

export default function EmployeeMenu() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return <div className="relative"><button type="button" className="employee-menu-button" onClick={() => setOpen((value) => !value)} aria-label="Open employee menu" aria-expanded={open}><span /><span /><span /></button>{open && <div className="absolute right-0 top-12 z-30 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">{LINKS.map(([to, label]) => <Link key={to} to={to} onClick={() => setOpen(false)} className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${location.pathname === to ? "bg-emerald-50 text-emerald-700" : "text-slate-700 hover:bg-slate-50"}`}>{label}</Link>)}</div>}</div>;
}
