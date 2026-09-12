import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const LINKS = [
  ["/clock", "Home"],
  ["/schedule", "Schedule"],
  ["/history", "History"],
  ["/payslips", "Payslips"],
  ["/leave", "Leave"],
  ["/sick-notes", "Sick Notes"],
] as const;

export default function EmployeeMenu() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const close = () => setOpen(false);

  return <>
    <button type="button" className="employee-menu-button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}>
      <span /><span /><span />
    </button>
    {open && <button className="employee-drawer-backdrop" aria-label="Close navigation" onClick={close} />}
    <aside className={`employee-drawer ${open ? "is-open" : ""}`} aria-label="Employee navigation">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="font-bold text-lg text-emerald-50">FieldFace</p>
        <button className="employee-close-button" onClick={close} aria-label="Close navigation">×</button>
      </div>
      <nav className="space-y-1">
        {LINKS.map(([to, label]) => <Link key={to} to={to} onClick={close} className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${location.pathname === to ? "bg-emerald-700 text-white" : "text-emerald-100 hover:bg-emerald-800"}`}>{label}</Link>)}
      </nav>
    </aside>
  </>;
}
