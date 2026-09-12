import { useState } from "react";
import { trpc } from "../lib/trpc";
import { leaveTypeLabel } from "@shared/leaveTypes";

const statusStyles = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-700",
};

export default function LeaveRequestsPage() {
  const utils = trpc.useUtils();
  const requests = trpc.leaveRequests.listForManagement.useQuery();
  const decide = trpc.leaveRequests.decide.useMutation({ onSuccess: () => utils.leaveRequests.listForManagement.invalidate() });
  const [notes, setNotes] = useState<Record<string, string>>({});

  return <div><div className="flex items-center justify-between mb-5"><div><h1 className="text-xl font-bold text-slate-800">Leave requests</h1><p className="text-sm text-slate-500 mt-1">Review and respond to employee leave applications.</p></div><button className="btn-secondary w-auto px-3 py-2 text-sm" onClick={() => requests.refetch()} disabled={requests.isFetching}>{requests.isFetching ? "Refreshing..." : "Refresh"}</button></div><div className="space-y-3">{requests.data?.map((request) => <div className="card" key={request.id}><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{request.employeeName} <span className="text-xs font-normal text-slate-500">#{request.employeeCode}</span></p><p className="text-sm font-medium text-emerald-700 mt-2">{leaveTypeLabel(request.leaveType)}</p><p className="text-sm text-slate-700 mt-1">{request.startDate} to {request.endDate}</p><p className="text-sm text-slate-600 mt-1">{request.reason}</p></div><span className={`self-start rounded-full px-2 py-1 text-xs font-semibold ${statusStyles[request.status]}`}>{request.status}</span></div>{request.status === "pending" ? <div className="mt-3 space-y-2"><textarea className="input-field min-h-16" placeholder="Optional note to the employee" value={notes[request.id] ?? ""} onChange={(e) => setNotes((current) => ({ ...current, [request.id]: e.target.value }))} maxLength={500} /><div className="flex gap-2"><button className="btn-primary sm:w-auto px-4 py-2" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, decision: "approved", managerNote: notes[request.id] })}>Approve</button><button className="btn-secondary sm:w-auto px-4 py-2" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, decision: "declined", managerNote: notes[request.id] })}>Decline</button></div></div> : request.managerNote && <p className="text-xs text-slate-500 mt-3">Response: {request.managerNote}</p>}{decide.error && <p className="text-sm text-red-600 mt-2">{decide.error.message}</p>}</div>)}{requests.data?.length === 0 && <p className="text-sm text-slate-500">No leave requests yet.</p>}</div></div>;
}
