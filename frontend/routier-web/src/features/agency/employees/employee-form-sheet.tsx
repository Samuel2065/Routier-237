import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import type { EmployeeInput } from '@/api/agency'
import { FormField } from '@/components/common/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AgencySelect } from '@/features/agency/agency-select'
import { useSaveEmployee } from '@/features/agency/queries'
import { useIsMultiAgency } from '@/features/agency/session'
import { applyServerErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { fieldAria } from '@/lib/field-aria'
import { todayInCameroon } from '@/lib/format'
import { EMPLOYEE_STATUS_LABELS, ROLE_LABELS } from '@/lib/labels'
import { isValidPhone, normalizePhone } from '@/lib/validation'
import { useSession } from '@/store/auth-store'
import type { Employee, EmployeeStatus, RoleName } from '@/types/api'

const STATUSES: EmployeeStatus[] = ['active', 'suspended', 'terminated']

function makeSchema(editing: boolean) {
  return z
    .object({
      agency_id: z.number().int().positive().optional(),
      role: z.string({ error: 'Choisissez le rôle.' }).min(1, { error: 'Choisissez le rôle.' }),
      name: z.string().trim().min(2, { error: 'Indiquez le nom complet.' }).max(150),
      email: z.string().trim().email({ error: 'Adresse e-mail invalide.' }),
      phone: z.string().trim().refine((value) => value === '' || isValidPhone(value), { error: 'Numéro camerounais invalide.' }),
      password: editing
        ? z.string().refine((value) => value === '' || (value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value)), {
            error: '8 caractères minimum, avec lettres et chiffres.',
          })
        : z
            .string()
            .min(8, { error: '8 caractères minimum.' })
            .regex(/[A-Za-z]/, { error: 'Au moins une lettre.' })
            .regex(/\d/, { error: 'Au moins un chiffre.' }),
      employee_number: z.string().trim().min(1, { error: 'Indiquez le matricule.' }).max(50),
      hired_at: z.string(),
      status: z.enum(['active', 'suspended', 'terminated']),
      license_number: z.string().trim(),
      license_expires_at: z.string(),
    })
    .superRefine((values, context) => {
      if (values.role !== 'driver') return
      if (!editing && values.license_number === '') {
        context.addIssue({ code: 'custom', path: ['license_number'], message: 'Numéro de permis obligatoire pour un conducteur.' })
      }
      if (!editing && values.license_expires_at === '') {
        context.addIssue({ code: 'custom', path: ['license_expires_at'], message: "Date d'expiration obligatoire." })
      }
      if (values.license_expires_at !== '' && values.license_expires_at <= todayInCameroon()) {
        context.addIssue({ code: 'custom', path: ['license_expires_at'], message: 'Le permis doit être valide.' })
      }
    })
}

type EmployeeFormValues = z.infer<ReturnType<typeof makeSchema>>

