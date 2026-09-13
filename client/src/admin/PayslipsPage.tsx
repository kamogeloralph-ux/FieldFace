import { useState } from "react";
import { trpc } from "../lib/trpc";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PayslipsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const generate = trpc.payslips.generateForMonth.useMutation();
  const finalize = trpc.payslips.finalizePeriod.useMutation();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-5">Payslips</h1>

      <div className="card mb-6 flex items-end gap-3 flex-wrap">
        <div className="responsive-field">
          <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
          <select className="input-field" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="responsive-field year-field">
          <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
          <input className="input-field" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <button
          className="btn-primary payslip-generate-button"
          onClick={() => {
            setMessage(null);
            generate.mutate({ year, month }, { onSuccess: (result) => setMessage(`${result.generated} payslip${result.generated === 1 ? "" : "s"} generated and distributed to employees.`) });
          }}
          disabled={generate.isPending}
        >
          {generate.isPending ? "Generating..." : `Generate payslips for ${MONTHS[month - 1]} ${year}`}
        </button>
        <button
          className="btn-secondary payslip-generate-button"
          onClick={() => {
            if (confirm(`Finalize ${MONTHS[month - 1]} ${year}? Finalized payslips cannot be regenerated.`)) finalize.mutate({ year, month }, { onSuccess: () => setMessage("Payroll period finalized. Employees can continue viewing their issued payslips.") });
          }}
          disabled={finalize.isPending}
        >
          {finalize.isPending ? "Finalizing..." : "Finalize payroll period"}
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">Payslips generate automatically on the 1st of every month for the month just ended. Employees receive them in their FieldFace account and can download them from <strong>My payslips</strong>. Management can generate or finalize payroll here but cannot view employee payslip details.</p>
      {message && <p className="card text-sm text-emerald-800">{message}</p>}
    </div>
  );
}
