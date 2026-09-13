import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";

export default function AccountActivationPage({ manager = false }: { manager?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [companyCode, setCompanyCode] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const employeeActivate = trpc.auth.activateEmployee.useMutation();
  const managerActivate = trpc.auth.activateManager.useMutation();
  const isManager = manager || new URLSearchParams(location.search).get("type") === "manager";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isManager) await managerActivate.mutateAsync({ companyCode, username: identifier, activationCode, password: secret });
      else await employeeActivate.mutateAsync({ companyCode, employeeNumber: identifier, activationCode, password: secret });
      navigate(isManager ? "/company/login" : "/clock-in");
    } catch (err) { setError(err instanceof Error ? err.message : "Activation failed."); }
  }

  return <div className="app-wallpaper min-h-screen flex flex-col justify-center px-6 py-10"><div className="login-panel max-w-sm mx-auto w-full"><div className="text-center mb-8"><img src="/fieldface-logo.png" alt="FieldFace" className="h-8 w-auto mx-auto mb-5" /><p className="eyebrow mb-3">FIRST-TIME ACCOUNT SETUP</p><h1 className="text-2xl font-bold text-emerald-900">Activate your account</h1><p className="text-slate-600 mt-1">Use the one-time code provided by your administrator to create your password.</p></div><form className="login-form-card space-y-4" onSubmit={submit}><label className="block text-sm font-medium text-slate-700">Company code<input className="input-field mt-1 uppercase" value={companyCode} onChange={(e) => setCompanyCode(e.target.value.toUpperCase())} required /></label><label className="block text-sm font-medium text-slate-700">{isManager ? "Username" : "Employee number"}<input className="input-field mt-1" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required /></label><label className="block text-sm font-medium text-slate-700">Activation code<input className="input-field mt-1 uppercase tracking-widest" value={activationCode} onChange={(e) => setActivationCode(e.target.value.toUpperCase())} required /></label><label className="block text-sm font-medium text-slate-700">Create password<input className="input-field mt-1" type="password" minLength={8} value={secret} onChange={(e) => setSecret(e.target.value)} required /></label>{error && <p className="text-sm text-red-600">{error}</p>}<button className="btn-primary" type="submit" disabled={employeeActivate.isPending || managerActivate.isPending}>{employeeActivate.isPending || managerActivate.isPending ? "Activating..." : "Activate account"}</button></form></div></div>;
}
