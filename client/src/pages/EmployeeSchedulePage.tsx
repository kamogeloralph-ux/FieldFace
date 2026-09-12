import { trpc } from "../lib/trpc";
import EmployeeMenu from "./EmployeeMenu";

export default function EmployeeSchedulePage() {
  const schedule = trpc.employers.getSchedule.useQuery();

  return <div className="app-wallpaper min-h-screen px-5 py-6"><div className="max-w-sm mx-auto space-y-4"><header className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Employee profile</p><h1 className="text-xl font-bold text-slate-800">Company schedule</h1></div><EmployeeMenu /></header><div className="card space-y-3"><p className="text-sm text-slate-600">Your employer’s current schedule is shown below.</p>{schedule.isLoading && <p className="text-sm text-slate-400">Loading schedule...</p>}{!schedule.isLoading && !schedule.data && <p className="text-sm text-slate-400">No schedule has been uploaded yet.</p>}{schedule.data && <><p className="font-semibold text-slate-800 truncate">{schedule.data.name}</p><a href={schedule.data.url} target="_blank" rel="noreferrer" className="btn-primary block text-center">View schedule</a></>}</div></div></div>;
}
