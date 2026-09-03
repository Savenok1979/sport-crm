import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import DesktopLayout from "./layouts/DesktopLayout";
import MobileLayout from "./layouts/MobileLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AthletesList from "./pages/athletes/AthletesList";
import AthleteDetail from "./pages/athletes/AthleteDetail";
import LeadsList from "./pages/leads/LeadsList";
import VenuesList from "./pages/venues/VenuesList";
import GroupsList from "./pages/groups/GroupsList";
import GroupDetail from "./pages/groups/GroupDetail";
import ScheduleView from "./pages/schedule/ScheduleView";
import AttendanceOverview from "./pages/attendance/AttendanceOverview";
import FinancePage from "./pages/finance/FinancePage";
import MailingsPage from "./pages/mailings/MailingsPage";
import AnalyticsPage from "./pages/analytics/AnalyticsPage";
import EmployeesPage from "./pages/employees/EmployeesPage";
import SettingsPage from "./pages/settings/SettingsPage";
import TrainerToday from "./pages/trainer/TrainerToday";
import TrainerGroups from "./pages/trainer/TrainerGroups";
import TrainerSchedule from "./pages/trainer/TrainerSchedule";
import TrainerMore from "./pages/trainer/TrainerMore";

export default function App() {
  const { session } = useAuth();

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (session.role === "TRAINER") {
    return (
      <Routes>
        <Route element={<MobileLayout />}>
          <Route path="/today" element={<TrainerToday />} />
          <Route path="/my-groups" element={<TrainerGroups />} />
          <Route path="/my-schedule" element={<TrainerSchedule />} />
          <Route path="/more" element={<TrainerMore />} />
          <Route path="/athletes" element={<AthletesList />} />
          <Route path="/athletes/:id" element={<AthleteDetail />} />
          <Route path="/mailings" element={<MailingsPage />} />
        </Route>
        <Route path="/login" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<DesktopLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/athletes" element={<AthletesList />} />
        <Route path="/athletes/:id" element={<AthleteDetail />} />
        <Route path="/leads" element={<LeadsList />} />
        <Route path="/venues" element={<VenuesList />} />
        <Route path="/groups" element={<GroupsList />} />
        <Route path="/groups/:id" element={<GroupDetail />} />
        <Route path="/schedule" element={<ScheduleView />} />
        <Route path="/attendance" element={<AttendanceOverview />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/mailings" element={<MailingsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
