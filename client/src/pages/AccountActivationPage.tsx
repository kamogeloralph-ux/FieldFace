import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import BrandLogo from "../components/BrandLogo";

export default function AccountActivationPage({ manager = false }: { manager?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [companyCode, setCompanyCode] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const employeeActivate = trpc.auth.activateEmployee.useMutation();
  const managerActivate = trpc.auth.activateManager.useMutation();
  const companies = trpc.auth.listLoginCompanies.useQuery();
  const isManager = manager || new URLSearchParams(location.search).get("type") === "manager";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (isManager) await managerActivate.mutateAsync({ companyCode, username: identifier, activationCode, password: secret });
      else await employeeActivate.mutateAsync({ companyCode, employeeNumber: identifier, activationCode, password: secret });
      navigate(isManager ? "/company/login" : "/clock-in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed.");
    }
  }

  const submitting = employeeActivate.isPending || managerActivate.isPending;

  return (
    <div className="app-wallpaper min-h-screen flex flex-col justify-center px-6 py-10">
      <div className="login-panel max-w-sm mx-auto w-full">
        <div className="text-center mb-8">
          <BrandLogo inverse className="mx-auto mb-5" />
          <p className="eyebrow eyebrow-light mb-3">FIRST-TIME ACCOUNT SETUP</p>
          <h1 className="text-2xl font-bold text-white">Activate your account</h1>
          <p className="text-emerald-100/75 mt-1">Use the one-time code provided by your administrator to create your password.</p>
        </div>
        <form className="login-form-card space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">
            Company
            <select className="input-field mt-1" value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} required disabled={companies.isLoading}>
              <option value="">{companies.isLoading ? "Loading companies..." : "Select your company"}</option>
              {companies.data?.filter((company) => company.companyCode).map((company) => <option key={company.id} value={company.companyCode!}>{company.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {isManager ? "Username" : "Employee number"}
            <input className="input-field mt-1" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Activation code
            <input className="input-field mt-1 uppercase tracking-widest" value={activationCode} onChange={(e) => setActivationCode(e.target.value.toUpperCase())} required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Create password
            <div className="relative mt-1">
              <input className="input-field pr-20" type={showSecret ? "text" : "password"} minLength={8} value={secret} onChange={(e) => setSecret(e.target.value)} required />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-emerald-700" onClick={() => setShowSecret((value) => !value)}>{showSecret ? "Hide" : "Show"}</button>
            </div>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary" type="submit" disabled={submitting || companies.isLoading}>{submitting ? "Activating..." : "Activate account"}</button>
        </form>
      </div>
    </div>
  );
}
