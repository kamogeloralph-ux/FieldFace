import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";

export type EmployeeFormValues = {
  employeeCode: string;
  fullName: string;
  idNumber: string;
  taxNumber: string;
  physicalAddress: string;
  phone: string;
  email: string;
  hourlyRateWeekday: string;
  hourlyRateWeekend: string;
  siteId: string;
  pin: string;
};

const emptyForm: EmployeeFormValues = {
  employeeCode: "",
  fullName: "",
  idNumber: "",
  taxNumber: "",
  physicalAddress: "",
  phone: "",
  email: "",
  hourlyRateWeekday: "",
  hourlyRateWeekend: "",
  siteId: "",
  pin: "",
};

export type EditingEmployee = {
  id: string;
  employeeCode: string;
  fullName: string;
  idNumber: string | null;
  taxNumber: string | null;
  physicalAddress: string | null;
  phone: string | null;
  email: string | null;
  hourlyRateWeekday: string;
  hourlyRateWeekend: string;
  siteId: string | null;
};

export default function EmployeeFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: EditingEmployee | null;
}) {
  const utils = trpc.useUtils();
  const sites = trpc.sites.list.useQuery();
  const createEmployee = trpc.employees.create.useMutation({ onSuccess: () => utils.employees.list.invalidate() });
  const updateEmployee = trpc.employees.update.useMutation({ onSuccess: () => utils.employees.list.invalidate() });

  const [form, setForm] = useState<EmployeeFormValues>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setForm({
        employeeCode: editing.employeeCode,
        fullName: editing.fullName,
        idNumber: editing.idNumber ?? "",
        taxNumber: editing.taxNumber ?? "",
        physicalAddress: editing.physicalAddress ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        hourlyRateWeekday: editing.hourlyRateWeekday,
        hourlyRateWeekend: editing.hourlyRateWeekend,
        siteId: editing.siteId ?? "",
        pin: "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, editing]);

  if (!open) return null;

  const isEditing = !!editing;
  const saving = createEmployee.isPending || updateEmployee.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEditing && editing) {
        await updateEmployee.mutateAsync({
          id: editing.id,
          employeeCode: form.employeeCode.trim(),
          fullName: form.fullName.trim(),
          idNumber: form.idNumber || undefined,
          taxNumber: form.taxNumber || undefined,
          physicalAddress: form.physicalAddress || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          hourlyRateWeekday: Number(form.hourlyRateWeekday),
          hourlyRateWeekend: Number(form.hourlyRateWeekend),
          siteId: form.siteId || null,
        });
      } else {
        await createEmployee.mutateAsync({
          employeeCode: form.employeeCode.trim(),
          fullName: form.fullName.trim(),
          idNumber: form.idNumber || undefined,
          taxNumber: form.taxNumber || undefined,
          physicalAddress: form.physicalAddress || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          hourlyRateWeekday: Number(form.hourlyRateWeekday),
          hourlyRateWeekend: Number(form.hourlyRateWeekend),
          siteId: form.siteId || undefined,
          pin: form.pin,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save employee.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-800">{isEditing ? "Edit employee" : "Add an employee"}</h2>
        <button type="button" aria-label="Close" className="p-1 text-slate-500" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto p-4 space-y-4 pb-24">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Employee number
          </label>
          <input
            className="input-field font-semibold"
            placeholder="Employee number"
            value={form.employeeCode}
            onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="input-field" placeholder="Full name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} required />
          <input className="input-field" placeholder="ID number" value={form.idNumber} onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))} />
          <input className="input-field" placeholder="Tax number" value={form.taxNumber} onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))} />
          <input className="input-field" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <input className="input-field" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <select className="input-field" value={form.siteId} onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}>
            <option value="">No site assigned yet</option>
            {sites.data?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <textarea
          className="input-field"
          placeholder="Physical address"
          value={form.physicalAddress}
          onChange={(e) => setForm((f) => ({ ...f, physicalAddress: e.target.value }))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="input-field" placeholder="Weekday rate / hr" type="number" step="0.01" value={form.hourlyRateWeekday} onChange={(e) => setForm((f) => ({ ...f, hourlyRateWeekday: e.target.value }))} required />
          <input className="input-field" placeholder="Weekend rate / hr" type="number" step="0.01" value={form.hourlyRateWeekend} onChange={(e) => setForm((f) => ({ ...f, hourlyRateWeekend: e.target.value }))} required />
          {!isEditing && (
            <input
              className="input-field"
              placeholder="Starting PIN (4-8 digits)"
              inputMode="numeric"
              value={form.pin}
              onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
              required
            />
          )}
        </div>

        {isEditing && (
          <p className="text-xs text-slate-500">
            To change this employee's PIN, use "Reset PIN" from the employee list instead.
          </p>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
          <div className="max-w-xl mx-auto flex gap-3">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Save changes" : "Add employee"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
