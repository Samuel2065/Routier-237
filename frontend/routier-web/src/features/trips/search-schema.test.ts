import { addDays, todayInCameroon } from '@/lib/format'
import { parseSearchParams, searchSchema, toSearchQuery } from '@/features/trips/search-schema'

const tomorrow = addDays(todayInCameroon(), 1)

describe('search schema', () => {
  it('accepts a complete search', () => {
    const result = searchSchema.safeParse({ departure_city_id: 1, destination_city_id: 2, date: tomorrow, passengers: 2 })
    expect(result.success).toBe(true)
  })

  it('rejects identical cities, past dates and invalid passenger counts', () => {
    const result = searchSchema.safeParse({
      departure_city_id: 1,
      destination_city_id: 1,
      date: addDays(todayInCameroon(), -1),
      passengers: 0,
    })

    expect(result.success).toBe(false)
    const messages = result.error?.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) ?? []
    expect(messages).toEqual(
      expect.arrayContaining([
        'passengers: Au moins 1 passager.',
      ]),
    )
  })

  it('requires both cities', () => {
    const result = searchSchema.safeParse({ date: tomorrow, passengers: 1 })
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining(['Choisissez la ville de départ.', "Choisissez la ville d'arrivée."]),
    )
  })

  it('reads criteria from the URL and ignores unknown sort values', () => {
    const params = new URLSearchParams(`departure_city_id=3&destination_city_id=1&date=${tomorrow}&passengers=2&sort=best&travel_class_id=2`)
    expect(parseSearchParams(params)).toEqual({
      departure_city_id: 3,
      destination_city_id: 1,
      date: tomorrow,
      passengers: 2,
      travel_class_id: 2,
    })

    expect(parseSearchParams(new URLSearchParams('departure_city_id=3'))).toBeNull()
  })

  it('builds shareable query strings', () => {
    expect(toSearchQuery({ departure_city_id: 3, destination_city_id: 1, date: tomorrow, passengers: 1, sort: undefined })).toBe(
      `departure_city_id=3&destination_city_id=1&date=${tomorrow}&passengers=1`,
    )
  })
})
