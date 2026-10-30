import { KeyRound, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/lib/toast'
import { ConfirmDialog, type ConfirmRequest } from '@/components/common/confirm-dialog'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { auditActionLabel } from '@/features/admin/audit-labels'
import { useAdminUser, useAuditLogs, useSendPasswordReset } from '@/features/admin/queries'
import { getErrorMessage } from '@/lib/api-error'
import { formatDateTime } from '@/lib/format'
import { ROLE_LABELS } from '@/lib/labels'

/**
 * Fiche d'un compte pour l'administration : rattachement, rôle et permissions (lecture seule —
 * les rôles du personnel se gèrent dans l'espace agence), activité, sessions et dernières
 * actions du journal. Réinitialisation du mot de passe par lien envoyé à la personne :
 * l'administrateur ne voit ni ne choisit jamais le mot de passe.
 */
export function AdminUserSheet({ userId, currentAdminId, onClose }: { userId: number | null; currentAdminId?: number; onClose: () => void }) {
  const user = useAdminUser(userId)
  // Historique chargé seulement fiche ouverte.
  const history = useAuditLogs({ subject_type: 'user', subject_id: userId ?? undefined, per_page: 5 }, userId !== null)
  const sendReset = useSendPasswordReset()
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const data = user.data
  const self = data?.id === currentAdminId

  const askReset = () => {
    if (!data) return
    setConfirm({
      title: `Envoyer un lien de réinitialisation à ${data.name} ?`,
      description: `Un e-mail contenant un lien valable 60 minutes sera envoyé à ${data.email}. La personne choisira elle-même son nouveau mot de passe ; toutes ses sessions seront alors fermées.`,
      confirmLabel: 'Envoyer le lien',
      onConfirm: () =>
        sendReset.mutate(data.id, {
          onSuccess: (message) => toast.success(message),
          onError: (error) => toast.error(getErrorMessage(error)),
          onSettled: () => setConfirm(null),
        }),
    })
  }

  return (
    <Sheet open={userId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{data?.name ?? 'Compte'}</SheetTitle>
          <SheetDescription>{data && `Inscrit le ${formatDateTime(data.created_at)}`}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-6">
          {user.isPending && <LoadingState rows={3} />}
          {user.isError && <ErrorState message={getErrorMessage(user.error)} onRetry={() => user.refetch()} />}

          {data && (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">E-mail</dt>
                <dd className="break-all">{data.email}</dd>
                <dt className="text-muted-foreground">Téléphone</dt>
                <dd>{data.phone ?? '—'}</dd>
                <dt className="text-muted-foreground">Rôle</dt>
                <dd>{data.role ? ROLE_LABELS[data.role] : '—'}</dd>
                <dt className="text-muted-foreground">Rattachement</dt>
                <dd>{[data.agency?.name, data.organization?.name].filter(Boolean).join(' · ') || '—'}</dd>
                <dt className="text-muted-foreground">Statut</dt>
                <dd>{data.status === 'active' ? 'Actif' : 'Suspendu'}</dd>
                <dt className="text-muted-foreground">Dernière activité</dt>
                <dd>{data.last_active_at ? formatDateTime(data.last_active_at) : 'Aucune session récente'}</dd>
                <dt className="text-muted-foreground">Sessions ouvertes</dt>
                <dd>{data.active_sessions ?? 0}</dd>
                <dt className="text-muted-foreground">Appareils (push)</dt>
                <dd>{data.push_devices ?? 0}</dd>
              </dl>

              <section className="grid gap-2" aria-labelledby="user-permissions">
                <h3 id="user-permissions" className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Permissions du rôle
                </h3>
                {data.permissions && data.permissions.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {data.permissions.map((permission) => (
                      <Badge key={permission} variant="secondary" className="font-mono text-xs font-normal">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune permission de gestion (le client n'agit que sur ses propres réservations).</p>
                )}
                <p className="text-xs text-muted-foreground">Lecture seule : les rôles du personnel se gèrent dans l'espace agence de son organisation.</p>
              </section>

              <section className="grid gap-2" aria-labelledby="user-password">
                <h3 id="user-password" className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound className="size-4" aria-hidden="true" />
                  Mot de passe
                </h3>
                <p className="text-sm text-muted-foreground">
                  Le mot de passe n'est jamais visible. En cas d'oubli, envoyez un lien sécurisé : la personne choisira elle-même un nouveau mot de passe.
                </p>
                {self ? (
                  <p className="text-sm text-muted-foreground">Pour votre propre compte, utilisez « Mot de passe oublié ? » sur la page de connexion.</p>
                ) : (
                  <Button variant="outline" className="justify-self-start" onClick={askReset} disabled={sendReset.isPending}>
                    <KeyRound aria-hidden="true" />
                    Envoyer un lien de réinitialisation
                  </Button>
                )}
              </section>

              <section className="grid gap-2" aria-labelledby="user-history">
                <h3 id="user-history" className="text-sm font-semibold">
                  Dernières actions sur ce compte
                </h3>
                {history.data && history.data.data.length > 0 ? (
                  <ul className="grid gap-1 text-sm">
                    {history.data.data.map((entry) => (
                      <li key={entry.id}>
                        <span className="font-medium">{auditActionLabel(entry.action)}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          · {formatDateTime(entry.created_at)}
                          {entry.actor && ` · par ${entry.actor.name}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune action enregistrée.</p>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
      <ConfirmDialog request={confirm} pending={sendReset.isPending} onClose={() => setConfirm(null)} />
    </Sheet>
  )
}
