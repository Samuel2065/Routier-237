import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/common/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateAgencySettings } from '@/features/agency/queries'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { fieldAria } from '@/lib/field-aria'
import { isValidPhone, normalizePhone } from '@/lib/validation'
import type { ManagedAgency, Organization } from '@/types/api'

const emailField = z.string().trim().refine((value) => value === '' || z.email().safeParse(value).success, { error: 'Adresse e-mail invalide.' })
const phoneField = z.string().trim().refine((value) => value === '' || isValidPhone(value), { error: 'Numéro camerounais invalide.' })

const settingsSchema = z.object({
  email: emailField,
  phone: phoneField,
  address: z.string().trim().max(255),
  description: z.string().trim().max(2000),
})

/**
 * Paramètres de l'agence par son responsable : coordonnées et présentation publique.
 */
export function AgencySettingsForm({ agency }: { agency: ManagedAgency }) {
  const update = useUpdateAgencySettings()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
    reset,
  } = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      email: agency.email ?? '',
      phone: agency.phone ?? '',
      address: agency.address ?? '',
      description: agency.description ?? '',
    },
  })

  const onSubmit = handleSubmit((values) =>
    update.mutate(
      {
        id: agency.id,
        input: {
          email: values.email || null,
          phone: values.phone ? normalizePhone(values.phone) : null,
          address: values.address || null,
          description: values.description || null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Paramètres enregistrés.')
          reset(values)
        },
        onError: (error) => {
          applyServerErrors(error, setError)
        },
      },
    ),
  )

  const generalError = update.isError && Object.keys(getFieldErrors(update.error)).length === 0 ? getErrorMessage(update.error) : null

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="settings-email" label="E-mail de l'agence" error={errors.email?.message}>
          <Input type="email" {...fieldAria('settings-email', errors.email?.message)} {...register('email')} />
        </FormField>
        <FormField id="settings-phone" label="Téléphone" error={errors.phone?.message}>
          <Input type="tel" {...fieldAria('settings-phone', errors.phone?.message)} {...register('phone')} />
        </FormField>
      </div>
      <FormField id="settings-address" label="Adresse" error={errors.address?.message}>
        <Input {...fieldAria('settings-address', errors.address?.message)} {...register('address')} />
      </FormField>
      <FormField id="settings-description" label="Présentation publique" hint="Affichée sur la page publique de l'agence." error={errors.description?.message}>
        <Textarea rows={4} {...fieldAria('settings-description', errors.description?.message, "Affichée sur la page publique de l'agence.")} {...register('description')} />
      </FormField>
      {generalError && (
        <Alert variant="destructive">
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-fit" disabled={update.isPending || !isDirty}>
        {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
        Enregistrer
      </Button>
    </form>
  )
}

const organizationSchema = z.object({
  name: z.string().trim().min(2, { error: "Indiquez le nom de l'organisation." }).max(150),
  email: emailField,
  phone: phoneField,
  address: z.string().trim().max(255),
})

/**
 * Profil d'une organisation (director pour la sienne, ou plateforme). Le statut se gère à part.
 */
/**
 * Ce dont le formulaire a besoin d'une mutation d'enregistrement (espace agence ou administration).
 */
export interface SaveOrganizationMutation {
  mutate: (
    variables: { id: number; input: { name?: string; email?: string | null; phone?: string | null; address?: string | null } },
    options?: { onSuccess?: () => void; onError?: (error: Error) => void },
  ) => void
  isPending: boolean
  isError: boolean
  error: Error | null
}

export function OrganizationForm({ organization, save: update }: { organization: Organization; save: SaveOrganizationMutation }) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<z.infer<typeof organizationSchema>>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: organization.name,
      email: organization.email ?? '',
      phone: organization.phone ?? '',
      address: organization.address ?? '',
    },
  })

  const onSubmit = handleSubmit((values) =>
    update.mutate(
      {
        id: organization.id,
        input: {
          name: values.name,
          email: values.email || null,
          phone: values.phone ? normalizePhone(values.phone) : null,
          address: values.address || null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Organisation mise à jour.')
          reset(values)
        },
        onError: (error) => {
          applyServerErrors(error, setError)
        },
      },
    ),
  )

  const generalError = update.isError && Object.keys(getFieldErrors(update.error)).length === 0 ? getErrorMessage(update.error) : null

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField id="organization-name" label="Nom" required error={errors.name?.message}>
        <Input {...fieldAria('organization-name', errors.name?.message)} {...register('name')} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="organization-email" label="E-mail" error={errors.email?.message}>
          <Input type="email" {...fieldAria('organization-email', errors.email?.message)} {...register('email')} />
        </FormField>
        <FormField id="organization-phone" label="Téléphone" error={errors.phone?.message}>
          <Input type="tel" {...fieldAria('organization-phone', errors.phone?.message)} {...register('phone')} />
        </FormField>
      </div>
      <FormField id="organization-address" label="Adresse" error={errors.address?.message}>
        <Input {...fieldAria('organization-address', errors.address?.message)} {...register('address')} />
      </FormField>
      {generalError && (
        <Alert variant="destructive">
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-fit" disabled={update.isPending || !isDirty}>
        {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
        Enregistrer
      </Button>
    </form>
  )
}
