import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";

function fileName(year: number, month: number) {
  return `fieldface-payslip-${year}-${String(month).padStart(2, "0")}.pdf`;
}

export default function EmployeePayslipPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const payslips = trpc.payslips.myPayslips.useQuery();
  const [error, setError] = useState<string | null>(null);

  async function download(id: string, year: number, month: number) {
    setError(null);
    try {
      const result = await utils.client.payslips.myDownloadUrl.query({ payslipId: id });
      if (!result?.url) throw new Error("This payslip is no longer available.");
      const link = document.createElement("a");
      link.href = result.url;
      link.download = fileName(year, month);
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the payslip.");
    }
  }

  if (payslips.isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;

  return (
    <div className="app-wallpaper min-h-screen px-5 py-6">
      <div className="max-w-sm mx-auto">
        <header className="flex items-center justify-between mb-5"><h1 className="text-xl font-bold text-slate-800">My payslips</h1><button className="text-sm text-slate-500 underline" onClick={() => navigate("/clock")}>Back</button></header>
        <div className="card mb-5"><p className="font-semibold text-slate-800">Management-issued payslips</p><p className="text-sm text-slate-500 mt-1">Payslips can only be generated and shared by management. You can download payslips once they are issued.</p></div>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <div className="space-y-3">
          {payslips.data?.map((p) => <div key={p.id} className="card"><p className="font-medium text-slate-800">{new Date(p.periodYear, p.periodMonth - 1).toLocaleDateString([], { month: "long", year: "numeric" })}</p><p className="text-sm text-slate-500 mt-1">{Number(p.totalHours).toFixed(2)} hours · Net R{Number(p.netPay).toFixed(2)}</p><button className="btn-secondary mt-3" onClick={() => download(p.id, p.periodYear, p.periodMonth)}>Download payslip</button></div>)}
          {payslips.data?.length === 0 && <p className="text-sm text-slate-400">No payslips have been issued yet.</p>}
        </div>
      </div>
    </div>
  );
}
