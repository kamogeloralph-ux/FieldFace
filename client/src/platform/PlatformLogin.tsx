import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { trpc } from "../lib/trpc";

export default function PlatformLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const platformLogin = trpc.platform.login.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!supabase) throw new Error("Platform owner login is not configured. Add the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY variables to the Railway service and redeploy.");
      const { data, error: supaError } = await supabase.auth.signInWithPassword({ email, password });
      if (supaError || !data.session) {
        throw new Error(supaError?.message ?? "Invalid email or password.");
      }
      await platformLogin.mutateAsync({ accessToken: data.session.access_token, rememberMe });
      await utils.platform.me.invalidate();
      navigate("/");
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
        <p className="eyebrow eyebrow-light mb-3">PLATFORM OWNER CONSOLE</p>
        <h1 className="text-2xl font-bold text-white">Welcome back.</h1>
        <p className="text-emerald-100/75 mt-1">Manage every company on FieldFace.</p>
      </div>
      <div className="login-form-card">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input className="input-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 accent-emerald-700" />Stay signed in on this device for 30 days</label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      </div>
      <p className="text-center text-xs text-emerald-100/80 mt-4"><a href="/policy" className="underline">Read the client policy</a></p>
      </div>
    </div>
  );
}
