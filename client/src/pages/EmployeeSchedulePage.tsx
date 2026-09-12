import { trpc } from "../lib/trpc";
import EmployeeMenu from "./EmployeeMenu";

export default function EmployeeSchedulePage() {
  const schedule = trpc.employers.getSchedule.useQuery();
  const isPdf = schedule.data?.contentType === "application/pdf";

  return <div className="app-wallpaper min-h-screen px-5 py-6"><div className="max-w-sm mx-auto space-y-4"><header className="relative flex items-center justify-between"><EmployeeMenu /><div className="absolute inset-x-0 text-center pointer-events-none"><p className="text-xs text-slate-500">Employee profile</p><h1 className="text-xl font-bold text-slate-800">Company schedule</h1></div><span /></header><div className="card space-y-3"><p className="text-sm text-slate-600 break-words">Your employer’s current schedule is shown below.</p>{schedule.isLoading && <p className="text-sm text-slate-400">Loading schedule...</p>}{schedule.isError && <p className="text-sm text-red-600">The schedule could not be opened. Please try again or contact management.</p>}{!schedule.isLoading && !schedule.isError && !schedule.data && <p className="text-sm text-slate-400">No schedule has been uploaded yet.</p>}{schedule.data && <><p className="font-semibold text-slate-800 break-words" title={schedule.data.name}>{schedule.data.name}</p>{isPdf ? <iframe title="Company schedule" src={schedule.data.url} className="w-full h-[30rem] rounded-lg border border-slate-200 bg-white" /> : <img src={schedule.data.url} alt="Company schedule" className="w-full max-h-[30rem] rounded-lg border border-slate-200 object-contain bg-white" />}<a href={schedule.data.url} target="_blank" rel="noreferrer" className="btn-secondary block text-center">Open in new tab</a></>}</div></div></div>;
}
