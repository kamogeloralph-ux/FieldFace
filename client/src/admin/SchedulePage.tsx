import { trpc } from "../lib/trpc";

export default function SchedulePage() {
  const utils = trpc.useUtils();
  const schedule = trpc.employers.getScheduleAdmin.useQuery();
  const upload = trpc.employers.uploadSchedule.useMutation({ onSuccess: () => utils.employers.getScheduleAdmin.invalidate() });
  const remove = trpc.employers.removeSchedule.useMutation({ onSuccess: () => utils.employers.getScheduleAdmin.invalidate() });

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Schedule files must be 10 MB or smaller."); return; }
    const reader = new FileReader();
    reader.onload = () => upload.mutate({ dataUrl: String(reader.result), fileName: file.name });
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  return <div><h1 className="text-xl font-bold text-slate-800 mb-2">Company schedule</h1><p className="text-sm text-slate-500 mb-5">Upload the current schedule for every logged-in employee to view.</p><div className="card max-w-2xl space-y-4"><p className="font-semibold text-slate-800">Schedule document</p><p className="text-xs text-slate-500">Accepted formats: PDF, JPEG, or PNG. Maximum size: 10 MB.</p>{schedule.data ? <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><a href={schedule.data.url} target="_blank" rel="noreferrer" className="text-sm text-emerald-700 underline truncate">{schedule.data.name}</a><button type="button" className="text-sm text-red-600 underline" onClick={() => { if (confirm("Remove the company schedule? Employees will no longer see it.")) remove.mutate(); }} disabled={remove.isPending}>{remove.isPending ? "Removing..." : "Remove"}</button></div> : <p className="text-sm text-slate-400">No schedule uploaded.</p>}<label className="btn-secondary block text-center cursor-pointer">{upload.isPending ? "Uploading..." : schedule.data ? "Replace schedule" : "Upload schedule"}<input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png" onChange={onFileChange} disabled={upload.isPending} /></label>{upload.error && <p className="text-sm text-red-600">{upload.error.message}</p>}</div></div>;
}
