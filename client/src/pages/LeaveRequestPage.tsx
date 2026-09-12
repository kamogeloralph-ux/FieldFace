import { useState } from "react";
import { trpc } from "../lib/trpc";
import EmployeeMenu from "./EmployeeMenu";

const statusStyles = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-700",
};

export default function LeaveRequestPage() {
  const utils = trpc.useUtils();
  const requests = trpc.leaveRequests.mine.useQuery();
  const submit = trpc.leaveRequests.submit.useMutation({ onSuccess: () => { utils.leaveRequests.mine.invalidate(); setReason(""); } });
  const cancel = trpc.leaveRequests.cancel.useMutation({ onSuccess: () => utils.leaveRequests.mine.invalidate() });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    submit.mutate({ startDate, endDate, reason });
  }

  return <div className="app-wallpaper min-h-screen px-5 py-6"><div className="max-w-sm mx-auto space-y-4"><header className="relative flex items-center justify-between"><EmployeeMenu /><div className="absolute inset-x-0 text-center pointer-events-none"><p className="text-xs text-slate-500">Employee profile</p><h1 className="text-xl font-bold text-slate-800">Leave requests</h1></div><span /></header><form className="card space-y-3" onSubmit={onSubmit}><p className="font-semibold text-slate-800">Apply for leave</p><div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-600">From<input className="input-field mt-1" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></label><label className="text-xs text-slate-600">To<input className="input-field mt-1" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></label></div><textarea className="input-field min-h-24" placeholder="Reason or notes for management" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required /><button className="btn-primary" type="submit" disabled={submit.isPending}>{submit.isPending ? "Submitting..." : "Submit leave request"}</button>{submit.error && <p className="text-sm text-red-600">{submit.error.message}</p>}</form><div className="space-y-2"><p className="text-sm font-semibold text-slate-700">My requests</p>{requests.data?.map((request) => <div className="card" key={request.id}><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-slate-800">{request.startDate} to {request.endDate}</p><p className="text-sm text-slate-600 mt-1">{request.reason}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[request.status]}`}>{request.status}</span></div>{request.managerNote && <p className="text-xs text-slate-500 mt-2">Management: {request.managerNote}</p>}{request.status === "pending" && <button className="text-sm text-red-600 underline mt-3" onClick={() => cancel.mutate({ id: request.id })}>Cancel request</button>}</div>)}{requests.data?.length === 0 && <p className="text-sm text-slate-400">No leave requests yet.</p>}</div></div></div>;
}
