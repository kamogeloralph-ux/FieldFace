import { useState } from "react";
import { trpc } from "../lib/trpc";
import EmployeeFormModal, { type EditingEmployee } from "./EmployeeFormModal";

export default function EmployeesPage() {
  const utils = trpc.useUtils();
  const employees = trpc.employees.list.useQuery();
  const updateEmployee = trpc.employees.update.useMutation({ onSuccess: () => utils.employees.list.invalidate() });
  const resetPin = trpc.employees.resetPin.useMutation();

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
                Weekday {"R" + emp.hourlyRateWeekday}/hr · Weekend {"R" + emp.hourlyRateWeekend}/hr
                {!emp.active && <span className="ml-2 text-red-500 font-medium">Inactive</span>}
              </p>
            </button>
            <div className="flex gap-4">
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
