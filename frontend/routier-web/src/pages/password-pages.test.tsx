import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestPasswordReset, resetPassword } from '@/api/auth'
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/password-pages'
import { renderWithProviders } from '@/test/render'

vi.mock('@/api/auth', () => ({ requestPasswordReset: vi.fn(), resetPassword: vi.fn() }))

function validationError(errors: Record<string, string[]>): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status: 422,
    statusText: '',
    headers: {},
    config,
    data: { message: 'Données invalides.', errors },
  })
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends the request and shows the same message whether or not the account exists', async () => {
    const user = userEvent.setup()
    vi.mocked(requestPasswordReset).mockResolvedValue('Si un compte correspond à cette adresse, un lien de réinitialisation vient de lui être envoyé.')
    renderWithProviders(<ForgotPasswordPage />, { route: '/forgot-password?space=agency' })

    await user.type(screen.getByLabelText('Adresse e-mail'), 'manager.bertoua@routier237.test')
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }))

    expect(requestPasswordReset).toHaveBeenCalledWith('manager.bertoua@routier237.test')
    expect(await screen.findByText(/Si un compte correspond à cette adresse/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à la connexion' })).toHaveAttribute('href', '/agency/login')
  })
})

describe('ResetPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuses an incomplete link without calling the API', () => {
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?email=a%40b.cm' })

    expect(screen.getByText(/Ce lien est incomplet/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument()
  })

  it('checks the new password before sending it', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=abc&email=a%40b.cm' })

    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'motdepasse')
    await user.type(screen.getByLabelText('Confirmez le mot de passe'), 'autre')
    await user.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))

    expect(await screen.findByText('Au moins un chiffre.')).toBeInTheDocument()
    expect(screen.getByText('Les mots de passe ne correspondent pas.')).toBeInTheDocument()
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('sets the new password and sends the person to the login page of their space', async () => {
    const user = userEvent.setup()
    vi.mocked(resetPassword).mockResolvedValue({ message: 'Votre mot de passe a été réinitialisé.', space: 'admin' })
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=abc&email=admin%40routier237.test' })

    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'NouveauSecret2026')
    await user.type(screen.getByLabelText('Confirmez le mot de passe'), 'NouveauSecret2026')
    await user.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))

    expect(resetPassword).toHaveBeenCalledWith({
      token: 'abc',
      email: 'admin@routier237.test',
      password: 'NouveauSecret2026',
      password_confirmation: 'NouveauSecret2026',
    })
    expect(await screen.findByText(/toutes vos sessions ouvertes ont été fermées/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/admin/login')
  })

  it('explains an expired or already used link and offers a new one', async () => {
    const user = userEvent.setup()
    vi.mocked(resetPassword).mockRejectedValue(validationError({ email: ['Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau.'] }))
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=vieux&email=a%40b.cm' })

    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'NouveauSecret2026')
    await user.type(screen.getByLabelText('Confirmez le mot de passe'), 'NouveauSecret2026')
    await user.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))

    expect(await screen.findByText(/invalide ou a expiré/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Demander un nouveau lien' })).toHaveAttribute('href', '/forgot-password')
  })
})
