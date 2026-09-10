import { useState } from "react";
import { trpc } from "../lib/trpc";

export default function CompaniesPage() {
  const utils = trpc.useUtils();
  const companies = trpc.platform.listCompanies.useQuery();
  const createCompany = trpc.platform.createCompany.useMutation({ onSuccess: () => utils.platform.listCompanies.invalidate() });
  const deleteCompany = trpc.platform.deleteCompany.useMutation({ onSuccess: () => utils.platform.listCompanies.invalidate() });
  const impersonate = trpc.platform.impersonateCompany.useMutation();

  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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
      // Different bundle (main app) - needs a full page navigation to pick up the new session cookie.
      window.location.href = "/company";
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(employerId: string, name: string) {
    if (!confirm(`Delete "${name}"? This permanently removes its sites, employees, time records and payslips.`)) return;
    setBusyId(employerId);
    try {
      await deleteCompany.mutateAsync({ id: employerId });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-1">Companies</h1>
      <p className="text-sm text-slate-500 mb-5">Every company using Fieldface. Manage one directly, or remove it.</p>

      <form onSubmit={handleCreate} className="card flex flex-col sm:flex-row gap-3 mb-5">
        <input
          className="input-field flex-1"
          placeholder="New company name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className="btn-primary sm:w-auto px-4" type="submit" disabled={createCompany.isPending}>
          {createCompany.isPending ? "Adding..." : "+ Add company"}
        </button>
      </form>

      <div className="space-y-2">
        {companies.data?.map((c) => (
          <div key={c.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-800">{c.name}</p>
              <p className="text-xs text-slate-500">
                {c.employeeCount} employee{c.employeeCount === 1 ? "" : "s"} · {c.siteCount} site{c.siteCount === 1 ? "" : "s"}
                {c.contactEmail ? ` · ${c.contactEmail}` : ""}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                className="btn-secondary w-auto px-4 py-2 text-sm"
                onClick={() => handleManage(c.id)}
                disabled={busyId === c.id}
              >
                Manage this company
              </button>
              <button
                className="text-sm text-red-600 underline px-1"
                onClick={() => handleDelete(c.id, c.name)}
                disabled={busyId === c.id}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {companies.data?.length === 0 && (
          <p className="text-sm text-slate-500">No companies yet. Add the first one above.</p>
        )}
      </div>
    </div>
  );
}
