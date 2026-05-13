import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './stores/auth';
import Login from './pages/auth/Login';
import SurveyPublic from './pages/public/SurveyPublic';
import MainLayout from './components/layout/MainLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminInventory from './pages/admin/Inventory';
import AdminMovements from './pages/admin/Movements';
import AdminSales from './pages/admin/Sales';
import AdminUsers from './pages/admin/Users';
import AdminCompanies from './pages/admin/Companies';
import AgentChat from './pages/admin/AgentChat';
import AgentCitas from './pages/admin/Citas';
import PatientLayout from './components/layout/PatientLayout';
import PacienteDashboard from './pages/paciente/Dashboard';
import DoctorDashboard from './pages/doctor/Dashboard';
import DoctorAppointments from './pages/doctor/Appointments';
import DoctorPrescriptions from './pages/doctor/Prescriptions';
import Patients from './pages/shared/Patients';
import PatientDetail from './pages/shared/PatientDetail';

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/encuesta" element={<SurveyPublic />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (user.role === 'ADMIN') {
    return (
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/sales" element={<AdminSales />} />
          <Route path="/inventory" element={<AdminInventory />} />
          <Route path="/movements" element={<AdminMovements />} />
          <Route path="/appointments" element={<DoctorAppointments />} />
          <Route path="/users" element={<AdminUsers />} />
          <Route path="/companies" element={<AdminCompanies />} />
          <Route path="/agent" element={<AgentChat />} />
          <Route path="/citas" element={<AgentCitas />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  // PACIENTE
  if (user.role === 'PACIENTE') {
    return (
      <Routes>
        <Route element={<PatientLayout />}>
          <Route path="/" element={<PacienteDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  // DOCTOR
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<DoctorDashboard />} />
        <Route path="/appointments" element={<DoctorAppointments />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/prescriptions" element={<DoctorPrescriptions />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
