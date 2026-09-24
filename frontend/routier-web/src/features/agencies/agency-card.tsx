import { Building2, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import type { PublicAgency } from '@/types/api'

export function AgencyCard({ agency }: { agency: PublicAgency }) {
  return (
    <Link to={`/agencies/${agency.id}`} className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div className="grid gap-0.5">
            <p className="font-medium group-hover:underline">{agency.name}</p>
            {agency.organization && <p className="text-sm text-muted-foreground">{agency.organization.name}</p>}
            {agency.city && (
              <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden="true" />
                {agency.city.name}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
