import { z } from 'zod'
import { isValidPhone, normalizePhone } from '@/lib/validation'

export const loginSchema = z.object({
  email: z.string().trim().min(1, { error: "L'adresse e-mail est obligatoire." }).email({ error: 'Adresse e-mail invalide.' }),
  password: z.string().min(1, { error: 'Le mot de passe est obligatoire.' }),
})

export type LoginValues = z.infer<typeof loginSchema>

/** Mot de passe choisi par l'utilisateur : règles alignées sur l'API (8 caractères, lettres et chiffres). */
export const newPasswordSchema = z
  .string()
  .min(8, { error: 'Au moins 8 caractères.' })
  .regex(/[A-Za-z]/, { error: 'Au moins une lettre.' })
  .regex(/\d/, { error: 'Au moins un chiffre.' })

/**
 * Inscription publique : comptes clients uniquement (§6.1).
 * Règles alignées sur l'API (8 caractères, lettres et chiffres).
 */
export const registerSchema = z
  .object({
    name: z.string().trim().min(2, { error: 'Indiquez votre nom complet.' }).max(150),
    email: z.string().trim().min(1, { error: "L'adresse e-mail est obligatoire." }).email({ error: 'Adresse e-mail invalide.' }),
    phone: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidPhone(value), { error: 'Numéro camerounais invalide (ex. 699 12 34 56).' })
      .transform((value) => (value === '' ? null : normalizePhone(value))),
    password: newPasswordSchema,
    password_confirmation: z.string(),
  })
  .refine((values) => values.password === values.password_confirmation, {
    path: ['password_confirmation'],
    error: 'Les mots de passe ne correspondent pas.',
  })

export type RegisterInput = z.input<typeof registerSchema>
export type RegisterValues = z.output<typeof registerSchema>

/** « Mot de passe oublié ? » */
export const forgotPasswordSchema = loginSchema.pick({ email: true })

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

/** Nouveau mot de passe depuis le lien reçu par e-mail. */
export const resetPasswordSchema = z
  .object({ password: newPasswordSchema, password_confirmation: z.string() })
  .refine((values) => values.password === values.password_confirmation, {
    path: ['password_confirmation'],
    error: 'Les mots de passe ne correspondent pas.',
  })

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
