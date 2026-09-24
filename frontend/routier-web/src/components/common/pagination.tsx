import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PaginationMeta } from '@/types/api'

export function Pagination({ meta, onPageChange }: { meta: PaginationMeta; onPageChange: (page: number) => void }) {
  if (meta.last_page <= 1) return null

  return (
    <nav className="flex items-center justify-between gap-2" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={meta.current_page <= 1} onClick={() => onPageChange(meta.current_page - 1)}>
        <ChevronLeft aria-hidden="true" />
        Précédent
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {meta.current_page} sur {meta.last_page}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={meta.current_page >= meta.last_page}
        onClick={() => onPageChange(meta.current_page + 1)}
      >
        Suivant
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  )
}
