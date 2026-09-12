import { useState } from "react";
import { trpc } from "../lib/trpc";
import EmployeeMenu from "./EmployeeMenu";

export default function SickNotesPage() {
  const utils = trpc.useUtils();
  const notes = trpc.sickNotes.mine.useQuery();
  const submit = trpc.sickNotes.submit.useMutation({ onSuccess: () => { utils.sickNotes.mine.invalidate(); setFile(null); setComment(""); setNoteDate(""); } });
  const [file, setFile] = useState<File | null>(null);
  const [noteDate, setNoteDate] = useState("");
  const [comment, setComment] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => submit.mutate({ dataUrl: String(reader.result), fileName: file.name, noteDate: noteDate || undefined, employeeComment: comment || undefined });
    reader.readAsDataURL(file);
  }

  return <div className="app-wallpaper min-h-screen px-5 py-6"><div className="max-w-sm mx-auto space-y-4"><header className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Employee profile</p><h1 className="text-xl font-bold text-slate-800">Sick notes</h1></div><EmployeeMenu /></header><form className="card space-y-3" onSubmit={onSubmit}><p className="font-semibold text-slate-800">Submit a sick note</p><p className="text-xs text-slate-500">Upload a PDF, JPEG, or PNG. It will be stored in your company’s records for management review.</p><input className="input-field" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /><label className="text-xs text-slate-600">Note date (optional)<input className="input-field mt-1" type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} /></label><textarea className="input-field min-h-20" placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} /><button className="btn-primary" type="submit" disabled={submit.isPending || !file}>{submit.isPending ? "Uploading..." : "Submit sick note"}</button>{submit.error && <p className="text-sm text-red-600">{submit.error.message}</p>}</form><div className="space-y-2"><p className="text-sm font-semibold text-slate-700">My submissions</p>{notes.data?.map((note) => <div className="card" key={note.id}><div className="flex items-start justify-between gap-3"><a className="text-sm text-emerald-700 underline truncate" href={note.url} target="_blank" rel="noreferrer">{note.fileName}</a><span className={`text-xs font-semibold ${note.status === "reviewed" ? "text-emerald-700" : "text-amber-700"}`}>{note.status}</span></div>{note.noteDate && <p className="text-xs text-slate-500 mt-2">Note date: {note.noteDate}</p>}{note.managerNote && <p className="text-xs text-slate-500 mt-2">Management: {note.managerNote}</p>}</div>)}{notes.data?.length === 0 && <p className="text-sm text-slate-400">No sick notes submitted yet.</p>}</div></div></div>;
}
