import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";

export default function SupportPage() {
  const support = trpc.employers.getPlatformSupport.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.employers.updateSupport.useMutation({ onSuccess: async () => { await utils.employers.getPlatformSupport.invalidate(); setSaved(true); } });
  const [form, setForm] = useState({ supportWhatsapp: "", supportPhone: "", supportEmail: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!support.data) return;
    setForm({ supportWhatsapp: support.data.supportWhatsapp ?? "", supportPhone: support.data.supportPhone ?? "", supportEmail: support.data.supportEmail ?? "" });
  }, [support.data]);

  function setField(field: keyof typeof form, value: string) {
    setSaved(false);
    setForm((current) => ({ ...current, [field]: value }));
  }

  return <div className="max-w-2xl"><h1 className="text-xl font-bold text-slate-800">FieldFace client support</h1><p className="text-sm text-slate-500 mt-1 mb-5">These platform-wide contacts appear on the public welcome screen for prospective and existing clients.</p><div className="card space-y-4"><label className="text-xs text-slate-500">WhatsApp number<input className="input-field mt-1" value={form.supportWhatsapp} onChange={(e) => setField("supportWhatsapp", e.target.value)} placeholder="e.g. +27 71 234 5678" /></label><label className="text-xs text-slate-500">Phone number<input className="input-field mt-1" value={form.supportPhone} onChange={(e) => setField("supportPhone", e.target.value)} placeholder="e.g. +27 11 234 5678" /></label><label className="text-xs text-slate-500">Support email<input className="input-field mt-1" type="email" value={form.supportEmail} onChange={(e) => setField("supportEmail", e.target.value)} placeholder="support@fieldface.com" /></label><div className="flex items-center gap-3"><button className="btn-primary sm:w-auto px-5" onClick={() => update.mutate(form)} disabled={update.isPending}>{update.isPending ? "Saving..." : "Save client support"}</button>{saved && <span className="text-sm text-emerald-700">Saved.</span>}</div>{update.error && <p className="text-sm text-red-600">{update.error.message}</p>}</div></div>;
}
