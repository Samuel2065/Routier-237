import { Building2, Camera, Landmark, Loader2, Mail, Phone, Trash2, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/page-header'
import { UserAvatar } from '@/components/common/user-avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { avatarFileError, useDeleteAvatar, useUpdateAvatar } from '@/features/profile/queries'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { ROLE_LABELS } from '@/lib/labels'
import { useSession } from '@/store/auth-store'
import type { Space } from '@/types/api'

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b py-3 last:border-b-0">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="grid min-w-0 gap-0.5">
        <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
        <dd className="truncate text-sm font-medium">{children}</dd>
      </div>
    </div>
  )
}

/**
 * Profil du compte connecté (/account/profile, /agency/profile, /admin/profile) :
 * informations du compte et photo de profil, réellement enregistrée par l'API.
 */
export function ProfilePage({ space }: { space: Space }) {
  const session = useSession(space)
  const updateAvatar = useUpdateAvatar(space)
  const deleteAvatar = useDeleteAvatar(space)
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Libère l'aperçu local dès qu'il n'est plus affiché.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  if (!session) return null
  const { user } = session
  const busy = updateAvatar.isPending || deleteAvatar.isPending

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const invalid = avatarFileError(file)
    if (invalid) {
      setError(invalid)
      return
    }

    setError(null)
    setPreview(URL.createObjectURL(file))
    updateAvatar.mutate(file, {
      onSuccess: () => toast.success('Photo de profil mise à jour.'),
      onError: (failure) => setError(getFieldErrors(failure).avatar ?? getErrorMessage(failure)),
      onSettled: () => setPreview(null),
    })
  }

  const onRemove = () => {
    setError(null)
    deleteAvatar.mutate(undefined, {
      onSuccess: () => toast.success('Photo de profil retirée.'),
      onError: (failure) => setError(getErrorMessage(failure)),
    })
  }

  return (
    <div className="grid gap-6">
      <PageHeader title="Mon profil" description="Informations de votre compte et photo de profil." />

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="[--card-spacing:--spacing(6)]">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <UserAvatar name={user.name} src={preview ?? user.avatar_url} className="size-28 text-2xl ring-4 ring-primary/15" />
              {busy && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60" role="status">
                  <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
                  <span className="sr-only">Enregistrement de la photo…</span>
                </span>
              )}
            </div>
            <div className="grid gap-0.5">
              <p className="text-lg font-semibold">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.role ? ROLE_LABELS[user.role] : ''}</p>
            </div>

            <input
              ref={inputRef}
              id="avatar-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={onFileChange}
            />
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => inputRef.current?.click()} disabled={busy} aria-describedby="avatar-help">
                <Camera aria-hidden="true" />
                {user.avatar_url ? 'Changer la photo' : 'Ajouter une photo'}
              </Button>
              {user.avatar_url && (
                <Button variant="outline" onClick={onRemove} disabled={busy}>
                  <Trash2 aria-hidden="true" />
                  Retirer
                </Button>
              )}
            </div>
            <p id="avatar-help" className="text-xs text-muted-foreground">
              JPEG, PNG ou WebP, 2 Mo maximum.
            </p>

            {error && (
              <Alert variant="destructive" className="text-left">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informations du compte</CardTitle>
            <CardDescription>Ces informations ne sont pas encore modifiables en ligne.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <InfoRow icon={<UserRound className="size-4" aria-hidden="true" />} label="Nom">
                {user.name}
              </InfoRow>
              <InfoRow icon={<Mail className="size-4" aria-hidden="true" />} label="E-mail">
                {user.email}
              </InfoRow>
              <InfoRow icon={<Phone className="size-4" aria-hidden="true" />} label="Téléphone">
                {user.phone ?? <span className="text-muted-foreground">Non renseigné</span>}
              </InfoRow>
              {user.organization && (
                <InfoRow icon={<Landmark className="size-4" aria-hidden="true" />} label="Organisation">
                  {user.organization.name}
                </InfoRow>
              )}
              {user.agency && (
                <InfoRow icon={<Building2 className="size-4" aria-hidden="true" />} label="Agence">
                  {user.agency.name}
                </InfoRow>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export const CustomerProfilePage = () => <ProfilePage space="customer" />
export const AgencyProfilePage = () => <ProfilePage space="agency" />
export const AdminProfilePage = () => <ProfilePage space="admin" />
