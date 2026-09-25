import { screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import { HomePage } from '@/pages/home-page'
import { renderWithProviders } from '@/test/render'

vi.mock('@/api/catalog', () => ({
  fetchCities: vi.fn(async () => [
    { id: 1, name: 'Yaoundé', slug: 'yaounde' },
    { id: 2, name: 'Douala', slug: 'douala' },
    { id: 3, name: 'Bertoua', slug: 'bertoua' },
    { id: 4, name: 'Kribi', slug: 'kribi' },
  ]),
  fetchTravelClasses: vi.fn(async () => [
    { id: 1, code: 'vip', name: 'VIP', description: 'Minibus/coaster plus confortable, généralement climatisé.' },
    { id: 2, code: 'classique', name: 'Classique', description: 'Grand autocar, service standard.' },
  ]),
  fetchAgencies: vi.fn(async () => ({
    data: [
      { id: 7, name: 'Agence Bertoua Centre', city: { id: 3, name: 'Bertoua', slug: 'bertoua' }, organization: { id: 1, name: 'Routier Démo Voyages' }, email: null, phone: null, address: null, description: null },
    ],
    meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
  })),
}))

describe('HomePage', () => {
  it('presents the platform with the real cities, agencies and travel classes', async () => {
    renderWithProviders(<HomePage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Voyagez sereinement sur les routes du Cameroun' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Rechercher un trajet' })).toBeInTheDocument()

    // Cartes illustrées pour les villes disponibles, les autres en liste simple.
    const destinations = screen.getByRole('region', { name: 'Des villes reliées par les agences partenaires' })
    expect(await within(destinations).findByRole('link', { name: /Bertoua.*1 agence sur place/ })).toHaveAttribute('href', '/?destination=3#recherche')
    expect(within(destinations).getByRole('link', { name: /Douala/ })).toBeInTheDocument()
    expect(within(destinations).getByRole('link', { name: 'Kribi' })).toHaveAttribute('href', '/?destination=4#recherche')

    expect(await screen.findByText('Agence Bertoua Centre')).toBeInTheDocument()
    expect(await screen.findByText('Grand autocar, service standard.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Vous avez une question ?' })).toBeInTheDocument()
  })

  it('pre-fills the destination chosen from a city card', async () => {
    renderWithProviders(<HomePage />, { route: '/?destination=2#recherche' })

    expect(await screen.findByText('Destination choisie : Douala')).toBeInTheDocument()
  })

  it('shows no invented statistic or rating', async () => {
    renderWithProviders(<HomePage />)
    await screen.findByText('Agence Bertoua Centre')

    expect(document.body.textContent).not.toMatch(/\d+\s*K\+|\/5\b|satisfaction|voyageurs satisfaits/i)
  })
})
