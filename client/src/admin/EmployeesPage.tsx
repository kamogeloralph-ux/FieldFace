import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";
import EmployeeFormModal, { type EditingEmployee } from "./EmployeeFormModal";

export default function EmployeesPage() {
  const me = trpc.auth.adminMe.useQuery();
  const employees = trpc.employees.list.useQuery();
  const resetPassword = trpc.employees.resetPassword.useMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EditingEmployee | null>(null);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(emp: EditingEmployee) {
    setEditing(emp);
    setModalOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-800">Employees</h1>
        <button className="btn-primary w-auto px-4 py-2.5 text-sm" onClick={openAdd}>
          + Add employee
        </button>
      </div>

      {me.data?.role === "owner" && <PositionWageSettings />}
      <div className="space-y-2">
        {employees.data?.map((emp) => (
          <div key={emp.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className="flex-1 text-left" onClick={() => openEdit(emp)}>
              <p className="font-medium text-slate-800 flex items-center gap-2 flex-wrap">
                {emp.fullName}
                <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5">
                  # {emp.employeeCode}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                {emp.position === "general_worker" ? "General worker" : emp.position === "team_leader" ? "Team leader" : "Supervisor"} · Weekday {"R" + emp.hourlyRateWeekday}/hr · Weekend {"R" + emp.hourlyRateWeekend}/hr
                {!emp.active && <span className="ml-2 text-red-500 font-medium">Inactive</span>}
              </p>
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="text-sm text-slate-500 underline"
                onClick={() => {
                  const newPassword = prompt("New password for " + emp.fullName + " (at least 8 characters):");
                  if (newPassword) resetPassword.mutate({ id: emp.id, newPassword });
                }}
              >
                Reset password
              </button>
            </div>
          </div>
        ))}
        {employees.data?.length === 0 && (
          <p className="text-sm text-slate-500">No employees yet. Tap "+ Add employee" to create the first one.</p>
        )}
      </div>

      <EmployeeFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}

function PositionWageSettings() {
  const rates = trpc.employers.listPositionWageRates.useQuery();
  const utils = trpc.useUtils();
  const saveRate = trpc.employers.upsertPositionWageRate.useMutation({ onSuccess: () => utils.employers.listPositionWageRates.invalidate() });
  const [values, setValues] = useState<Record<string, { weekday: string; weekend: string }>>({
    general_worker: { weekday: "", weekend: "" },
    supervisor: { weekday: "", weekend: "" },
    team_leader: { weekday: "", weekend: "" },
  });
  useEffect(() => {
    if (!rates.data) return;
    setValues((current) => {
      const next = { ...current };
      for (const rate of rates.data) next[rate.position] = { weekday: rate.hourlyRateWeekday, weekend: rate.hourlyRateWeekend };
      return next;
    });
  }, [rates.data]);
  const labels = { general_worker: "General worker", supervisor: "Supervisor", team_leader: "Team leader" } as const;
  return <section className="card mb-5"><h2 className="font-semibold text-slate-800">Position wage rates</h2><p className="text-xs text-slate-500 mt-1 mb-3">Payslips use these hourly rates for each employee position. Existing employee rates are used only until a position rate is configured.</p><div className="space-y-2">{(Object.keys(labels) as (keyof typeof labels)[]).map((position) => <div key={position} className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_9rem_auto] gap-2 items-center"><span className="text-sm font-medium text-slate-700">{labels[position]}</span><input className="input-field" type="number" min="0" step="0.01" placeholder="Weekday / hr" value={values[position]?.weekday ?? ""} onChange={(e) => setValues((current) => ({ ...current, [position]: { ...current[position], weekday: e.target.value } }))} /><input className="input-field" type="number" min="0" step="0.01" placeholder="Weekend / hr" value={values[position]?.weekend ?? ""} onChange={(e) => setValues((current) => ({ ...current, [position]: { ...current[position], weekend: e.target.value } }))} /><button type="button" className="btn-secondary w-auto px-3 py-2 text-sm" onClick={() => saveRate.mutate({ position, hourlyRateWeekday: Number(values[position]?.weekday), hourlyRateWeekend: Number(values[position]?.weekend) })} disabled={saveRate.isPending}>Save</button></div>)}</div>{saveRate.error && <p className="text-sm text-red-600 mt-2">{saveRate.error.message}</p>}</section>;
}
