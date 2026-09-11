import { useState } from "react";
import { trpc } from "../lib/trpc";
import EmployeeFormModal, { type EditingEmployee } from "./EmployeeFormModal";

export default function EmployeesPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const utils = trpc.useUtils();
  const employees = trpc.employees.list.useQuery();
  const updateEmployee = trpc.employees.update.useMutation({ onSuccess: () => utils.employees.list.invalidate() });
  const resetPin = trpc.employees.resetPin.useMutation();
  const generatePayslip = trpc.payslips.generateForEmployee.useMutation({
    onSuccess: () => utils.employees.list.invalidate(),
  });

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

  async function sharePayslip(employeeId: string, employeeName: string) {
    const result = await utils.client.payslips.shareUrl.query({ employeeId, year, month });
    if (!result?.url) {
      alert("Generate this month's payslip first.");
      return;
    }
    try {
      const response = await fetch(result.url);
      if (!response.ok) throw new Error("Payslip file is unavailable. Generate it again first.");
      const file = new File([await response.blob()], `${employeeName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-payslip.pdf`, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${employeeName} payslip`, text: `FieldFace payslip for ${employeeName}` });
      } else if (navigator.share) {
        await navigator.share({ title: `${employeeName} payslip`, text: `FieldFace payslip for ${employeeName}`, url: result.url });
      } else {
        await navigator.clipboard.writeText(result.url);
        alert("Payslip link copied to the clipboard.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      alert(error instanceof Error ? error.message : "Could not share the payslip.");
    }
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
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-400">Payslips: {emp.selfServiceGenPeriod === `${year}-${String(month).padStart(2, "0")}` ? emp.selfServiceGenCount : 0}/2 this month</span>
              <button
                className="text-sm text-emerald-700 underline disabled:opacity-50"
                onClick={() => generatePayslip.mutate({ employeeId: emp.id, year, month })}
                disabled={generatePayslip.isPending || !emp.active || (emp.selfServiceGenPeriod === `${year}-${String(month).padStart(2, "0")}` && emp.selfServiceGenCount >= 2)}
              >
                Generate payslip
              </button>
              <button className="text-sm text-emerald-700 underline" onClick={() => sharePayslip(emp.id, emp.fullName)}>
                Share payslip
              </button>
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
