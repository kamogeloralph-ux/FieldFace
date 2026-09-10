import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";

const emptyForm = {
  name: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  taxNumber: "",
  companyRegNumber: "",
  uifEnabled: false,
  uifEmployeeRate: "1.00",
};

export default function EmployerSettingsPage() {
  const employer = trpc.employers.getMine.useQuery();
  const update = trpc.employers.updateMine.useMutation();
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (employer.data) {
      setForm({
        name: employer.data.name ?? "",
        contactEmail: employer.data.contactEmail ?? "",
        contactPhone: employer.data.contactPhone ?? "",
        address: employer.data.address ?? "",
        taxNumber: employer.data.taxNumber ?? "",
        companyRegNumber: employer.data.companyRegNumber ?? "",
        uifEnabled: employer.data.uifEnabled ?? false,
        uifEmployeeRate: employer.data.uifEmployeeRate ?? "1.00",
      });
    }
  }, [employer.data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      ...form,
      uifEmployeeRate: Number(form.uifEmployeeRate),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-5">Company settings</h1>
      <form onSubmit={handleSubmit} className="card max-w-lg space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company details</p>
        <input className="input-field" placeholder="Company name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="input-field" placeholder="Tax number" value={form.taxNumber} onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))} />
          <input className="input-field" placeholder="Company registration number" value={form.companyRegNumber} onChange={(e) => setForm((f) => ({ ...f, companyRegNumber: e.target.value }))} />
        </div>
        <textarea className="input-field" placeholder="Physical address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="input-field" placeholder="Contact office number" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} />
          <input className="input-field" placeholder="Contact email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} />
        </div>

        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-3">Deductions</p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.uifEnabled}
            onChange={(e) => setForm((f) => ({ ...f, uifEnabled: e.target.checked }))}
          />
          Deduct UIF from employee pay
        </label>
        {form.uifEnabled && (
          <div className="flex items-center gap-2">
            <input
              className="input-field w-28"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.uifEmployeeRate}
              onChange={(e) => setForm((f) => ({ ...f, uifEmployeeRate: e.target.value }))}
            />
            <span className="text-sm text-slate-500">% of gross pay, deducted on every payslip</span>
          </div>
        )}

        <button className="btn-primary" type="submit" disabled={update.isPending}>
          {update.isPending ? "Saving..." : saved ? "Saved!" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
