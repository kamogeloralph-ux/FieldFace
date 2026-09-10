import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { trpc } from "../lib/trpc";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
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
      const { data, error: supaError } = await supabase.auth.signInWithPassword({ email, password });
      if (supaError || !data.session) {
        throw new Error(supaError?.message ?? "Invalid email or password.");
      }
      await adminLogin.mutateAsync({ accessToken: data.session.access_token });
      await utils.auth.adminMe.invalidate();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-10 max-w-sm mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-emerald-800">FieldFace Admin</h1>
        <p className="text-slate-500 mt-1">Sign in to manage employees, sites and payslips.</p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input className="input-field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input className="input-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
