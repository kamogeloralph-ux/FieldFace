import { useEffect, useState } from "react";
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

type CompanyForm = {
  name: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  taxNumber: string;
  companyRegNumber: string;
  uifEnabled: boolean;
  uifEmployeeRate: string;
  uifEmployerRate: string;
};

const emptyForm: CompanyForm = {
  name: "", contactEmail: "", contactPhone: "", address: "", taxNumber: "", companyRegNumber: "",
  uifEnabled: false, uifEmployeeRate: "1.00", uifEmployerRate: "1.00",
};

export default function CompaniesPage() {
  const utils = trpc.useUtils();
  const companies = trpc.platform.listCompanies.useQuery();
  const createCompany = trpc.platform.createCompany.useMutation({ onSuccess: () => utils.platform.listCompanies.invalidate() });
  const updateCompany = trpc.platform.updateCompany.useMutation({ onSuccess: () => utils.platform.listCompanies.invalidate() });
  const mergeCompanyData = trpc.platform.mergeCompanyData.useMutation({ onSuccess: () => { utils.platform.listCompanies.invalidate(); employees.refetch(); } });
  const adoptUnlinkedData = trpc.platform.adoptUnlinkedData.useMutation({ onSuccess: () => { utils.platform.listCompanies.invalidate(); employees.refetch(); } });
  const deleteCompany = trpc.platform.deleteCompany.useMutation({ onSuccess: () => utils.platform.listCompanies.invalidate() });
  const impersonate = trpc.platform.impersonateCompany.useMutation();
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState("");
  const employees = trpc.platform.listCompanyEmployees.useQuery(
    { employerId: selected?.id ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: !!selected },
  );
  const updateRates = trpc.employees.updateRates.useMutation({ onSuccess: () => employees.refetch() });
  const updateActive = trpc.employees.updateActive.useMutation({ onSuccess: () => employees.refetch() });

  useEffect(() => {
    if (!selected) return;
    setForm({
      name: selected.name,
      contactEmail: selected.contactEmail ?? "",
      contactPhone: selected.contactPhone ?? "",
      address: selected.address ?? "",
      taxNumber: selected.taxNumber ?? "",
      companyRegNumber: selected.companyRegNumber ?? "",
      uifEnabled: selected.uifEnabled,
      uifEmployeeRate: selected.uifEmployeeRate ?? "1.00",
      uifEmployerRate: selected.uifEmployerRate ?? "1.00",
    });
  }, [selected]);

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
      window.location.assign("/company");
    } catch (error) {
      setBusyId(null);
      alert(error instanceof Error ? error.message : "Could not open the company dashboard.");
    }
  }

  async function saveCompany() {
    if (!selected || !form.name.trim()) return;
    await updateCompany.mutateAsync({
      id: selected.id,
      ...form,
      name: form.name.trim(),
      contactEmail: form.contactEmail || undefined,
      uifEmployeeRate: Number(form.uifEmployeeRate),
      uifEmployerRate: Number(form.uifEmployerRate),
    });
    setSelected({ ...selected, ...form, name: form.name.trim() });
  }

  function setField<K extends keyof CompanyForm>(field: K, value: CompanyForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3"><h1 className="text-xl font-bold text-slate-800 mb-1">Companies</h1><button type="button" className="btn-secondary w-auto px-3 py-2 text-sm" onClick={() => companies.refetch()} disabled={companies.isFetching}>{companies.isFetching ? "Refreshing..." : "Refresh counts"}</button></div>
      <p className="text-sm text-slate-500 mb-5">Create companies and edit their complete settings here. Company management users remain read-only for these settings.</p>

      <form onSubmit={handleCreate} className="card flex flex-col sm:flex-row gap-3 mb-5">
        <input className="input-field flex-1" placeholder="New company name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn-primary sm:w-auto px-4" type="submit" disabled={createCompany.isPending}>{createCompany.isPending ? "Adding..." : "+ Add company"}</button>
      </form>

      <div className="space-y-2">
        {companies.data?.map((c) => (
          <div key={c.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold text-slate-800">{c.name}</p><p className="text-xs text-slate-500">{c.employeeCount} employee{c.employeeCount === 1 ? "" : "s"} · {c.siteCount} site{c.siteCount === 1 ? "" : "s"}{c.contactEmail ? ` · ${c.contactEmail}` : ""}</p></div>
            <div className="flex flex-wrap gap-3">
              <button className="btn-secondary w-auto px-4 py-2 text-sm" onClick={() => setSelected(c)}>Edit company and rates</button>
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
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2"><p className="text-sm font-semibold text-amber-900">Company data appears under another record?</p><p className="text-xs text-amber-800">Merge sites, employees, payslips, and management users from a duplicate company record into this one. The source company is kept for audit purposes.</p><div className="flex flex-col sm:flex-row gap-2"><select className="input-field flex-1" value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)}><option value="">Select duplicate company...</option>{companies.data?.filter((c) => c.id !== selected.id).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.employeeCount} employees · {c.siteCount} sites</option>)}</select><button type="button" className="btn-secondary w-auto px-3" disabled={!mergeSourceId || mergeCompanyData.isPending} onClick={async () => { if (confirm("Move the selected company's sites, employees, payslips, and management users into this company?")) { await mergeCompanyData.mutateAsync({ targetEmployerId: selected.id, sourceEmployerId: mergeSourceId }); setMergeSourceId(""); } }}>{mergeCompanyData.isPending ? "Merging..." : "Merge data"}</button></div>{mergeCompanyData.error && <p className="text-xs text-red-600">{mergeCompanyData.error.message}</p>}</div>
            <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-600 mb-2">If legacy rows have no valid company link, adopt them into this company.</p><button type="button" className="btn-secondary w-auto px-3 py-2 text-sm" disabled={adoptUnlinkedData.isPending} onClick={async () => { if (confirm("Adopt all unlinked legacy sites, employees, and payslips into this company?")) await adoptUnlinkedData.mutateAsync({ employerId: selected.id }); }}>{adoptUnlinkedData.isPending ? "Checking..." : "Adopt unlinked data"}</button></div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company details</p>
              <input className="input-field" placeholder="Company name" value={form.name} onChange={(e) => setField("name", e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input className="input-field" placeholder="Tax number" value={form.taxNumber} onChange={(e) => setField("taxNumber", e.target.value)} /><input className="input-field" placeholder="Company registration number" value={form.companyRegNumber} onChange={(e) => setField("companyRegNumber", e.target.value)} /></div>
              <textarea className="input-field" placeholder="Physical address" value={form.address} onChange={(e) => setField("address", e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input className="input-field" placeholder="Contact phone" value={form.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} /><input className="input-field" placeholder="Contact email" value={form.contactEmail} onChange={(e) => setField("contactEmail", e.target.value)} /></div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 pt-2">Deductions</p>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.uifEnabled} onChange={(e) => setField("uifEnabled", e.target.checked)} /> Deduct UIF from employee pay</label>
              {form.uifEnabled && <div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-500">Employee rate %<input className="input-field mt-1" type="number" min="0" max="100" step="0.01" value={form.uifEmployeeRate} onChange={(e) => setField("uifEmployeeRate", e.target.value)} /></label><label className="text-xs text-slate-500">Employer rate %<input className="input-field mt-1" type="number" min="0" max="100" step="0.01" value={form.uifEmployerRate} onChange={(e) => setField("uifEmployerRate", e.target.value)} /></label></div>}
              <button className="btn-primary" onClick={saveCompany} disabled={updateCompany.isPending}>{updateCompany.isPending ? "Saving..." : "Save company settings"}</button>
            </div>
            <div><h3 className="font-semibold text-slate-800 mb-2">Employee rates and activation</h3><p className="text-xs text-slate-500 mb-2">Only the platform administrator can deactivate or reactivate employees.</p><div className="space-y-2">{employees.data?.map((emp) => <RateRow key={emp.id} employee={emp} onSave={(weekday, weekend) => updateRates.mutate({ id: emp.id, hourlyRateWeekday: weekday, hourlyRateWeekend: weekend })} onToggle={() => updateActive.mutate({ id: emp.id, active: !emp.active })} />)}{employees.data?.length === 0 && <p className="text-sm text-slate-500">No employees yet.</p>}</div></div>
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
