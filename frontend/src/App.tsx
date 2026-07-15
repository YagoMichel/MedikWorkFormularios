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
import { useAuth, isAdminRole } from './stores/auth';
import { useInactivityLogout } from './hooks/useInactivityLogout';

// -- Layouts (estructura visual con sidebar) --
import MainLayout   from './components/layout/MainLayout';
import PatientLayout from './components/layout/PatientLayout';

// -- Paginas publicas (sin login) --
import Login        from './pages/auth/Login';
import Signup       from './pages/auth/Signup';
import Activate     from './pages/auth/Activate';
import VerifyEmail  from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword  from './pages/auth/ResetPassword';
import OAuthCallback  from './pages/auth/OAuthCallback';
import EncuestaPublica from './pages/public/EncuestaPublica';

// -- Portales externos (PACIENTE / EMPRESA) --
import PortalLayout      from './pages/portal/PortalLayout';
import PatientDashboard  from './pages/portal/PatientDashboard';
import PatientSurveyPage from './pages/portal/PatientSurveyPage';
import PatientPurchases  from './pages/portal/PatientPurchases';
import CompanyDashboard  from './pages/portal/CompanyDashboard';

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
import AdminAuditLog       from './pages/admin/AuditLog';

// -- Paginas MASTER (exclusivas, no visibles para ADMIN) --
import MasterSystemStatus  from './pages/master/SystemStatus';

// -- Paginas DOCTOR (tuyas) --
import DoctorDashboard     from './pages/doctor/Dashboard';
import DoctorCalendar      from './pages/doctor/Calendar';
import DoctorPrescriptions from './pages/doctor/Prescriptions';
import DoctorCompaniesReview from './pages/doctor/CompaniesReview';

// -- Paginas TABLET (tuyas) --
import TabletHome from './pages/tablet/Home';

// -- Paginas compartidas DOCTOR + ADMIN --
import Patients      from './pages/common/Patients';
import PatientDetail from './pages/common/PatientDetail';
import Profile       from './pages/common/Profile';

export default function App() {
  const { user } = useAuth();

  // Cierre de sesión por inactividad (exento el kiosco de tablet). Se llama
  // siempre en el mismo orden aunque no haya sesión (reglas de hooks).
  useInactivityLogout();

  // ---- Sin sesion: login, registro, activacion, verificacion y encuesta publica ----
  if (!user) {
    return (
      <Routes>
        <Route path="/login"     element={<Login />} />
        <Route path="/signup"    element={<Signup />} />
        <Route path="/activar"   element={<Activate />} />
        <Route path="/verificar" element={<VerifyEmail />} />
        <Route path="/recuperar" element={<ForgotPassword />} />
        <Route path="/restablecer" element={<ResetPassword />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/encuesta"  element={<EncuestaPublica />} />
        <Route path="*"          element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // ---- ADMIN / MASTER (compañero) ----
  if (isAdminRole(user.role)) {
    return (
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/"            element={<AdminDashboard />} />
          <Route path="/inventory"   element={<AdminInventory />} />
          <Route path="/movements"   element={<AdminMovements />} />
          <Route path="/sales"       element={<AdminSales />} />
          <Route path="/pos"         element={<AdminPOS />} />
          <Route path="/users"       element={<AdminUsers />} />
          <Route path="/auditoria"   element={<AdminAuditLog />} />
          <Route path="/companies"   element={<AdminCompanies />} />
          <Route path="/citas"       element={<AdminBatchesManager />} />
          <Route path="/calendario"  element={<AdminCalendarView />} />
          <Route path="/reportes"    element={<AdminReports />} />
          {/* Revisión de archivos por empresa/persona — ADMIN y MASTER */}
          <Route path="/company-review" element={<DoctorCompaniesReview />} />
          {user.role === 'MASTER' && (
            <Route path="/system-status" element={<MasterSystemStatus />} />
          )}
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
  if (user.role === 'PACIENTE_TABLET') {
    return (
      <Routes>
        <Route element={<PatientLayout />}>
          <Route path="/" element={<TabletHome />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  // ---- PORTAL DEL PACIENTE ----
  // Ve solo su expediente y puede llenar su encuesta
  if (user.role === 'PACIENTE') {
    return (
      <Routes>
        <Route element={<PortalLayout />}>
          <Route path="/"            element={<PatientDashboard />} />
          <Route path="/mi-encuesta" element={<PatientSurveyPage />} />
          <Route path="/mis-compras" element={<PatientPurchases />} />
          <Route path="/profile"     element={<Profile />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  // ---- PORTAL DE LA EMPRESA ----
  // Ve los resultados de sus empleados
  if (user.role === 'EMPRESA') {
    return (
      <Routes>
        <Route element={<PortalLayout />}>
          <Route path="/" element={<CompanyDashboard />} />
          <Route path="/profile" element={<Profile />} />
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
        <Route path="/companies"     element={<DoctorCompaniesReview />} />
        {/* Compartidas con admin */}
        <Route path="/profile"       element={<Profile />} />
        <Route path="/patients"      element={<Patients />} />
        <Route path="/patients/:id"  element={<PatientDetail />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
