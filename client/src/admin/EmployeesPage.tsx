import { useState } from "react";
import { trpc } from "../lib/trpc";

const emptyForm = {
  employeeCode: "",
  fullName: "",
  idNumber: "",
  phone: "",
  email: "",
  hourlyRateWeekday: "",
  hourlyRateWeekend: "",
  siteId: "",
  pin: "",
};

export default function EmployeesPage() {
  const utils = trpc.useUtils();
  const employees = trpc.employees.list.useQuery();
  const sites = trpc.sites.list.useQuery();
  const createEmployee = trpc.employees.create.useMutation({ onSuccess: () => utils.employees.list.invalidate() });
  const updateEmployee = trpc.employees.update.useMutation({ onSuccess: () => utils.employees.list.invalidate() });
  const resetPin = trpc.employees.resetPin.useMutation();

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createEmployee.mutateAsync({
        employeeCode: form.employeeCode.trim(),
        fullName: form.fullName.trim(),
        idNumber: form.idNumber || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        hourlyRateWeekday: Number(form.hourlyRateWeekday),
        hourlyRateWeekend: Number(form.hourlyRateWeekend),
        siteId: form.siteId || undefined,
        pin: form.pin,
      });
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create employee.");
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-5">Employees</h1>

      <form onSubmit={handleCreate} className="card mb-6 space-y-3">
        <p className="font-semibold text-slate-700">Add an employee</p>
        <div className="grid grid-cols-2 gap-3">
          <input className="input-field" placeholder="Employee code" value={form.employeeCode} onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))} required />
          <input className="input-field" placeholder="Full name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} required />
          <input className="input-field" placeholder="ID number" value={form.idNumber} onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))} />
          <input className="input-field" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <input className="input-field" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <select className="input-field" value={form.siteId} onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}>
            <option value="">No site assigned yet</option>
            {sites.data?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input className="input-field" placeholder="Weekday rate / hr" type="number" step="0.01" value={form.hourlyRateWeekday} onChange={(e) => setForm((f) => ({ ...f, hourlyRateWeekday: e.target.value }))} required />
          <input className="input-field" placeholder="Weekend rate / hr" type="number" step="0.01" value={form.hourlyRateWeekend} onChange={(e) => setForm((f) => ({ ...f, hourlyRateWeekend: e.target.value }))} required />
          <input className="input-field" placeholder="Starting PIN (4-8 digits)" inputMode="numeric" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))} required />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="btn-primary" type="submit" disabled={createEmployee.isPending}>
          {createEmployee.isPending ? "Saving..." : "Add employee"}
        </button>
      </form>

      <div className="space-y-2">
        {employees.data?.map((emp) => (
          <div key={emp.id} className="card flex items-center gap-4">
            <div className="flex-1">
              <p className="font-medium text-slate-800">{emp.fullName} <span className="text-slate-400 font-normal">· {emp.employeeCode}</span></p>
              <p className="text-xs text-slate-500">
                Weekday {'R' + emp.hourlyRateWeekday}/hr · Weekend {'R' + emp.hourlyRateWeekend}/hr
                {!emp.active && <span className="ml-2 text-red-500 font-medium">Inactive</span>}
              </p>
            </div>
            <button
              className="text-sm text-slate-500 underline"
              onClick={() => {
                const newPin = prompt("New PIN for " + emp.fullName + " (4-8 digits):");
                if (newPin) resetPin.mutate({ id: emp.id, newPin });
              }}
            >
              Reset PIN
            </button>
            <button
              className="text-sm text-slate-500 underline"
              onClick={() => updateEmployee.mutate({ id: emp.id, active: !emp.active })}
            >
              {emp.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
