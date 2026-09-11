import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";

export default function EmployeeLogin() {
  const [taxNumber, setTaxNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const login = trpc.auth.employeeLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.employeeMe.invalidate();
      navigate("/clock");
    },
    onError: (err) => setError(err.message),
  });

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-10 max-w-sm mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-emerald-800">FieldFace</h1>
        <p className="text-slate-500 mt-1">Enter your tax number and PIN to clock in or out.</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          login.mutate({ taxNumber: taxNumber.trim(), pin });
        }}
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tax number</label>
          <input
            className="input-field"
            value={taxNumber}
            onChange={(e) => setTaxNumber(e.target.value)}
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
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="btn-primary" type="submit" disabled={login.isPending}>
          {login.isPending ? "Checking..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
