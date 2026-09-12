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
  const utils = trpc.useUtils();
  const payslips = trpc.payslips.list.useQuery({ year, month });
  const generate = trpc.payslips.generateForMonth.useMutation({
    onSuccess: () => utils.payslips.list.invalidate(),
  });
  const finalize = trpc.payslips.finalizePeriod.useMutation({
    onSuccess: () => utils.payslips.list.invalidate(),
  });

  async function share(payslipId: string, employeeName: string) {
    const url = `${window.location.origin}/share/payslip/${payslipId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${employeeName} payslip`, text: `FieldFace payslip for ${employeeName}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Payslip link copied to the clipboard.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      alert(error instanceof Error ? error.message : "Could not share the payslip.");
    }
  }

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
          onClick={() => generate.mutate({ year, month })}
          disabled={generate.isPending}
        >
          {generate.isPending ? "Generating..." : `Generate payslips for ${MONTHS[month - 1]} ${year}`}
        </button>
        <button
          className="btn-secondary payslip-generate-button"
          onClick={() => {
            if (confirm(`Finalize ${MONTHS[month - 1]} ${year}? Finalized payslips cannot be regenerated.`)) finalize.mutate({ year, month });
          }}
          disabled={finalize.isPending}
        >
          {finalize.isPending ? "Finalizing..." : "Finalize payroll period"}
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Payslips also generate automatically on the 1st of every month for the month just ended. Use the button above to
        generate early, or regenerate after correcting hours.
      </p>

      <div className="space-y-2">
        {payslips.data?.map((p) => (
          <div key={p.id} className="card payslip-row flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-slate-800">{p.employeeName}</p>
              <p className="text-xs text-slate-500">
                {Number(p.totalHours).toFixed(2)}h total ({Number(p.weekdayHours).toFixed(2)} weekday / {Number(p.weekendHours).toFixed(2)} weekend) · Gross R{Number(p.grossPay).toFixed(2)} · Deductions R{((Number(p.uifDeduction) || 0) + (p.deductionDetails ?? []).reduce((sum, deduction) => sum + Number(deduction.amount), 0)).toFixed(2)} · Net R{Number(p.netPay).toFixed(2)}
              </p>
            </div>
            <button className="btn-secondary download-button" onClick={() => share(p.id, p.employeeName)}>
              Share payslip
            </button>
          </div>
        ))}
        {payslips.data?.length === 0 && <p className="text-slate-400 text-sm">No payslips generated for this period yet.</p>}
      </div>
    </div>
  );
}
