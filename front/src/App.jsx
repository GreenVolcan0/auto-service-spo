import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import { GuestOnly, RequireRole } from './auth/RequireRole.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { Layout } from './components/Layout.jsx';

import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import MyAppointmentsPage from './pages/client/MyAppointmentsPage.jsx';
import NewAppointmentPage from './pages/client/NewAppointmentPage.jsx';
import AppointmentDetailsPage from './pages/AppointmentDetailsPage.jsx';
import SchedulePage from './pages/employee/SchedulePage.jsx';
import AdminSchedulePage from './pages/admin/AdminSchedulePage.jsx';
import AdminEmployeesPage from './pages/admin/AdminEmployeesPage.jsx';
import AdminServicesPage from './pages/admin/AdminServicesPage.jsx';
import AdminPriceItemsPage from './pages/admin/AdminPriceItemsPage.jsx';

// Маршруты приложения. Разграничение доступа — через RequireRole.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<Layout />}>
              {/* публичные */}
              <Route index element={<HomePage />} />
              <Route
                path="login"
                element={
                  <GuestOnly>
                    <LoginPage />
                  </GuestOnly>
                }
              />
              <Route
                path="register"
                element={
                  <GuestOnly>
                    <RegisterPage />
                  </GuestOnly>
                }
              />

              {/* для любого авторизованного */}
              <Route
                path="profile"
                element={
                  <RequireRole>
                    <ProfilePage />
                  </RequireRole>
                }
              />
              <Route
                path="appointments/:id"
                element={
                  <RequireRole>
                    <AppointmentDetailsPage />
                  </RequireRole>
                }
              />

              {/* клиент */}
              <Route
                path="appointments/new"
                element={
                  <RequireRole roles={['client']}>
                    <NewAppointmentPage />
                  </RequireRole>
                }
              />
              <Route
                path="my"
                element={
                  <RequireRole roles={['client']}>
                    <MyAppointmentsPage />
                  </RequireRole>
                }
              />

              {/* сотрудник */}
              <Route
                path="schedule"
                element={
                  <RequireRole roles={['employee']}>
                    <SchedulePage />
                  </RequireRole>
                }
              />

              {/* администратор */}
              <Route
                path="admin/schedule"
                element={
                  <RequireRole roles={['admin']}>
                    <AdminSchedulePage />
                  </RequireRole>
                }
              />
              <Route
                path="admin/employees"
                element={
                  <RequireRole roles={['admin']}>
                    <AdminEmployeesPage />
                  </RequireRole>
                }
              />
              <Route
                path="admin/services"
                element={
                  <RequireRole roles={['admin']}>
                    <AdminServicesPage />
                  </RequireRole>
                }
              />
              <Route
                path="admin/price-items"
                element={
                  <RequireRole roles={['admin']}>
                    <AdminPriceItemsPage />
                  </RequireRole>
                }
              />

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
