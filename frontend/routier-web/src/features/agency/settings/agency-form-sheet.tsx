import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { CitySelect } from '@/components/common/city-select'
import { FormField } from '@/components/common/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useSaveAgency } from '@/features/agency/queries'
import { useCities } from '@/features/trips/queries'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { fieldAria } from '@/lib/field-aria'
import { RECORD_STATUS_LABELS } from '@/lib/labels'
import { isValidPhone, normalizePhone } from '@/lib/validation'
import type { ManagedAgency } from '@/types/api'

const agencySchema = z.object({
  name: z.string().trim().min(2, { error: "Indiquez le nom de l'agence." }).max(150),
  city_id: z.number({ error: 'Choisissez la ville.' }).int().positive({ error: 'Choisissez la ville.' }),
  email: z.string().trim().refine((value) => value === '' || z.email().safeParse(value).success, { error: 'Adresse e-mail invalide.' }),
  phone: z.string().trim().refine((value) => value === '' || isValidPhone(value), { error: 'Numéro camerounais invalide.' }),
  address: z.string().trim().max(255),
  description: z.string().trim().max(2000),
  status: z.enum(['active', 'inactive']),
})

type AgencyFormValues = z.infer<typeof agencySchema>

export function AgencyFormSheet({ open, onOpenChange, agency }: { open: boolean; onOpenChange: (open: boolean) => void; agency?: ManagedAgency }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {open && <AgencyForm key={agency?.id ?? 'new'} agency={agency} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

/**
 * Création / modification d'une agence de l'organisation par le director.
 * Désactiver une agence la retire de la recherche et coupe l'accès de son personnel.
 */
function AgencyForm({ agency, onDone }: { agency?: ManagedAgency; onDone: () => void }) {
  const cities = useCities()
  const saveAgency = useSaveAgency()
  const editing = !!agency

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AgencyFormValues>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: agency?.name ?? '',
      city_id: agency?.city?.id,
      email: agency?.email ?? '',
      phone: agency?.phone ?? '',
      address: agency?.address ?? '',
      description: agency?.description ?? '',
      status: agency?.status ?? 'active',
    },
  })

  const onSubmit = handleSubmit((values) =>
    saveAgency.mutate(
      {
        id: agency?.id,
        input: {
          ...values,
          email: values.email || null,
          phone: values.phone ? normalizePhone(values.phone) : null,
          address: values.address || null,
          description: values.description || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(editing ? 'Agence mise à jour.' : 'Agence créée.')
          onDone()
        },
        onError: (error) => {
          applyServerErrors(error, setError)
        },
      },
    ),
  )

  const generalError = saveAgency.isError && Object.keys(getFieldErrors(saveAgency.error)).length === 0 ? getErrorMessage(saveAgency.error) : null

  return (
    <>
      <SheetHeader>
        <SheetTitle>{editing ? agency.name : 'Nouvelle agence'}</SheetTitle>
        <SheetDescription>Plusieurs agences d'une même organisation peuvent se trouver dans la même ville.</SheetDescription>
      </SheetHeader>

      <form onSubmit={onSubmit} noValidate className="grid gap-4 px-4 pb-6">
        <FormField id="agency-name" label="Nom" required error={errors.name?.message}>
          <Input {...fieldAria('agency-name', errors.name?.message)} {...register('name')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="agency-city" label="Ville" required error={errors.city_id?.message}>
            <Controller
              control={control}
              name="city_id"
              render={({ field }) => (
                <CitySelect id="agency-city" cities={cities.data ?? []} value={field.value} onChange={field.onChange} invalid={!!errors.city_id} />
              )}
            />
          </FormField>
          <FormField id="agency-status" label="Statut">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="agency-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{RECORD_STATUS_LABELS.active}</SelectItem>
                    <SelectItem value="inactive">{RECORD_STATUS_LABELS.inactive}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="agency-email" label="E-mail" error={errors.email?.message}>
            <Input type="email" {...fieldAria('agency-email', errors.email?.message)} {...register('email')} />
          </FormField>
          <FormField id="agency-phone" label="Téléphone" error={errors.phone?.message}>
            <Input type="tel" {...fieldAria('agency-phone', errors.phone?.message)} {...register('phone')} />
          </FormField>
        </div>
        <FormField id="agency-address" label="Adresse" error={errors.address?.message}>
          <Input {...fieldAria('agency-address', errors.address?.message)} {...register('address')} />
        </FormField>
        <FormField id="agency-description" label="Présentation publique" error={errors.description?.message}>
          <Textarea rows={4} {...fieldAria('agency-description', errors.description?.message)} {...register('description')} />
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
          <Button type="submit" disabled={saveAgency.isPending}>
            {saveAgency.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {editing ? 'Enregistrer' : "Créer l'agence"}
          </Button>
        </div>
      </form>
    </>
  )
}
