import { useMemo, useState } from "react";
import { trpc } from "../lib/trpc";

type ReportEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  siteName: string;
  entryType: "clock_in" | "clock_out";
  occurredAt: Date | string;
  withinGeofence: boolean;
  distanceMeters: number;
  selfieUrl: string;
};

export default function DailyReportPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const report = trpc.reports.dailyReport.useQuery({ date });

  const employeeCards = useMemo(() => {
    const groups = new Map<string, { employeeId: string; employeeName: string; entries: ReportEntry[] }>();
    for (const entry of (report.data?.entries ?? []) as ReportEntry[]) {
      const existing = groups.get(entry.employeeId);
      if (existing) existing.entries.push(entry);
      else groups.set(entry.employeeId, { employeeId: entry.employeeId, employeeName: entry.employeeName, entries: [entry] });
    }
    return [...groups.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [report.data?.entries]);

  function toggleEmployee(employeeId: string) {
    setExpandedEmployees((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-800">Daily Report</h1>
        <input type="date" className="input-field w-auto" value={date} onChange={(e) => { setDate(e.target.value); setExpandedEmployees(new Set()); }} />
      </div>

      {report.data && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card text-center"><p className="text-xs text-slate-500">Active employees</p><p className="text-2xl font-bold text-slate-800">{report.data.totalActiveEmployees}</p></div>
          <div className="card text-center"><p className="text-xs text-slate-500">Currently clocked in</p><p className="text-2xl font-bold text-emerald-700">{report.data.currentlyClockedIn}</p></div>
          <div className="card text-center"><p className="text-xs text-slate-500">Outside designated area</p><p className="text-2xl font-bold text-amber-600">{report.data.outsideGeofenceCount}</p></div>
        </div>
      )}

      <div className="space-y-2">
        {employeeCards.map((employee) => {
          const expanded = expandedEmployees.has(employee.employeeId);
          const latest = employee.entries[0];
          const clockedIn = latest.entryType === "clock_in";
          return (
            <div key={employee.employeeId} className="card !p-0 overflow-hidden">
              <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => toggleEmployee(employee.employeeId)} aria-expanded={expanded}>
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${clockedIn ? "bg-emerald-500" : "bg-slate-300"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{employee.employeeName}</p>
                  <p className="text-xs text-slate-500">{employee.entries.length} clock record{employee.entries.length === 1 ? "" : "s"} · Last {latest.entryType === "clock_in" ? "clocked in" : "clocked out"} at {formatTime(latest.occurredAt)}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${clockedIn ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>{clockedIn ? "Clocked in" : "Clocked out"}</span>
                <span className="text-slate-400 text-xl leading-none">{expanded ? "−" : "+"}</span>
              </button>

              {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2">
                  {employee.entries.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 py-3 border-b last:border-b-0 border-slate-200/70">
                      <img src={entry.selfieUrl} alt="" className="w-11 h-11 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{entry.entryType === "clock_in" ? "Clocked in" : "Clocked out"}</p>
                        <p className="text-xs text-slate-500">{formatTime(entry.occurredAt)} · {entry.siteName}</p>
                      </div>
                      <div className="text-right">{!entry.withinGeofence && <p className="text-xs text-amber-600">~{entry.distanceMeters}m away</p>}<p className="text-[11px] text-slate-400">{entry.withinGeofence ? "Within area" : "Outside area"}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {report.data?.entries.length === 0 && <p className="text-slate-400 text-sm">No activity recorded for this day.</p>}
      </div>
    </div>
  );
}

function formatTime(value: Date | string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
