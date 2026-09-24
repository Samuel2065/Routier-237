import { addDays, formatDate, formatDuration, formatPrice, formatTime, pluralize, todayInCameroon } from '@/lib/format'

// Intl insère des espaces insécables : on les normalise pour comparer.
const plain = (value: string) => value.replace(/[\u00a0\u202f]/g, ' ')

describe('format', () => {
  it('formats prices in FCFA without decimals', () => {
    expect(plain(formatPrice(7000))).toBe('7 000 FCFA')
    expect(plain(formatPrice(150000))).toBe('150 000 FCFA')
  })

  it('formats dates in French without timezone shift', () => {
    expect(formatDate('2026-09-25')).toBe('vendredi 25 septembre 2026')
    expect(formatDate('2026-01-01', 'short')).toBe('jeu. 1 janv.')
  })

  it('formats times in Cameroon time', () => {
    // 05:00 UTC = 06:00 à Douala (UTC+1).
    expect(formatTime('2026-09-25T05:00:00Z')).toBe('06:00')
  })

  it('formats durations', () => {
    expect(formatDuration(330)).toBe('5 h 30')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(null)).toBeNull()
  })

  it('computes dates in Cameroon', () => {
    // 23:30 UTC le 24 = 00:30 le 25 à Douala.
    expect(todayInCameroon(new Date('2026-09-24T23:30:00Z'))).toBe('2026-09-25')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('pluralizes French words', () => {
    expect(pluralize(1, 'passager')).toBe('1 passager')
    expect(pluralize(3, 'passager')).toBe('3 passagers')
  })
})
