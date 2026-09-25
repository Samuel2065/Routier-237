import { fireEvent, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { uploadAvatar } from '@/api/profile'
import { ProfilePage } from '@/pages/profile-page'
import { useAuthStore } from '@/store/auth-store'
import { signInAgency } from '@/test/agency-session'
import { renderWithProviders } from '@/test/render'

vi.mock('@/api/profile', () => ({
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}))

function chooseFile(file: File) {
  fireEvent.change(document.getElementById('avatar-input') as HTMLInputElement, { target: { files: [file] } })
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.mocked(uploadAvatar).mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:apercu')
    URL.revokeObjectURL = vi.fn()
  })

  it('rejects a file that is not a supported image without calling the API', () => {
    signInAgency('driver', ['dashboard.view'])
    renderWithProviders(<ProfilePage space="agency" />)

    chooseFile(new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }))

    expect(screen.getByText('Choisissez une image JPEG, PNG ou WebP.')).toBeInTheDocument()
    expect(uploadAvatar).not.toHaveBeenCalled()
  })

  it('uploads the photo and stores the updated profile', async () => {
    signInAgency('driver', ['dashboard.view'])
    const current = useAuthStore.getState().sessions.agency!.user
    vi.mocked(uploadAvatar).mockResolvedValue({ ...current, avatar_url: 'http://localhost:8000/storage/avatars/1-abc.png' })
    renderWithProviders(<ProfilePage space="agency" />)

    expect(screen.getByRole('button', { name: 'Ajouter une photo' })).toBeInTheDocument()
    const file = new File(['png'], 'moi.png', { type: 'image/png' })
    chooseFile(file)

    await waitFor(() => expect(uploadAvatar).toHaveBeenCalledWith('agency', file))
    await waitFor(() =>
      expect(useAuthStore.getState().sessions.agency!.user.avatar_url).toBe('http://localhost:8000/storage/avatars/1-abc.png'),
    )
    expect(await screen.findByRole('button', { name: 'Changer la photo' })).toBeInTheDocument()
  })

  it('shows the error returned by the API', async () => {
    signInAgency('driver', ['dashboard.view'])
    vi.mocked(uploadAvatar).mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { message: 'invalide', errors: { avatar: ['L’image photo de profil doit mesurer entre 64 et 5000 pixels de côté.'] } } },
    })
    renderWithProviders(<ProfilePage space="agency" />)

    chooseFile(new File(['png'], 'mini.png', { type: 'image/png' }))

    expect(await screen.findByText('L’image photo de profil doit mesurer entre 64 et 5000 pixels de côté.')).toBeInTheDocument()
  })
})
