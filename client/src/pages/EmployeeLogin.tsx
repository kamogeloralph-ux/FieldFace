import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";

export default function EmployeeLogin() {
  const [companyCode, setCompanyCode] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const me = trpc.auth.employeeMe.useQuery();

  useEffect(() => {
    if (me.isSuccess && me.data) navigate("/clock", { replace: true });
  }, [me.isSuccess, me.data, navigate]);

  const login = trpc.auth.employeeLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.employeeMe.invalidate();
      navigate("/clock");
    },
    onError: (err) => setError(err.message),
  });

  return (
    <div className="app-wallpaper min-h-screen flex flex-col justify-center px-6 py-10">
      <div className="login-panel max-w-sm mx-auto w-full">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-6"><div className="brand-lockup"><img src="/fieldface-logo.png" alt="FieldFace" className="h-8 w-auto" /></div></div>
        <p className="eyebrow mb-3">FIELD OPERATIONS, SIMPLIFIED</p>
        <h1 className="text-2xl font-bold text-emerald-900">Employee clock-in</h1>
        <p className="text-slate-600 mt-1">Enter your company code, employee number, and PIN to clock in or out. Your shift can be saved when offline.</p>
      </div>

      <form
        className="login-form-card space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          login.mutate({ companyCode: companyCode.trim(), employeeCode: employeeCode.trim(), pin, rememberMe });
        }}
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Company code</label>
          <input className="input-field uppercase" value={companyCode} onChange={(e) => setCompanyCode(e.target.value.toUpperCase())} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Employee number</label>
          <input
            className="input-field"
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">PIN</label>
          <input
            className="input-field tracking-widest text-center text-lg"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            type="password"
            inputMode="numeric"
            maxLength={8}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 accent-emerald-700" />
          Stay signed in on this device for 30 days
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="btn-primary" type="submit" disabled={login.isPending}>
          {login.isPending ? "Checking..." : "Log in"}
        </button>
      </form>
      <p className="text-center text-xs text-slate-500 mt-4"><Link to="/policy" className="underline">Read the client policy</Link></p>
      </div>
    </div>
  );
}
