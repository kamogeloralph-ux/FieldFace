import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";

function fileName(year: number, month: number) {
  return `fieldface-payslip-${year}-${String(month).padStart(2, "0")}.pdf`;
}

export default function EmployeePayslipPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const status = trpc.payslips.selfServiceStatus.useQuery();
  const payslips = trpc.payslips.myPayslips.useQuery();
  const generate = trpc.payslips.generateForSelf.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.payslips.selfServiceStatus.invalidate(), utils.payslips.myPayslips.invalidate()]);
    },
  });
  const [error, setError] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  async function getUrl(id: string) {
    const result = await utils.client.payslips.myDownloadUrl.query({ payslipId: id });
    if (!result?.url) throw new Error("This payslip is no longer available.");
    return result.url;
  }

  async function download(id: string, year: number, month: number) {
    setError(null);
    try {
      const url = await getUrl(id);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(year, month);
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the payslip.");
    }
  }

  async function share(id: string) {
    setSharingId(id);
    setError(null);
    try {
      // Keep the private R2 URL out of messages. The app resolves this short
      // bearer link server-side and redirects to the temporary PDF URL.
      const url = `${window.location.origin}/share/payslip/${id}`;
      if (navigator.share) {
        await navigator.share({ title: "My FieldFace payslip", text: "My FieldFace payslip", url });
      } else {
        await navigator.clipboard.writeText(url);
        setError("Payslip link copied to your clipboard.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Could not share the payslip.");
    } finally {
      setSharingId(null);
    }
  }

  if (status.isLoading || payslips.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  }

  const currentPayslip = payslips.data?.find(
    (p) => p.periodYear === status.data?.year && p.periodMonth === status.data?.month,
  );

  return (
    <div className="min-h-screen max-w-sm mx-auto px-5 py-6">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-800">My payslips</h1>
        <button className="text-sm text-slate-500 underline" onClick={() => navigate("/clock")}>Back</button>
      </header>

      <div className="card mb-5">
        <p className="font-semibold text-slate-800 mb-1">This month</p>
        <p className="text-sm text-slate-500 mb-4">
          You have {status.data?.remaining ?? 0} of 2 self-service generations remaining.
        </p>
        <button
          className="btn-primary w-full"
          disabled={generate.isPending || !status.data?.remaining}
          onClick={() => {
            setError(null);
            generate.mutate(undefined, {
              onError: (err) => setError(err.message),
            });
          }}
        >
          {generate.isPending ? "Generating..." : currentPayslip ? "Regenerate this month's payslip" : "Generate this month's payslip"}
        </button>
        <p className="text-xs text-slate-400 mt-3">Generation is limited to twice per calendar month.</p>
      </div>

      {error && <p className="text-sm text-emerald-700 mb-4">{error}</p>}

      <p className="text-sm font-medium text-slate-600 mb-2">Available payslips</p>
      <div className="space-y-3">
        {payslips.data?.map((p) => (
          <div key={p.id} className="card">
            <p className="font-medium text-slate-800">{new Date(p.periodYear, p.periodMonth - 1).toLocaleDateString([], { month: "long", year: "numeric" })}</p>
            <p className="text-sm text-slate-500 mt-1">{Number(p.totalHours).toFixed(2)} hours · Net R{Number(p.netPay).toFixed(2)}</p>
            <div className="flex gap-2 mt-3">
              <button className="btn-secondary flex-1" onClick={() => download(p.id, p.periodYear, p.periodMonth)}>Download</button>
              <button className="btn-primary flex-1" disabled={sharingId === p.id} onClick={() => share(p.id)}>
                {sharingId === p.id ? "Sharing..." : "Share"}
              </button>
            </div>
          </div>
        ))}
        {payslips.data?.length === 0 && <p className="text-sm text-slate-400">No payslips are available yet.</p>}
      </div>
    </div>
  );
}
