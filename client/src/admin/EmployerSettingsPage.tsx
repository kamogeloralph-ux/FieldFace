import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";

type Form = {
  name: string;
  taxNumber: string;
  companyRegNumber: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  timezone: string;
  uifEnabled: boolean;
  uifEmployeeRate: string;
  uifEmployerRate: string;
};

const emptyForm: Form = {
  name: "", taxNumber: "", companyRegNumber: "", address: "", contactPhone: "", contactEmail: "",
  timezone: "Africa/Johannesburg", uifEnabled: false, uifEmployeeRate: "1.00", uifEmployerRate: "1.00",
};

export default function EmployerSettingsPage() {
  const me = trpc.auth.adminMe.useQuery();
  const employer = trpc.employers.getMine.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.employers.updateMine.useMutation({
    onSuccess: async () => {
      await utils.employers.getMine.invalidate();
      setSaved(true);
    },
  });
  const deductions = trpc.employers.listDeductions.useQuery(undefined, { enabled: me.data?.isPlatformAdmin === true });
  const companyEmployees = trpc.employees.list.useQuery(undefined, { enabled: me.data?.isPlatformAdmin === true });
  const createDeduction = trpc.employers.createDeduction.useMutation({ onSuccess: () => deductions.refetch() });
  const deleteDeduction = trpc.employers.deleteDeduction.useMutation({ onSuccess: () => deductions.refetch() });
  const [form, setForm] = useState<Form>(emptyForm);
  const [saved, setSaved] = useState(false);
  const [deductionName, setDeductionName] = useState("");
  const [deductionType, setDeductionType] = useState<"fixed" | "percentage">("fixed");
  const [deductionAmount, setDeductionAmount] = useState("");
  const [deductionScope, setDeductionScope] = useState<"all" | "selected">("all");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!employer.data) return;
    setForm({
      name: employer.data.name,
      taxNumber: employer.data.taxNumber ?? "",
      companyRegNumber: employer.data.companyRegNumber ?? "",
      address: employer.data.address ?? "",
      contactPhone: employer.data.contactPhone ?? "",
      contactEmail: employer.data.contactEmail ?? "",
      timezone: employer.data.timezone ?? "Africa/Johannesburg",
      uifEnabled: employer.data.uifEnabled,
      uifEmployeeRate: employer.data.uifEmployeeRate ?? "1.00",
      uifEmployerRate: employer.data.uifEmployerRate ?? "1.00",
    });
  }, [employer.data]);

  if (employer.isLoading || me.isLoading) return <p className="text-slate-500">Loading company details...</p>;
  if (!employer.data) return <p className="text-slate-500">Company details are unavailable.</p>;

  const canEdit = me.data?.isPlatformAdmin === true;
  const setField = <K extends keyof Form>(field: K, value: Form[K]) => {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
  };

  function save() {
    if (!canEdit || !form.name.trim()) return;
    update.mutate({
      employerId: employer.data!.id,
      name: form.name.trim(),
      taxNumber: form.taxNumber || undefined,
      companyRegNumber: form.companyRegNumber || undefined,
      address: form.address || undefined,
      contactPhone: form.contactPhone || undefined,
      contactEmail: form.contactEmail || undefined,
      timezone: form.timezone,
      uifEnabled: form.uifEnabled,
      uifEmployeeRate: Number(form.uifEmployeeRate),
      uifEmployerRate: Number(form.uifEmployerRate),
    });
  }

  function addDeduction() {
    const amount = Number(deductionAmount);
    if (!deductionName.trim() || !Number.isFinite(amount) || amount < 0) return;
    createDeduction.mutate({ name: deductionName.trim(), type: deductionType, amount, scope: deductionScope, employeeIds: selectedEmployeeIds });
    setDeductionName("");
    setDeductionAmount("");
    setSelectedEmployeeIds([]);
  }

  if (!canEdit) {
    const fields = [
      ["Company name", employer.data.name], ["Tax number", employer.data.taxNumber],
      ["Registration number", employer.data.companyRegNumber], ["Address", employer.data.address],
      ["Contact phone", employer.data.contactPhone], ["Contact email", employer.data.contactEmail],
      ["Timezone", employer.data.timezone],
    ];
    return <div><h1 className="text-xl font-bold text-slate-800 mb-2">Company settings</h1><div className="card max-w-lg space-y-4"><p className="text-sm text-slate-600">Company details are managed by the FieldFace administrator. Contact admin if anything needs to change.</p><div className="divide-y divide-slate-100">{fields.map(([label, value]) => <div key={label} className="py-3 first:pt-0 last:pb-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="text-slate-800 mt-1">{value || "Not provided"}</p></div>)}</div><p className="text-xs text-slate-500">UIF settings are also controlled by the administrator.</p></div><ScheduleSection /></div>;
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-2">Company settings</h1>
      <div className="card max-w-2xl space-y-4">
        <p className="text-sm text-emerald-700">Platform administrator mode: you can edit this company.</p>
        <ScheduleSection />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-500">Company name<input className="input-field mt-1" value={form.name} onChange={(e) => setField("name", e.target.value)} /></label>
          <label className="text-xs text-slate-500">Tax number<input className="input-field mt-1" value={form.taxNumber} onChange={(e) => setField("taxNumber", e.target.value)} /></label>
          <label className="text-xs text-slate-500">Registration number<input className="input-field mt-1" value={form.companyRegNumber} onChange={(e) => setField("companyRegNumber", e.target.value)} /></label>
          <label className="text-xs text-slate-500">Contact phone<input className="input-field mt-1" value={form.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} /></label>
          <label className="text-xs text-slate-500 sm:col-span-2">Contact email<input className="input-field mt-1" type="email" value={form.contactEmail} onChange={(e) => setField("contactEmail", e.target.value)} /></label>
        </div>
        <label className="text-xs text-slate-500">Address<textarea className="input-field mt-1" value={form.address} onChange={(e) => setField("address", e.target.value)} /></label>
        <label className="text-xs text-slate-500">Timezone<input className="input-field mt-1" value={form.timezone} onChange={(e) => setField("timezone", e.target.value)} placeholder="Africa/Johannesburg" /></label>
        <div className="border-t border-slate-100 pt-4 space-y-3"><p className="font-semibold text-slate-800">UIF settings</p><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.uifEnabled} onChange={(e) => setField("uifEnabled", e.target.checked)} /> Enable UIF deduction</label>{form.uifEnabled && <div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-500">Employee rate %<input className="input-field mt-1" type="number" min="0" max="100" step="0.01" value={form.uifEmployeeRate} onChange={(e) => setField("uifEmployeeRate", e.target.value)} /></label><label className="text-xs text-slate-500">Employer rate %<input className="input-field mt-1" type="number" min="0" max="100" step="0.01" value={form.uifEmployerRate} onChange={(e) => setField("uifEmployerRate", e.target.value)} /></label></div>}</div>
        <div className="border-t border-slate-100 pt-4 space-y-3"><p className="font-semibold text-slate-800">Company deductions</p><p className="text-xs text-slate-500">Recurring deductions are applied when payslips are generated. Fixed amounts are in rand; percentage deductions use gross pay.</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><input className="input-field" placeholder="Type, e.g. Uniform" value={deductionName} onChange={(e) => setDeductionName(e.target.value)} /><select className="input-field" value={deductionType} onChange={(e) => setDeductionType(e.target.value as "fixed" | "percentage")}><option value="fixed">Fixed amount</option><option value="percentage">Percentage of gross</option></select><div className="flex gap-2"><input className="input-field" type="number" min="0" step="0.01" placeholder="Amount" value={deductionAmount} onChange={(e) => setDeductionAmount(e.target.value)} /><button type="button" className="btn-secondary w-auto px-3" onClick={addDeduction} disabled={createDeduction.isPending}>Add</button></div></div><select className="input-field" value={deductionScope} onChange={(e) => setDeductionScope(e.target.value as "all" | "selected")}><option value="all">Apply to all employees</option><option value="selected">Apply only to selected employees</option></select>{deductionScope === "selected" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">{companyEmployees.data?.map((employee) => <label key={employee.id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={selectedEmployeeIds.includes(employee.id)} onChange={(e) => setSelectedEmployeeIds((ids) => e.target.checked ? [...ids, employee.id] : ids.filter((id) => id !== employee.id))} />{employee.fullName} ({employee.employeeCode})</label>)}{companyEmployees.data?.length === 0 && <p className="text-xs text-slate-400">No employees found.</p>}</div>}<div className="space-y-2">{deductions.data?.map((deduction) => <div key={deduction.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><div><p className="text-sm font-medium text-slate-800">{deduction.name}</p><p className="text-xs text-slate-500">{deduction.type === "percentage" ? `${deduction.amount}% of gross pay` : `R${deduction.amount}`} · {deduction.scope === "all" ? "All employees" : `${deduction.employeeIds.length} selected employees`} · {deduction.active ? "Active" : "Inactive"}</p></div><button type="button" className="text-xs text-red-600 underline" onClick={() => deleteDeduction.mutate({ id: deduction.id })}>Remove</button></div>)}{deductions.data?.length === 0 && <p className="text-xs text-slate-400">No company deductions configured.</p>}</div></div>
        <div className="flex items-center gap-3"><button className="btn-primary" onClick={save} disabled={update.isPending}>{update.isPending ? "Saving..." : "Save company settings"}</button>{saved && <span className="text-sm text-emerald-700">Saved.</span>}</div>
        {update.error && <p className="text-sm text-red-600">{update.error.message}</p>}
      </div>
    </div>
  );
}

function ScheduleSection() {
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

  return <div className="border-t border-slate-100 pt-4 space-y-3"><div><p className="font-semibold text-slate-800">Company schedule</p><p className="text-xs text-slate-500 mt-1">Upload a PDF, JPEG, or PNG schedule. Every logged-in employee can view the current schedule.</p></div>{schedule.data ? <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><a href={schedule.data.url} target="_blank" rel="noreferrer" className="text-sm text-emerald-700 underline truncate">{schedule.data.name}</a><button type="button" className="text-sm text-red-600 underline" onClick={() => { if (confirm("Remove the company schedule? Employees will no longer see it.")) remove.mutate(); }} disabled={remove.isPending}>Remove</button></div> : <p className="text-sm text-slate-400">No schedule uploaded.</p>}<label className="btn-secondary block text-center cursor-pointer">{upload.isPending ? "Uploading..." : schedule.data ? "Replace schedule" : "Upload schedule"}<input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png" onChange={onFileChange} disabled={upload.isPending} /></label>{upload.error && <p className="text-sm text-red-600">{upload.error.message}</p>}</div>;
}
