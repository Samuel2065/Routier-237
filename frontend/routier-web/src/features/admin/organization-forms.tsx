import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/common/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useCreateDirector, useSaveOrganization } from '@/features/admin/queries'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { fieldAria } from '@/lib/field-aria'
import { isValidPhone, normalizePhone } from '@/lib/validation'
import type { Organization } from '@/types/api'

const phoneField = z.string().trim().refine((value) => value === '' || isValidPhone(value), { error: 'Numéro camerounais invalide.' })

const organizationSchema = z.object({
  name: z.string().trim().min(2, { error: "Indiquez le nom de l'organisation." }).max(150),
  email: z.string().trim().refine((value) => value === '' || z.email().safeParse(value).success, { error: 'Adresse e-mail invalide.' }),
  phone: phoneField,
  address: z.string().trim().max(255),
})

/**
 * Création d'une organisation (entreprise de transport) par la plateforme.
 */
export function CreateOrganizationSheet({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (organization: Organization) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nouvelle organisation</SheetTitle>
          <SheetDescription>Créez ensuite son directeur, qui gérera ses agences.</SheetDescription>
        </SheetHeader>
        {open && <CreateOrganizationForm onCreated={onCreated} onCancel={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function CreateOrganizationForm({ onCreated, onCancel }: { onCreated: (organization: Organization) => void; onCancel: () => void }) {
  const save = useSaveOrganization()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<z.infer<typeof organizationSchema>>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: '', email: '', phone: '', address: '' },
  })

  const onSubmit = handleSubmit((values) =>
    save.mutate(
      {
        input: {
          name: values.name,
          email: values.email || null,
          phone: values.phone ? normalizePhone(values.phone) : null,
          address: values.address || null,
        },
      },
      {
        onSuccess: (organization) => {
          toast.success(`Organisation « ${organization.name} » créée.`)
          onCreated(organization)
        },
        onError: (error) => {
          applyServerErrors(error, setError)
        },
      },
    ),
  )

  const generalError = save.isError && Object.keys(getFieldErrors(save.error)).length === 0 ? getErrorMessage(save.error) : null

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 px-4 pb-6">
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
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Créer l'organisation
        </Button>
      </div>
    </form>
  )
}

const directorSchema = z.object({
  name: z.string().trim().min(2, { error: 'Indiquez le nom complet.' }).max(150),
  email: z.string().trim().email({ error: 'Adresse e-mail invalide.' }),
  phone: phoneField,
  password: z
    .string()
    .min(8, { error: '8 caractères minimum.' })
    .regex(/[A-Za-z]/, { error: 'Au moins une lettre.' })
    .regex(/\d/, { error: 'Au moins un chiffre.' }),
})

/**
 * Compte du directeur d'une organisation (§6.1) : mot de passe initial à lui transmettre.
 */
export function CreateDirectorSheet({ organization, open, onOpenChange }: { organization: Organization; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nouveau directeur</SheetTitle>
          <SheetDescription>{organization.name} — il pourra se connecter à l'espace agence.</SheetDescription>
        </SheetHeader>
        {open && <CreateDirectorForm organizationId={organization.id} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function CreateDirectorForm({ organizationId, onDone }: { organizationId: number; onDone: () => void }) {
  const createDirector = useCreateDirector(organizationId)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<z.infer<typeof directorSchema>>({
    resolver: zodResolver(directorSchema),
    defaultValues: { name: '', email: '', phone: '', password: '' },
  })

  const onSubmit = handleSubmit((values) =>
    createDirector.mutate(
      { ...values, phone: values.phone ? normalizePhone(values.phone) : null },
      {
        onSuccess: () => {
          toast.success('Directeur créé : communiquez-lui son mot de passe initial.')
          onDone()
        },
        onError: (error) => {
          applyServerErrors(error, setError)
        },
      },
    ),
  )

  const generalError = createDirector.isError && Object.keys(getFieldErrors(createDirector.error)).length === 0 ? getErrorMessage(createDirector.error) : null

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 px-4 pb-6">
      <FormField id="director-name" label="Nom complet" required error={errors.name?.message}>
        <Input autoComplete="off" {...fieldAria('director-name', errors.name?.message)} {...register('name')} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="director-email" label="E-mail (identifiant)" required error={errors.email?.message}>
          <Input type="email" autoComplete="off" {...fieldAria('director-email', errors.email?.message)} {...register('email')} />
        </FormField>
        <FormField id="director-phone" label="Téléphone" error={errors.phone?.message}>
          <Input type="tel" {...fieldAria('director-phone', errors.phone?.message)} {...register('phone')} />
        </FormField>
      </div>
      <FormField id="director-password" label="Mot de passe initial" required hint="8 caractères minimum, avec lettres et chiffres." error={errors.password?.message}>
        <Input
          type="password"
          autoComplete="new-password"
          {...fieldAria('director-password', errors.password?.message, '8 caractères minimum, avec lettres et chiffres.')}
          {...register('password')}
        />
      </FormField>
      {generalError && (
        <Alert variant="destructive">
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={createDirector.isPending}>
          {createDirector.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Créer le directeur
        </Button>
      </div>
    </form>
  )
}
