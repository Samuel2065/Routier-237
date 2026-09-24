import { emptyPassenger, makeBookingSchema, toPassengerPayload } from '@/features/reservations/booking-schema'

describe('booking schema', () => {
  it('accepts adults and children without account details', () => {
    const schema = makeBookingSchema(30)
    const result = schema.safeParse({
      passengers: [
        { full_name: 'Awa Nkoulou', passenger_type: 'adult', phone: '699 11 22 33', birth_date: '' },
        { full_name: 'Petit Nkoulou', passenger_type: 'child', phone: '', birth_date: '2019-04-12' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('limits passengers to the remaining seats', () => {
    const schema = makeBookingSchema(2)
    const passengers = Array.from({ length: 3 }, () => ({ ...emptyPassenger(), full_name: 'Voyageur Test' }))

    const result = schema.safeParse({ passengers })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('2 passager(s) au maximum pour ce trajet.')
  })

  it('never exceeds the API limit of 20 passengers', () => {
    const passengers = Array.from({ length: 21 }, () => ({ ...emptyPassenger(), full_name: 'Voyageur Test' }))
    expect(makeBookingSchema(70).safeParse({ passengers }).success).toBe(false)
  })

  it('validates each passenger', () => {
    const result = makeBookingSchema(10).safeParse({
      passengers: [{ full_name: 'A', passenger_type: 'adult', phone: '123', birth_date: '2999-01-01' }],
    })

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['passengers.0.full_name', 'passengers.0.phone', 'passengers.0.birth_date']),
    )
  })

  it('converts empty optional fields to null for the API', () => {
    expect(toPassengerPayload({ full_name: '  Awa  ', passenger_type: 'adult', phone: '699 11 22 33', birth_date: '' })).toEqual({
      full_name: 'Awa',
      passenger_type: 'adult',
      phone: '699112233',
      birth_date: null,
    })
  })
})
