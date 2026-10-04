import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { RequireAdmin } from '@/features/admin/require-admin'
import { RequireAgency } from '@/features/agency/require-agency'
import { RequireCustomer } from '@/features/auth/require-customer'
import { endsSession } from '@/api/client'
import { type Session, useAuthStore } from '@/store/auth-store'
import type { RoleName } from '@/types/api'

function session(role: RoleName): Session {
  return {
    token: `1|${role}`,
    expiresAt: '2099-01-01T00:00:00Z',
    user: {
      id: 1,
      name: 'Test',
      email: 'test@routier237.test',
      phone: null,
      avatar_url: null,
      status: 'active',
      role,
      permissions: ['dashboard.view'],
      organization: null,
      agency: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<p>Connexion voyageur</p>} />
        <Route path="/agency/login" element={<p>Connexion agence</p>} />
        <Route path="/admin/login" element={<p>Connexion administrateur</p>} />
        <Route element={<RequireCustomer />}>
          <Route path="/account" element={<p>Espace voyageur</p>} />
        </Route>
        <Route element={<RequireAgency />}>
          <Route path="/agency/dashboard" element={<p>Espace agence</p>} />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="/admin/dashboard" element={<p>Espace administrateur</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('route guards', () => {
  beforeEach(() => useAuthStore.setState({ sessions: {} }))

  it('reproduces the reported issue: a customer signing in after an employee cannot open the agency space', () => {
    useAuthStore.getState().setSession('agency', session('agency_manager'))
    useAuthStore.getState().setSession('customer', session('customer'))

    renderAt('/agency/dashboard')

    expect(screen.getByText('Connexion agence')).toBeInTheDocument()
    expect(screen.queryByText('Espace agence')).not.toBeInTheDocument()
  })

  it('refuses a session whose role does not belong to the space', () => {
    useAuthStore.setState({ sessions: { agency: session('customer'), admin: session('director') } })

    renderAt('/agency/dashboard')
    expect(screen.getByText('Connexion agence')).toBeInTheDocument()
  })

  it('refuses the admin space to agency staff and to customers', () => {
    useAuthStore.setState({ sessions: { admin: session('director') } })
    renderAt('/admin/dashboard')
    expect(screen.getByText('Connexion administrateur')).toBeInTheDocument()
  })

  it('opens each space to its own role', () => {
    useAuthStore.getState().setSession('agency', session('counter_clerk'))
    renderAt('/agency/dashboard')
    expect(screen.getByText('Espace agence')).toBeInTheDocument()
  })

  it('opens the customer space to a customer only', () => {
    useAuthStore.setState({ sessions: { customer: session('accountant') } })
    renderAt('/account')
    expect(screen.getByText('Connexion voyageur')).toBeInTheDocument()
  })
})

describe('API refusals', () => {
  it('end the local session on 401, a disabled account or a token from another space', () => {
    expect(endsSession(401, 'Authentification requise.')).toBe(true)
    expect(endsSession(403, 'Votre accès est désactivé.')).toBe(true)
    expect(endsSession(403, 'Accès non autorisé depuis cet espace.')).toBe(true)
  })

  it('keep the session open when only an action is forbidden', () => {
    expect(endsSession(403, "Vous n'êtes pas autorisé à effectuer cette action.")).toBe(false)
    expect(endsSession(404, undefined)).toBe(false)
    expect(endsSession(422, 'Les données sont invalides.')).toBe(false)
  })
})
