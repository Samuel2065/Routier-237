import { isValidPhone, normalizePhone, safeRedirect } from '@/lib/validation'

describe('validation', () => {
  it('accepts Cameroonian phone numbers', () => {
    expect(isValidPhone('699 12 34 56')).toBe(true)
    expect(isValidPhone('+237677000000')).toBe(true)
    expect(isValidPhone('222-00-00-00')).toBe(true)
    expect(isValidPhone('12345')).toBe(false)
    expect(isValidPhone('799123456')).toBe(false)
    expect(normalizePhone('699 12.34-56')).toBe('699123456')
  })

  it('only allows internal redirects', () => {
    expect(safeRedirect('/booking/12?passengers=2')).toBe('/booking/12?passengers=2')
    expect(safeRedirect('https://evil.example')).toBe('/account')
    expect(safeRedirect('//evil.example')).toBe('/account')
    expect(safeRedirect('/\\evil.example')).toBe('/account')
    expect(safeRedirect(null, '/')).toBe('/')
  })
})
