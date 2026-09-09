import { useState } from "react";
import { trpc } from "../lib/trpc";

export default function DailyReportPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const report = trpc.reports.dailyReport.useQuery({ date });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-800">Daily Report</h1>
        <input
          type="date"
          className="input-field w-auto"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {report.data && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card text-center">
            <p className="text-xs text-slate-500">Active employees</p>
            <p className="text-2xl font-bold text-slate-800">{report.data.totalActiveEmployees}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-slate-500">Currently clocked in</p>
            <p className="text-2xl font-bold text-emerald-700">{report.data.currentlyClockedIn}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-slate-500">Outside designated area</p>
            <p className="text-2xl font-bold text-amber-600">{report.data.outsideGeofenceCount}</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {report.data?.entries.map((entry) => (
          <div key={entry.id} className="card flex items-center gap-4">
            <img src={entry.selfieUrl} alt="" className="w-14 h-14 rounded-lg object-cover" />
            <div className="flex-1">
              <p className="font-medium text-slate-800">{entry.employeeName}</p>
              <p className="text-xs text-slate-500">
                {entry.siteName} · {new Date(entry.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  entry.entryType === "clock_in" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                }`}
              >
                {entry.entryType === "clock_in" ? "Clock In" : "Clock Out"}
              </span>
              {!entry.withinGeofence && (
                <p className="text-xs text-amber-600 mt-1">~{entry.distanceMeters}m away</p>
              )}
            </div>
          </div>
        ))}
        {report.data?.entries.length === 0 && <p className="text-slate-400 text-sm">No activity recorded for this day.</p>}
      </div>
    </div>
  );
}
