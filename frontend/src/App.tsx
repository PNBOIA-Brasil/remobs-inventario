import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";
import AcquisitionsPage from "./pages/AcquisitionsPage";
import AlertsPage from "./pages/AlertsPage";
import ChecklistDetailPage from "./pages/ChecklistDetailPage";
import ChecklistFormPage from "./pages/ChecklistFormPage";
import ChecklistListPage from "./pages/ChecklistListPage";
import HomePage from "./pages/HomePage";
import InventoryDetailPage from "./pages/InventoryDetailPage";
import InventoryFormPage from "./pages/InventoryFormPage";
import InventoryListPage from "./pages/InventoryListPage";
import LocationFormPage from "./pages/LocationFormPage";
import LocationsPage from "./pages/LocationsPage";
import LoginPage from "./pages/LoginPage";
import MenuPage from "./pages/MenuPage";
import MovementRequestPage from "./pages/MovementRequestPage";
import MovementsPage from "./pages/MovementsPage";
import WithdrawalDetailPage from "./pages/WithdrawalDetailPage";
import ReceiptPage from "./pages/ReceiptPage";
import PlatformDetailPage from "./pages/PlatformDetailPage";
import PlatformFormPage from "./pages/PlatformFormPage";
import PlatformsPage from "./pages/PlatformsPage";
import SensorDetailPage from "./pages/SensorDetailPage";
import SensorFormPage from "./pages/SensorFormPage";
import SensorsPage from "./pages/SensorsPage";
import SyncPage from "./pages/SyncPage";
import { useAuth } from "./state/AuthContext";

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="inventory" element={<InventoryListPage />} />
          <Route path="inventory/new" element={<InventoryFormPage />} />
          <Route path="inventory/:id/edit" element={<InventoryFormPage />} />
          <Route path="inventory/:id" element={<InventoryDetailPage />} />
          <Route path="movements" element={<MovementsPage />} />
          <Route path="movements/new" element={<MovementRequestPage />} />
          <Route path="withdrawals/:id" element={<WithdrawalDetailPage />} />
          <Route path="receipts/new" element={<ReceiptPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="acquisitions" element={<AcquisitionsPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="locations/new" element={<LocationFormPage />} />
          <Route path="locations/:id/edit" element={<LocationFormPage />} />
          <Route path="platforms" element={<PlatformsPage />} />
          <Route path="platforms/new" element={<PlatformFormPage />} />
          <Route path="platforms/:id/edit" element={<PlatformFormPage />} />
          <Route path="platforms/:id" element={<PlatformDetailPage />} />
          <Route path="sensors" element={<SensorsPage />} />
          <Route path="sensors/new" element={<SensorFormPage />} />
          <Route path="sensors/:id/edit" element={<SensorFormPage />} />
          <Route path="sensors/:id" element={<SensorDetailPage />} />
          <Route path="checklists" element={<ChecklistListPage />} />
          <Route path="checklists/new" element={<ChecklistFormPage />} />
          <Route path="checklists/:id" element={<ChecklistDetailPage />} />
          <Route path="sync" element={<SyncPage />} />
          <Route path="menu" element={<MenuPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/app/home" replace />} />
    </Routes>
  );
}
