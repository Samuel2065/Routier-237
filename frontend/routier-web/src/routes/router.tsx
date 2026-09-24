import { createBrowserRouter, Navigate } from 'react-router'
import { PublicLayout } from '@/components/layout/public-layout'
import { RequireAgency } from '@/features/agency/require-agency'
import { RequireAgencyPermission } from '@/features/agency/require-permission'
import { sectionPermissions } from '@/features/agency/sections'
import { RequireCustomer } from '@/features/auth/require-customer'
import { HomePage } from '@/pages/home-page'
import { NotFoundPage, RouteErrorPage } from '@/pages/not-found-page'

/**
 * Routes publiques et client (§13.1), espace agence (§13.2). Espace administrateur : module 11.
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
      {
        path: 'account',
        element: <RequireCustomer />,
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
        ],
      },
      { path: '*', element: <NotFoundPage /> },
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
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
