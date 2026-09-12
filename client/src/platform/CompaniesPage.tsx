import { useState } from "react";
import { trpc } from "../lib/trpc";

type Company = {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  taxNumber: string | null;
  companyRegNumber: string | null;
  uifEnabled: boolean;
  uifEmployeeRate: string;
  uifEmployerRate: string;
  employeeCount: number;
  siteCount: number;
};

export default function CompaniesPage() {
  const utils = trpc.useUtils();
  const companies = trpc.platform.listCompanies.useQuery();
  const createCompany = trpc.platform.createCompany.useMutation({ onSuccess: () => utils.platform.listCompanies.invalidate() });
  const deleteCompany = trpc.platform.deleteCompany.useMutation({ onSuccess: () => utils.platform.listCompanies.invalidate() });
  const impersonate = trpc.platform.impersonateCompany.useMutation();
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<Company | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const employees = trpc.platform.listCompanyEmployees.useQuery(
    { employerId: selected?.id ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: !!selected },
  );
  const updateRates = trpc.employees.updateRates.useMutation({ onSuccess: () => employees.refetch() });
  const updateActive = trpc.employees.updateActive.useMutation({ onSuccess: () => employees.refetch() });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await createCompany.mutateAsync({ name: newName.trim() });
    setNewName("");
  }

  async function handleManage(employerId: string) {
    setBusyId(employerId);
    try {
      await impersonate.mutateAsync({ employerId });
      window.location.assign("/company/employer");
    } catch (error) {
      setBusyId(null);
      alert(error instanceof Error ? error.message : "Could not open the company dashboard.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3"><h1 className="text-xl font-bold text-slate-800 mb-1">Companies</h1><button type="button" className="btn-secondary w-auto px-3 py-2 text-sm" onClick={() => companies.refetch()} disabled={companies.isFetching}>{companies.isFetching ? "Refreshing..." : "Refresh counts"}</button></div>
      <p className="text-sm text-slate-500 mb-5">Create companies here, manage company details through Manage this company, and update employee rates below.</p>

      <form onSubmit={handleCreate} className="card flex flex-col sm:flex-row gap-3 mb-5">
        <input className="input-field flex-1" placeholder="New company name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn-primary sm:w-auto px-4" type="submit" disabled={createCompany.isPending}>{createCompany.isPending ? "Adding..." : "+ Add company"}</button>
      </form>

      <div className="space-y-2">
        {companies.data?.map((c) => (
          <div key={c.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold text-slate-800">{c.name}</p><p className="text-xs text-slate-500">{c.employeeCount} employee{c.employeeCount === 1 ? "" : "s"} · {c.siteCount} site{c.siteCount === 1 ? "" : "s"}{c.contactEmail ? ` · ${c.contactEmail}` : ""}</p></div>
            <div className="flex flex-wrap gap-3">
              <button className="btn-secondary w-auto px-4 py-2 text-sm" onClick={() => setSelected(c)}>Edit employee rates</button>
              <button type="button" className="btn-secondary w-auto px-4 py-2 text-sm" onClick={() => void handleManage(c.id)} disabled={busyId === c.id || impersonate.isPending} aria-busy={busyId === c.id}>
                {busyId === c.id ? "Opening..." : "Manage this company"}
              </button>
              <button className="text-sm text-red-600 underline px-1" onClick={async () => { if (confirm(`Delete "${c.name}"? This permanently removes its sites, employees, time records and payslips.`)) await deleteCompany.mutateAsync({ id: c.id }); }} disabled={busyId === c.id}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/30 p-4 overflow-y-auto" onClick={() => setSelected(null)}>
          <div className="card max-w-2xl mx-auto mt-8 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center"><div><h2 className="text-lg font-bold text-slate-800">Administrator edits</h2><p className="text-xs text-slate-500">Only the platform administrator can save these settings.</p></div><button className="text-slate-500 text-xl" onClick={() => setSelected(null)}>×</button></div>
            <div><h3 className="font-semibold text-slate-800 mb-2">Employee rates and activation</h3><p className="text-xs text-slate-500 mb-2">Only employee rates and activation are managed here. Company information is available through Manage this company.</p><div className="space-y-2">{employees.data?.map((emp) => <RateRow key={emp.id} employee={emp} onSave={(weekday, weekend) => updateRates.mutate({ id: emp.id, hourlyRateWeekday: weekday, hourlyRateWeekend: weekend })} onToggle={() => updateActive.mutate({ id: emp.id, active: !emp.active })} />)}{employees.data?.length === 0 && <p className="text-sm text-slate-500">No employees yet.</p>}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

function RateRow({ employee, onSave, onToggle }: { employee: { id: string; fullName: string; active: boolean; hourlyRateWeekday: string; hourlyRateWeekend: string }; onSave: (weekday: number, weekend: number) => void; onToggle: () => void }) {
  const [weekday, setWeekday] = useState(employee.hourlyRateWeekday);
  const [weekend, setWeekend] = useState(employee.hourlyRateWeekend);
  return <div className="flex flex-col sm:flex-row sm:items-center gap-2 border border-slate-100 rounded-lg p-3"><span className="flex-1 font-medium text-slate-700">{employee.fullName} {!employee.active && <span className="text-xs text-red-500">Inactive</span>}</span><input className="input-field sm:w-32" type="number" step="0.01" value={weekday} onChange={(e) => setWeekday(e.target.value)} aria-label={`${employee.fullName} weekday rate`} /><input className="input-field sm:w-32" type="number" step="0.01" value={weekend} onChange={(e) => setWeekend(e.target.value)} aria-label={`${employee.fullName} weekend rate`} /><button className="btn-secondary w-auto px-3 py-2 text-sm" onClick={() => onSave(Number(weekday), Number(weekend))}>Save rates</button><button className="text-sm text-slate-500 underline px-2" onClick={onToggle}>{employee.active ? "Deactivate" : "Activate"}</button></div>;
}
