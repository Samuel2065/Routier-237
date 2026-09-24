import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { RequireAgencyPermission } from '@/features/agency/require-permission'
import { sectionPermissions } from '@/features/agency/sections'
import { signInAgency } from '@/test/agency-session'
import { renderWithProviders } from '@/test/render'

function renderSection(path: string) {
  return renderWithProviders(
    <Routes>
      <Route path={`/agency/${path}`} element={<RequireAgencyPermission anyOf={sectionPermissions(path)} />}>
        <Route index element={<p>Contenu de la section</p>} />
      </Route>
    </Routes>,
    { route: `/agency/${path}` },
  )
}

describe('RequireAgencyPermission', () => {
  it('blocks a driver from sections outside their role without loading the page', () => {
    signInAgency('driver', ['dashboard.view', 'trips.view', 'vehicles.view'])

    for (const path of ['settings', 'payments', 'employees', 'reservations']) {
      const { unmount } = renderSection(path)
      expect(screen.getByText('Accès non autorisé')).toBeInTheDocument()
      expect(screen.queryByText('Contenu de la section')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('opens the sections allowed to the role', () => {
    signInAgency('driver', ['dashboard.view', 'trips.view', 'vehicles.view'])

    for (const path of ['dashboard', 'trips', 'vehicles']) {
      const { unmount } = renderSection(path)
      expect(screen.getByText('Contenu de la section')).toBeInTheDocument()
      unmount()
    }
  })

  it('accepts any of several permissions (settings for a director)', () => {
    signInAgency('director', ['organizations.update'], { agency: null })
    renderSection('settings')

    expect(screen.getByText('Contenu de la section')).toBeInTheDocument()
  })
})
