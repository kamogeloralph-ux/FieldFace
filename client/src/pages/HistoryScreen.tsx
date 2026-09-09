import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";

export default function HistoryScreen() {
  const navigate = useNavigate();
  const shifts = trpc.timeEntries.myShifts.useQuery();

  const weekdayTotal = (shifts.data ?? []).filter((s) => !s.isWeekend).reduce((sum, s) => sum + Number(s.hours), 0);
  const weekendTotal = (shifts.data ?? []).filter((s) => s.isWeekend).reduce((sum, s) => sum + Number(s.hours), 0);

  return (
    <div className="min-h-screen max-w-sm mx-auto px-5 py-6">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-800">My hours</h1>
        <button className="text-sm text-slate-500 underline" onClick={() => navigate("/clock")}>
          Back
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="card text-center">
          <p className="text-xs text-slate-500 mb-1">Weekday hours</p>
          <p className="text-2xl font-bold text-slate-800">{weekdayTotal.toFixed(1)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-slate-500 mb-1">Weekend hours</p>
          <p className="text-2xl font-bold text-slate-800">{weekendTotal.toFixed(1)}</p>
        </div>
      </div>

      <p className="text-sm font-medium text-slate-600 mb-2">Recent shifts</p>
      <div className="space-y-2">
        {(shifts.data ?? []).map((shift) => (
          <div key={shift.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">{shift.shiftDate}</p>
              <p className="text-xs text-slate-500">
                {new Date(shift.clockInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                {new Date(shift.clockOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {shift.isWeekend && <span className="ml-2 text-amber-600 font-medium">Weekend</span>}
              </p>
            </div>
            <p className="font-semibold text-slate-800">{Number(shift.hours).toFixed(2)}h</p>
          </div>
        ))}
        {shifts.data?.length === 0 && <p className="text-slate-400 text-sm">No shifts recorded yet.</p>}
      </div>
    </div>
  );
}
