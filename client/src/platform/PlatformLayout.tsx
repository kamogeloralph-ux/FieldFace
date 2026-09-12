import { Outlet, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";

export default function PlatformLayout() {
  const navigate = useNavigate();
  const me = trpc.platform.me.useQuery();
  const logout = trpc.platform.logout.useMutation();

  return (
    <div className="app-wallpaper min-h-screen">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-emerald-900">
        <img src="/fieldface-logo-white.png" alt="Fieldface" className="h-6 w-auto" />
        <div className="flex items-center gap-4">
          <p className="text-emerald-200 text-sm hidden sm:block">{me.data?.fullName}</p>
          <a href="/policy" className="text-sm text-emerald-100 underline">Policy</a>
          <button
            className="text-sm text-emerald-100 underline"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/login") })}
          >
            Log out
          </button>
        </div>
      </div>
      <main className="p-4 sm:p-6 max-w-4xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
