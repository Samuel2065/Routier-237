import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { vi } from 'vitest'
import { loginCustomer } from '@/api/auth'
import { LoginForm } from '@/features/auth/login-form'
import { useAuthStore } from '@/store/auth-store'
import { renderWithProviders } from '@/test/render'
import type { AuthPayload } from '@/types/api'

vi.mock('@/api/auth', () => ({ loginCustomer: vi.fn(), registerCustomer: vi.fn(), logoutCustomer: vi.fn() }))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(loginCustomer).mockReset()
    useAuthStore.setState({ sessions: {} })
  })

  it('stores the customer session after a successful login', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    vi.mocked(loginCustomer).mockResolvedValue({
      token: '1|secret',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00Z',
      space: 'customer',
      user: { id: 9, name: 'Client Démo', email: 'client@routier237.test' },
    } as AuthPayload)

    renderWithProviders(<LoginForm onSuccess={onSuccess} />)
    await user.type(screen.getByLabelText('Adresse e-mail'), 'client@routier237.test')
    await user.type(screen.getByLabelText('Mot de passe'), 'password')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(useAuthStore.getState().sessions.customer?.token).toBe('1|secret')
  })

  it('shows the server message under the email field when credentials are refused', async () => {
    const user = userEvent.setup()
    const config = { headers: new AxiosHeaders() }
    const refused = new AxiosError('Unprocessable', 'ERR_BAD_REQUEST', config, null, {
      status: 422,
      statusText: '',
      headers: {},
      config,
      data: {
        message: 'Ces identifiants ne correspondent à aucun compte autorisé pour cet espace.',
        errors: { email: ['Ces identifiants ne correspondent à aucun compte autorisé pour cet espace.'] },
      },
    })
    vi.mocked(loginCustomer).mockImplementation(async () => {
      throw refused
    })

    renderWithProviders(<LoginForm onSuccess={vi.fn()} />)
    await user.type(screen.getByLabelText('Adresse e-mail'), 'manager@routier237.test')
    await user.type(screen.getByLabelText('Mot de passe'), 'password')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Ces identifiants ne correspondent à aucun compte autorisé pour cet espace.')).toBeInTheDocument()
    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute('aria-invalid', 'true')
    expect(useAuthStore.getState().sessions.customer).toBeUndefined()
  })

  it('validates the fields before calling the API', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm onSuccess={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText("L'adresse e-mail est obligatoire.")).toBeInTheDocument()
    expect(screen.getByText('Le mot de passe est obligatoire.')).toBeInTheDocument()
    expect(loginCustomer).not.toHaveBeenCalled()
  })
})
