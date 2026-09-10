import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";

const NAV = [
  { to: "/", label: "Daily Report", end: true },
  { to: "/employees", label: "Employees" },
  { to: "/sites", label: "Sites" },
  { to: "/payslips", label: "Payslips" },
  { to: "/employer", label: "Employer Settings" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const me = trpc.auth.adminMe.useQuery();
  const logout = trpc.auth.adminLogout.useMutation();

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 bg-emerald-900 text-emerald-50 flex flex-col p-4">
        <div className="mb-6">
          <p className="font-bold text-lg">FieldFace</p>
          <p className="text-xs text-emerald-300">{me.data?.employer?.name}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-emerald-700 text-white" : "text-emerald-100 hover:bg-emerald-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="pt-4 border-t border-emerald-800">
          <p className="text-xs text-emerald-300 mb-2">{me.data?.fullName}</p>
          <button
            className="text-sm text-emerald-200 underline"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login") })}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 max-w-5xl">
        <Outlet />
      </main>
    </div>
  );
}
