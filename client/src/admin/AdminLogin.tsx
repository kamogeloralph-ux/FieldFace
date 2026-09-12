import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";

export default function AdminLogin() {
  const [employerId, setEmployerId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const companies = trpc.auth.listLoginCompanies.useQuery();
  const adminLogin = trpc.auth.adminLogin.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminLogin.mutateAsync({ employerId, username: username.trim(), password, rememberMe });
      await utils.auth.adminMe.invalidate();
      navigate("/company");
    } catch (err) { setError(err instanceof Error ? err.message : "Login failed."); }
    finally { setLoading(false); }
  }

  return <div className="admin-wallpaper min-h-screen flex flex-col justify-center px-6 py-10"><div className="login-panel w-full max-w-sm mx-auto"><div className="text-center mb-8"><img src="/fieldface-logo-white.png" alt="Fieldface" className="h-8 w-auto mx-auto mb-5" /><p className="eyebrow eyebrow-light mb-3">MANAGEMENT CONSOLE</p><h1 className="text-2xl font-bold text-white">Welcome back.</h1><p className="text-emerald-100/75 mt-1">Choose your company, then enter your manager credentials.</p></div><div className="login-form-card"><form className="space-y-4" onSubmit={handleSubmit}><label className="block text-sm font-medium text-slate-700">Company<select className="input-field mt-1" value={employerId} onChange={(e) => setEmployerId(e.target.value)} required autoFocus><option value="">Select your company</option>{companies.data?.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Username<input className="input-field mt-1" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" /></label><label className="block text-sm font-medium text-slate-700">Password<input className="input-field mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 accent-emerald-700" />Stay signed in on this device for 30 days</label>{error && <p className="text-red-600 text-sm">{error}</p>}<button className="btn-primary" type="submit" disabled={loading || companies.isLoading}>{loading ? "Signing in..." : "Sign in"}</button></form><a href="/company/activate" className="block text-center text-sm font-semibold text-emerald-800 underline mt-4">First-time manager? Activate your account</a></div><p className="text-center text-xs text-emerald-100/80 mt-4"><a href="/policy" className="underline">Read the client policy</a></p></div></div>;
}
