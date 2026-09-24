import { AxiosError, AxiosHeaders } from 'axios'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'

function apiError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  })
}

describe('api-error', () => {
  it('extracts the first validation message per field', () => {
    const error = apiError(422, {
      message: 'Données invalides.',
      errors: { email: ['Cette valeur de e-mail est déjà utilisée.', 'autre'], 'passengers.0.full_name': ['Obligatoire.'] },
    })

    expect(getFieldErrors(error)).toEqual({
      email: 'Cette valeur de e-mail est déjà utilisée.',
      'passengers.0.full_name': 'Obligatoire.',
    })
  })

  it('returns business messages from the API (409, 503)', () => {
    expect(getErrorMessage(apiError(409, { message: 'Places insuffisantes : il reste 2 place(s) sur ce trajet.' }))).toBe(
      'Places insuffisantes : il reste 2 place(s) sur ce trajet.',
    )
    expect(getErrorMessage(apiError(503, { message: "Le paiement par Orange Money n'est pas encore disponible." }))).toBe(
      "Le paiement par Orange Money n'est pas encore disponible.",
    )
  })

  it('hides internal server details', () => {
    expect(getErrorMessage(apiError(500, { message: 'SQLSTATE[HY000] ...' }))).toBe('Une erreur est survenue. Veuillez réessayer.')
  })

  it('explains network and rate-limit errors', () => {
    expect(getErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toContain('Impossible de joindre le serveur')
    expect(getErrorMessage(apiError(429, { message: 'Too Many Attempts.' }))).toContain('Trop de tentatives')
  })
})
