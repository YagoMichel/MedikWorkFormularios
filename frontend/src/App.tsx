// =============================================================
// ARCHIVO: src/App.tsx
// DESCRIPCION: Enrutador principal de la aplicacion.
//              Divide las rutas segun el rol del usuario logueado.
//
// ROLES Y RESPONSABLES:
//   ADMIN   → pages/admin/    → COMPAÑERO
//   DOCTOR  → pages/doctor/   → TU
//   TABLET  → pages/tablet/   → TU (kiosk, solo encuesta)
//
// FLUJO:
//   Sin login → /login o /encuesta (publica)
//   Con login → rutas segun rol, redirige a / si ruta no existe
// =============================================================

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './stores/auth';

// -- Layouts (estructura visual con sidebar) --
import MainLayout   from './components/layout/MainLayout';
import PatientLayout from './components/layout/PatientLayout';

// -- Paginas publicas (sin login) --
import Login        from './pages/auth/Login';
import SurveyPublic from './pages/public/SurveyPublic';

// -- Paginas ADMIN (compañero) --
import AdminDashboard      from './pages/admin/Dashboard';
import AdminInventory      from './pages/admin/Inventory';
import AdminMovements      from './pages/admin/Movements';
import AdminSales          from './pages/admin/Sales';
import AdminPOS            from './pages/pos/POS';
import AdminUsers          from './pages/admin/Users';
import AdminCompanies      from './pages/admin/Companies';
import AdminBatchesManager from './pages/admin/BatchesManager';
import AdminCalendarView   from './pages/admin/CalendarView';
import AdminReports        from './pages/admin/Reports';

// -- Paginas DOCTOR (tuyas) --
import DoctorDashboard     from './pages/doctor/Dashboard';
import DoctorCalendar      from './pages/doctor/Calendar';
import DoctorPrescriptions from './pages/doctor/Prescriptions';

// -- Paginas TABLET (tuyas) --
import TabletHome from './pages/tablet/Home';

// -- Paginas compartidas DOCTOR + ADMIN --
import Patients      from './pages/common/Patients';
import PatientDetail from './pages/common/PatientDetail';
import Profile       from './pages/common/Profile';

export default function App() {
  const { user } = useAuth();

  // ---- Sin sesion: solo login y encuesta publica ----
  if (!user) {
    return (
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/encuesta" element={<SurveyPublic />} />
        <Route path="*"         element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // ---- ADMIN (compañero) ----
  if (user.role === 'ADMIN') {
    return (
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/"            element={<AdminDashboard />} />
          <Route path="/inventory"   element={<AdminInventory />} />
          <Route path="/movements"   element={<AdminMovements />} />
          <Route path="/sales"       element={<AdminSales />} />
          <Route path="/pos"         element={<AdminPOS />} />
          <Route path="/users"       element={<AdminUsers />} />
          <Route path="/companies"   element={<AdminCompanies />} />
          <Route path="/citas"       element={<AdminBatchesManager />} />
          <Route path="/calendario"  element={<AdminCalendarView />} />
          <Route path="/reportes"    element={<AdminReports />} />
          {/* Compartidas con doctor */}
          <Route path="/profile"     element={<Profile />} />
          <Route path="/patients"    element={<Patients />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/appointments" element={<DoctorCalendar />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  // ---- TABLET (tuyo) ----
  // Solo ve la pantalla de encuesta, sin sidebar
  if (user.role === 'PACIENTE') {
    return (
      <Routes>
        <Route element={<PatientLayout />}>
          <Route path="/" element={<TabletHome />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  // ---- DOCTOR (tuyo) ----
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/"              element={<DoctorDashboard />} />
        <Route path="/appointments"  element={<DoctorCalendar />} />
        <Route path="/prescriptions" element={<DoctorPrescriptions />} />
        {/* Compartidas con admin */}
        <Route path="/profile"       element={<Profile />} />
        <Route path="/patients"      element={<Patients />} />
        <Route path="/patients/:id"  element={<PatientDetail />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
