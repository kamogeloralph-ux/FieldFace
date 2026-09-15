import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import BrandLogo from "../components/BrandLogo";

export default function EmployeeLogin() {
  const [employerId, setEmployerId] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const companies = trpc.auth.listLoginCompanies.useQuery();
  const me = trpc.auth.employeeMe.useQuery();

  useEffect(() => {
    if (me.isSuccess && me.data) navigate("/clock", { replace: true });
  }, [me.isSuccess, me.data, navigate]);

  const login = trpc.auth.employeeLogin.useMutation({
    onSuccess: async () => { await utils.auth.employeeMe.invalidate(); navigate("/clock"); },
    onError: (err) => setError(err.message),
  });

  return <div className="app-wallpaper min-h-screen flex flex-col justify-center px-6 py-10"><div className="login-panel max-w-sm mx-auto w-full"><div className="text-center mb-8"><div className="flex justify-center mb-6"><div className="brand-lockup"><BrandLogo inverse /></div></div><p className="eyebrow eyebrow-light mb-3">FIELD OPERATIONS, SIMPLIFIED</p><h1 className="text-2xl font-bold text-white">Employee clock-in</h1><p className="text-emerald-100/75 mt-1">Choose your company, then enter your employee number and password. Your shift can be saved when offline.</p></div><form className="login-form-card space-y-4" onSubmit={(e) => { e.preventDefault(); setError(null); login.mutate({ employerId, employeeNumber: employeeNumber.trim(), password, rememberMe }); }}><label className="block text-sm font-medium text-slate-700">Company<select className="input-field mt-1" value={employerId} onChange={(e) => setEmployerId(e.target.value)} required><option value="">Select your company</option>{companies.data?.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Employee number<input className="input-field mt-1" value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} required autoFocus /></label><label className="block text-sm font-medium text-slate-700">Password<div className="relative mt-1"><input className="input-field pr-20" value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" required /><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-emerald-700" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div></label><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 accent-emerald-700" />Stay signed in on this device for 30 days</label>{error && <p className="text-red-600 text-sm">{error}</p>}<button className="btn-primary" type="submit" disabled={login.isPending || companies.isLoading}>{login.isPending ? "Checking..." : "Log in"}</button></form><p className="text-center text-xs text-slate-500 mt-4"><Link to="/policy" className="underline">Read the client policy</Link></p></div></div>;
}
