import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { trpc } from "./lib/trpc";
import PlatformLogin from "./platform/PlatformLogin";
import PlatformLayout from "./platform/PlatformLayout";
import CompaniesPage from "./platform/CompaniesPage";

function RequirePlatformOwner({ children }: { children: React.ReactNode }) {
  const me = trpc.platform.me.useQuery();
  const navigate = useNavigate();

  useEffect(() => {
    if (me.isSuccess && me.data === null) navigate("/login");
  }, [me.isSuccess, me.data, navigate]);

  if (me.isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  if (!me.data) return null;
  return <>{children}</>;
}

export default function PlatformApp() {
  return (
    <Routes>
      <Route path="/login" element={<PlatformLogin />} />
      <Route
        path="/"
        element={
          <RequirePlatformOwner>
            <PlatformLayout />
          </RequirePlatformOwner>
        }
      >
        <Route index element={<CompaniesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
