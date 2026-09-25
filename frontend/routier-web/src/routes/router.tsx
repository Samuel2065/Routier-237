import { createBrowserRouter, Navigate } from 'react-router'
import { PublicLayout } from '@/components/layout/public-layout'
import { RequireAdmin } from '@/features/admin/require-admin'
import { RequireAgency } from '@/features/agency/require-agency'
import { RequireAgencyPermission } from '@/features/agency/require-permission'
import { sectionPermissions } from '@/features/agency/sections'
import { RequireCustomer } from '@/features/auth/require-customer'
import { HomePage } from '@/pages/home-page'
import { NotFoundPage, RouteErrorPage } from '@/pages/not-found-page'

/**
 * Routes publiques et client (§13.1), espace agence (§13.2), espace administrateur (§13.3).
 *
 * Les pages autres que l'accueil sont chargées à la demande (connexions mobiles lentes).
 */
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'search', lazy: async () => ({ Component: (await import('@/pages/search-page')).SearchPage }) },
      { path: 'trips/:id', lazy: async () => ({ Component: (await import('@/pages/trip-page')).TripPage }) },
      { path: 'agencies/:id', lazy: async () => ({ Component: (await import('@/pages/agency-page')).AgencyPage }) },
      // Accessible sans compte : la connexion est demandée à l'étape passagers.
      { path: 'booking/:id', lazy: async () => ({ Component: (await import('@/pages/booking-page')).BookingPage }) },
      { path: 'login', lazy: async () => ({ Component: (await import('@/pages/login-page')).LoginPage }) },
      { path: 'register', lazy: async () => ({ Component: (await import('@/pages/register-page')).RegisterPage }) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // Espace client : tableau de bord du voyageur connecté.
  {
    path: 'account',
    element: <RequireCustomer />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        lazy: async () => ({ Component: (await import('@/components/layout/customer-layout')).CustomerLayout }),
        children: [
          { index: true, lazy: async () => ({ Component: (await import('@/pages/account/account-page')).AccountPage }) },
          {
            path: 'reservations',
            lazy: async () => ({ Component: (await import('@/pages/account/reservations-page')).ReservationsPage }),
          },
          {
            path: 'reservations/:id',
            lazy: async () => ({ Component: (await import('@/pages/account/reservation-detail-page')).ReservationDetailPage }),
          },
          { path: 'profile', lazy: async () => ({ Component: (await import('@/pages/profile-page')).CustomerProfilePage }) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },

  // Espace agence (§13.2) : accès direct, sans passer par l'espace public (§4.2).
  {
    path: 'agency/login',
    errorElement: <RouteErrorPage />,
    lazy: async () => ({ Component: (await import('@/pages/agency/login-page')).AgencyLoginPage }),
  },
  {
    path: 'agency',
    element: <RequireAgency />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        lazy: async () => ({ Component: (await import('@/components/layout/agency-layout')).AgencyLayout }),
        children: [
          { index: true, element: <Navigate to="/agency/dashboard" replace /> },
          {
            path: 'dashboard',
            element: <RequireAgencyPermission anyOf={sectionPermissions('dashboard')} />,
            children: [{ index: true, lazy: async () => ({ Component: (await import('@/pages/agency/dashboard-page')).AgencyDashboardPage }) }],
          },
          {
            path: 'trips',
            element: <RequireAgencyPermission anyOf={sectionPermissions('trips')} />,
            children: [{ index: true, lazy: async () => ({ Component: (await import('@/pages/agency/trips-page')).AgencyTripsPage }) }],
          },
          {
            path: 'reservations',
            element: <RequireAgencyPermission anyOf={sectionPermissions('reservations')} />,
            children: [{ index: true, lazy: async () => ({ Component: (await import('@/pages/agency/reservations-page')).AgencyReservationsPage }) }],
          },
          {
            path: 'vehicles',
            element: <RequireAgencyPermission anyOf={sectionPermissions('vehicles')} />,
            children: [{ index: true, lazy: async () => ({ Component: (await import('@/pages/agency/vehicles-page')).AgencyVehiclesPage }) }],
          },
          {
            path: 'employees',
            element: <RequireAgencyPermission anyOf={sectionPermissions('employees')} />,
            children: [{ index: true, lazy: async () => ({ Component: (await import('@/pages/agency/employees-page')).AgencyEmployeesPage }) }],
          },
          {
            path: 'payments',
            element: <RequireAgencyPermission anyOf={sectionPermissions('payments')} />,
            children: [{ index: true, lazy: async () => ({ Component: (await import('@/pages/agency/payments-page')).AgencyPaymentsPage }) }],
          },
          {
            path: 'settings',
            element: <RequireAgencyPermission anyOf={sectionPermissions('settings')} />,
            children: [{ index: true, lazy: async () => ({ Component: (await import('@/pages/agency/settings-page')).AgencySettingsPage }) }],
          },
          // Profil personnel : accessible à tout le personnel, sans permission de section.
          { path: 'profile', lazy: async () => ({ Component: (await import('@/pages/profile-page')).AgencyProfilePage }) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },

  // Espace administrateur de la plateforme (§13.3), distinct de l'espace agence (§4.3).
  {
    path: 'admin/login',
    errorElement: <RouteErrorPage />,
    lazy: async () => ({ Component: (await import('@/pages/admin/login-page')).AdminLoginPage }),
  },
  {
    path: 'admin',
    element: <RequireAdmin />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        lazy: async () => ({ Component: (await import('@/components/layout/admin-layout')).AdminLayout }),
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: 'dashboard', lazy: async () => ({ Component: (await import('@/pages/admin/dashboard-page')).AdminDashboardPage }) },
          { path: 'organizations', lazy: async () => ({ Component: (await import('@/pages/admin/organizations-page')).AdminOrganizationsPage }) },
          {
            path: 'organizations/:id',
            lazy: async () => ({ Component: (await import('@/pages/admin/organization-detail-page')).AdminOrganizationDetailPage }),
          },
          { path: 'agencies', lazy: async () => ({ Component: (await import('@/pages/admin/agencies-page')).AdminAgenciesPage }) },
          { path: 'users', lazy: async () => ({ Component: (await import('@/pages/admin/users-page')).AdminUsersPage }) },
          { path: 'referentials', lazy: async () => ({ Component: (await import('@/pages/admin/referentials-page')).AdminReferentialsPage }) },
          { path: 'profile', lazy: async () => ({ Component: (await import('@/pages/profile-page')).AdminProfilePage }) },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
