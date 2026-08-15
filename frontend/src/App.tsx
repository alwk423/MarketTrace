import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import BuildStrategyPage from "./pages/BuildStrategyPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import PortfolioPage from "./pages/PortfolioPage";
import SharedReportPage from "./pages/SharedReportPage";
import SignupPage from "./pages/SignupPage";
import SimulatePage from "./pages/SimulatePage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/share/:id" element={<SharedReportPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/simulate" replace />} />
              <Route path="/simulate" element={<SimulatePage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/strategies" element={<BuildStrategyPage />} />
              <Route path="/history" element={<HistoryPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