export function EmployeeFormSheet({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (open: boolean) => void; employee?: Employee }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {open && <EmployeeForm key={employee?.id ?? 'new'} employee={employee} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

/**
 * Création et gestion d'un membre du personnel : compte, profil employé et, pour un
 * conducteur, permis. Seuls les rôles attribuables par l'utilisateur sont proposés.
 */
function EmployeeForm({ employee, onDone }: { employee?: Employee; onDone: () => void }) {
  const session = useSession('agency')
  const multiAgency = useIsMultiAgency()
  const saveEmployee = useSaveEmployee()
  const editing = !!employee
  const assignableRoles: RoleName[] = session?.user.assignable_roles ?? []

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(makeSchema(editing)),
    defaultValues: employee
      ? {
          role: employee.role ?? '',
          name: employee.user.name,
          email: employee.user.email,
          phone: employee.user.phone ?? '',
          password: '',
          employee_number: employee.employee_number,
          hired_at: employee.hired_at ?? '',
          status: employee.status,
          license_number: employee.driver_profile?.license_number ?? '',
          license_expires_at: employee.driver_profile?.license_expires_at ?? '',
        }
      : { role: '', name: '', email: '', phone: '', password: '', employee_number: '', hired_at: '', status: 'active', license_number: '', license_expires_at: '' },
  })
  const role = useWatch({ control, name: 'role' })
  const isDriver = role === 'driver'

  const onSubmit = handleSubmit((values) => {
    if (!editing && multiAgency && !values.agency_id) {
      setError('agency_id', { message: "Choisissez l'agence." })
      return
    }

    const input: EmployeeInput = {
      role: values.role as RoleName,
      name: values.name,
      email: values.email,
      phone: values.phone === '' ? null : normalizePhone(values.phone),
      employee_number: values.employee_number,
      hired_at: values.hired_at === '' ? null : values.hired_at,
      ...(values.password !== '' ? { password: values.password } : {}),
      ...(editing ? { status: values.status } : {}),
      ...(isDriver && values.license_number !== '' ? { license_number: values.license_number } : {}),
      ...(isDriver && values.license_expires_at !== '' ? { license_expires_at: values.license_expires_at } : {}),
      ...(!editing && multiAgency ? { agency_id: values.agency_id } : {}),
    }

    saveEmployee.mutate(
      { id: employee?.id, input },
      {
        onSuccess: () => {
          toast.success(editing ? 'Fiche mise à jour.' : 'Membre du personnel créé : communiquez-lui son mot de passe initial.')
          onDone()
        },
        onError: (error) => {
          applyServerErrors(error, setError)
        },
      },
    )
  })

  const generalError = saveEmployee.isError && Object.keys(getFieldErrors(saveEmployee.error)).length === 0 ? getErrorMessage(saveEmployee.error) : null

  return (
    <>
      <SheetHeader>
        <SheetTitle>{editing ? employee.user.name : 'Nouveau membre du personnel'}</SheetTitle>
        <SheetDescription>
          {editing ? 'Un changement de mot de passe ou un départ déconnecte immédiatement la personne.' : 'Le compte est créé avec un mot de passe initial à lui transmettre.'}
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={onSubmit} noValidate className="grid gap-4 px-4 pb-6">
        {!editing && multiAgency && (
          <FormField id="employee-agency" label="Agence" required error={errors.agency_id?.message}>
            <Controller
              control={control}
              name="agency_id"
              render={({ field }) => (
                <AgencySelect id="employee-agency" value={field.value} onChange={field.onChange} allowAll={false} className="w-full" invalid={!!errors.agency_id} />
              )}
            />
          </FormField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="employee-role" label="Rôle" required error={errors.role?.message}>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="employee-role" className="w-full" aria-invalid={!!errors.role || undefined}>
                    <SelectValue placeholder="Choisir un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((value) => (
                      <SelectItem key={value} value={value}>
                        {ROLE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField id="employee-number" label="Matricule" required error={errors.employee_number?.message}>
            <Input {...fieldAria('employee-number', errors.employee_number?.message)} {...register('employee_number')} />
          </FormField>
        </div>

        <FormField id="employee-name" label="Nom complet" required error={errors.name?.message}>
          <Input autoComplete="off" {...fieldAria('employee-name', errors.name?.message)} {...register('name')} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="employee-email" label="E-mail (identifiant)" required error={errors.email?.message}>
            <Input type="email" autoComplete="off" {...fieldAria('employee-email', errors.email?.message)} {...register('email')} />
          </FormField>
          <FormField id="employee-phone" label="Téléphone" error={errors.phone?.message}>
            <Input type="tel" {...fieldAria('employee-phone', errors.phone?.message)} {...register('phone')} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="employee-password"
            label={editing ? 'Nouveau mot de passe' : 'Mot de passe initial'}
            required={!editing}
            hint={editing ? 'Laisser vide pour ne pas le changer.' : undefined}
            error={errors.password?.message}
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...fieldAria('employee-password', errors.password?.message, editing ? 'Laisser vide pour ne pas le changer.' : undefined)}
              {...register('password')}
            />
          </FormField>
          <FormField id="employee-hired" label="Date d'embauche" error={errors.hired_at?.message}>
            <Input type="date" max={todayInCameroon()} {...fieldAria('employee-hired', errors.hired_at?.message)} {...register('hired_at')} />
          </FormField>
        </div>

        {editing && (
          <FormField id="employee-status" label="Statut" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="employee-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {EMPLOYEE_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
        )}

        {isDriver && (
          <>
            <Separator />
            <p className="text-sm font-medium">Permis de conduire</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="employee-license" label="Numéro de permis" required={!editing || !employee.driver_profile} error={errors.license_number?.message}>
                <Input {...fieldAria('employee-license', errors.license_number?.message)} {...register('license_number')} />
              </FormField>
              <FormField id="employee-license-expiry" label="Expire le" required={!editing || !employee.driver_profile} error={errors.license_expires_at?.message}>
                <Input type="date" {...fieldAria('employee-license-expiry', errors.license_expires_at?.message)} {...register('license_expires_at')} />
              </FormField>
            </div>
          </>
        )}

        {generalError && (
          <Alert variant="destructive">
            <AlertDescription>{generalError}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" disabled={saveEmployee.isPending}>
            {saveEmployee.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {editing ? 'Enregistrer' : 'Créer le compte'}
          </Button>
        </div>
      </form>
    </>
  )
}
