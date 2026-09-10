import { Navigate, Route, Routes } from "react-router-dom";
import WelcomeScreen from "./pages/WelcomeScreen";
import EmployeeLogin from "./pages/EmployeeLogin";
import ClockScreen from "./pages/ClockScreen";
import HistoryScreen from "./pages/HistoryScreen";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/clock-in" element={<EmployeeLogin />} />
      <Route path="/clock" element={<ClockScreen />} />
      <Route path="/history" element={<HistoryScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
