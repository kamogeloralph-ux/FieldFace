import { useState } from "react";
import { trpc } from "../lib/trpc";

type Company = {
  id: string;
  name: string;
  companyCode: string | null;
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
  const createManager = trpc.platform.createManager.useMutation();
  const deleteCompany = trpc.platform.deleteCompany.useMutation({ onSuccess: () => utils.platform.listCompanies.invalidate() });
  const impersonate = trpc.platform.impersonateCompany.useMutation();
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<Company | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [managerCompanyId, setManagerCompanyId] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerIdNumber, setManagerIdNumber] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [managerAddress, setManagerAddress] = useState("");
  const [managerUsername, setManagerUsername] = useState<string | null>(null);
  const [managerActivationCode, setManagerActivationCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const employees = trpc.platform.listCompanyEmployees.useQuery(
    { employerId: selected?.id ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: !!selected },
  );
  const managers = trpc.platform.listCompanyManagers.useQuery(
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

  async function handleCreateManager(e: React.FormEvent) {
    e.preventDefault();
    if (!managerCompanyId || !managerName.trim() || !managerEmail.trim() || !managerIdNumber.trim() || !managerPhone.trim() || !managerAddress.trim()) return;
    const result = await createManager.mutateAsync({ employerId: managerCompanyId, fullName: managerName.trim(), email: managerEmail.trim(), idNumber: managerIdNumber.trim(), phone: managerPhone.trim(), physicalAddress: managerAddress.trim() });
    setManagerName("");
    setManagerEmail("");
    setManagerIdNumber("");
    setManagerPhone("");
    setManagerAddress("");
    setManagerUsername(result.username);
    setManagerActivationCode(result.activationCode);
    if (selected?.id === managerCompanyId) await managers.refetch();
  }

  async function copyValue(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function handleManage(employerId: string) {
    setBusyId(employerId);
    try {
      await Promise.race([
        impersonate.mutateAsync({ employerId }),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Opening the company dashboard timed out. Please try again.")), 15000)),
      ]);
      setBusyId(null);
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

      <form onSubmit={handleCreateManager} className="card max-w-2xl space-y-3 mb-5">
        <div><p className="font-semibold text-slate-800">Add company manager</p><p className="text-xs text-slate-500 mt-1">The manager username is generated automatically from the company name. Complete personal information is required.</p></div>
        <select className="input-field" value={managerCompanyId} onChange={(e) => setManagerCompanyId(e.target.value)} required><option value="">Select company</option>{companies.data?.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.companyCode ?? "code pending"}</option>)}</select>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><input className="input-field" placeholder="Full name" value={managerName} onChange={(e) => setManagerName(e.target.value)} required /><input className="input-field" type="email" placeholder="Email address" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} required /><input className="input-field" placeholder="ID number" value={managerIdNumber} onChange={(e) => setManagerIdNumber(e.target.value)} required /><input className="input-field" placeholder="Phone number" value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} required /></div>
        <textarea className="input-field" placeholder="Physical address" value={managerAddress} onChange={(e) => setManagerAddress(e.target.value)} required />
        {createManager.error && <p className="text-sm text-red-600">{createManager.error.message}</p>}
        {managerActivationCode && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">Manager activation details</p><p className="mt-1">Username: <strong>{managerUsername}</strong></p><div className="flex items-center gap-2 mt-1"><p className="font-mono text-lg tracking-widest">{managerActivationCode}</p><button type="button" className="btn-secondary w-auto px-2 py-1 text-xs" onClick={() => void copyValue("manager-code", managerActivationCode)}>{copied === "manager-code" ? "Copied" : "Copy"}</button></div><p className="text-xs mt-1">Give the username, activation code, and company code to the manager. They activate at <strong>/company/activate</strong>. It expires in 48 hours and can be used once.</p></div>}
        <button className="btn-secondary sm:w-auto px-4" type="submit" disabled={createManager.isPending}>{createManager.isPending ? "Creating..." : "Create manager login"}</button>
      </form>

      <div className="space-y-2">
        {companies.data?.map((c) => (
          <div key={c.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold text-slate-800">{c.name}</p><div className="flex items-center gap-2 mt-1"><p className="text-xs font-semibold text-emerald-700">Company code: {c.companyCode ?? "Pending"}</p>{c.companyCode && <button type="button" className="btn-secondary w-auto px-2 py-1 text-xs" onClick={() => void copyValue(`company-${c.id}`, c.companyCode!)}>{copied === `company-${c.id}` ? "Copied" : "Copy"}</button>}</div><p className="text-xs text-slate-500">{c.employeeCount} employee{c.employeeCount === 1 ? "" : "s"} · {c.siteCount} site{c.siteCount === 1 ? "" : "s"}{c.contactEmail ? ` · ${c.contactEmail}` : ""}</p></div>
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
            <div><h3 className="font-semibold text-slate-800 mb-2">Company managers</h3><p className="text-xs text-slate-500 mb-2">Manager profiles remain attached to this company and receive company-prefixed usernames.</p><div className="space-y-2">{managers.data?.map((manager) => <div key={manager.id} className="rounded-lg border border-slate-100 p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium text-slate-800">{manager.fullName}</p><span className="text-xs font-semibold text-emerald-700">{manager.username}</span></div><p className="text-xs text-slate-500 mt-1">{manager.email} · {manager.phone ?? "No phone"} · {manager.role}</p><p className="text-xs text-slate-500 mt-1">ID: {manager.idNumber ?? "Not provided"} · {manager.physicalAddress ?? "No address"}</p></div>)}{managers.data?.length === 0 && <p className="text-sm text-slate-500">No managers yet.</p>}</div></div><div><h3 className="font-semibold text-slate-800 mb-2">Employee rates and activation</h3><p className="text-xs text-slate-500 mb-2">Only employee rates and activation are managed here. Company information is available through Manage this company.</p><div className="space-y-2">{employees.data?.map((emp) => <RateRow key={emp.id} employee={emp} onSave={(weekday, weekend) => updateRates.mutate({ id: emp.id, hourlyRateWeekday: weekday, hourlyRateWeekend: weekend })} onToggle={() => updateActive.mutate({ id: emp.id, active: !emp.active })} />)}{employees.data?.length === 0 && <p className="text-sm text-slate-500">No employees yet.</p>}</div></div>
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
