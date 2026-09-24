import { useSearchParams } from 'react-router'

/**
 * Filtres de liste portés par l'URL (rechargement, partage, bouton retour).
 * Changer un filtre ramène à la première page.
 */
export function useUrlFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const get = (key: string): string | undefined => searchParams.get(key) || undefined

  const getNumber = (key: string): number | undefined => {
    const value = Number(searchParams.get(key))
    return Number.isInteger(value) && value > 0 ? value : undefined
  }

  const set = (key: string, value: string | number | undefined | null) => {
    const next = new URLSearchParams(searchParams)
    if (value === undefined || value === null || value === '') next.delete(key)
    else next.set(key, String(value))
    if (key !== 'page') next.delete('page')
    setSearchParams(next, { replace: true })
  }

  const page = getNumber('page') ?? 1

  return { get, getNumber, set, page, setPage: (value: number) => set('page', value > 1 ? value : undefined) }
}
