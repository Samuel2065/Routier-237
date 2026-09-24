import { createBrowserRouter } from 'react-router'
import { PublicLayout } from '@/components/layout/public-layout'
import { RequireCustomer } from '@/features/auth/require-customer'
import { HomePage } from '@/pages/home-page'
import { NotFoundPage, RouteErrorPage } from '@/pages/not-found-page'

/**
 * Routes publiques et client (§13.1). Espaces agence et administrateur : modules 10 et 11.
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
])
