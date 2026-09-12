import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";

export default function AdminLogin() {
  const [companyCode, setCompanyCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const adminLogin = trpc.auth.adminLogin.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminLogin.mutateAsync({ companyCode: companyCode.trim(), username: username.trim(), password });
      await utils.auth.adminMe.invalidate();
      navigate("/company");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-wallpaper min-h-screen flex flex-col justify-center px-6 py-10">
      <div className="login-panel w-full max-w-sm mx-auto">
        <div className="text-center mb-8">
          <img src="/fieldface-logo-white.png" alt="Fieldface" className="h-8 w-auto mx-auto mb-5" />
          <p className="eyebrow eyebrow-light mb-3">MANAGEMENT CONSOLE</p>
          <h1 className="text-2xl font-bold text-white">Welcome back.</h1>
          <p className="text-emerald-100/75 mt-1">Sign in with your company credentials.</p>
        </div>
        <div className="login-form-card">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700">Company code<input className="input-field mt-1 uppercase" value={companyCode} onChange={(e) => setCompanyCode(e.target.value.toUpperCase())} required autoFocus /></label>
            <label className="block text-sm font-medium text-slate-700">Username<input className="input-field mt-1" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" /></label>
            <label className="block text-sm font-medium text-slate-700">Password<input className="input-field mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button className="btn-primary" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
          </form>
        </div>
        <p className="text-center text-xs text-emerald-100/80 mt-4"><a href="/policy" className="underline">Read the client policy</a></p>
      </div>
    </div>
  );
}
