import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { trpc } from "./lib/trpc";
import WelcomeScreen from "./pages/WelcomeScreen";
import EmployeeLogin from "./pages/EmployeeLogin";
import ClockScreen from "./pages/ClockScreen";
import HistoryScreen from "./pages/HistoryScreen";
import AdminLogin from "./admin/AdminLogin";
import AdminLayout from "./admin/AdminLayout";
import DailyReportPage from "./admin/DailyReportPage";
import EmployeesPage from "./admin/EmployeesPage";
import SitesPage from "./admin/SitesPage";
import PayslipsPage from "./admin/PayslipsPage";
import EmployerSettingsPage from "./admin/EmployerSettingsPage";

function RequireCompanyAdmin({ children }: { children: React.ReactNode }) {
  const me = trpc.auth.adminMe.useQuery();
  const navigate = useNavigate();

  useEffect(() => {
    if (me.isSuccess && me.data === null) navigate("/company/login");
  }, [me.isSuccess, me.data, navigate]);

  if (me.isLoading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  if (!me.data) return null;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Employee clock-in flow */}
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/clock-in" element={<EmployeeLogin />} />
      <Route path="/clock" element={<ClockScreen />} />
      <Route path="/history" element={<HistoryScreen />} />

      {/* Supervisor / employer company dashboard */}
      <Route path="/company/login" element={<AdminLogin />} />
      <Route
        path="/company"
        element={
          <RequireCompanyAdmin>
            <AdminLayout />
          </RequireCompanyAdmin>
        }
      >
        <Route index element={<DailyReportPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="sites" element={<SitesPage />} />
        <Route path="payslips" element={<PayslipsPage />} />
        <Route path="employer" element={<EmployerSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
