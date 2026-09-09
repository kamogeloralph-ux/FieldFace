import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";

export default function EmployerSettingsPage() {
  const employer = trpc.employers.getMine.useQuery();
  const update = trpc.employers.updateMine.useMutation();
  const [form, setForm] = useState({ name: "", contactEmail: "", contactPhone: "", address: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (employer.data) {
      setForm({
        name: employer.data.name ?? "",
        contactEmail: employer.data.contactEmail ?? "",
        contactPhone: employer.data.contactPhone ?? "",
        address: employer.data.address ?? "",
      });
    }
  }, [employer.data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-5">Employer settings</h1>
      <form onSubmit={handleSubmit} className="card max-w-lg space-y-3">
        <input className="input-field" placeholder="Company name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        <input className="input-field" placeholder="Contact email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} />
        <input className="input-field" placeholder="Contact phone" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} />
        <textarea className="input-field" placeholder="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        <button className="btn-primary" type="submit" disabled={update.isPending}>
          {update.isPending ? "Saving..." : saved ? "Saved!" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
