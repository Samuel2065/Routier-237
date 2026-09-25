import { useMutation } from '@tanstack/react-query'
import { deleteAvatar, uploadAvatar } from '@/api/profile'
import { useAuthStore } from '@/store/auth-store'
import type { Space } from '@/types/api'

/** Formats et poids acceptés par l'API (UpdateAvatarRequest). */
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/**
 * Contrôle immédiat avant envoi ; l'API revérifie (type réel, poids, dimensions).
 */
export function avatarFileError(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return 'Choisissez une image JPEG, PNG ou WebP.'
  if (file.size > AVATAR_MAX_BYTES) return 'L’image ne doit pas dépasser 2 Mo.'
  return null
}

export function useUpdateAvatar(space: Space) {
  return useMutation({
    mutationFn: (file: File) => uploadAvatar(space, file),
    onSuccess: (user) => useAuthStore.getState().setUser(space, user),
  })
}

export function useDeleteAvatar(space: Space) {
  return useMutation({
    mutationFn: () => deleteAvatar(space),
    onSuccess: (user) => useAuthStore.getState().setUser(space, user),
  })
}
