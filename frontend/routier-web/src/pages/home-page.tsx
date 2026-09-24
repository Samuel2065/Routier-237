import { CreditCard, Search, Ticket } from 'lucide-react'
import { Container } from '@/components/layout/container'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Card, CardContent } from '@/components/ui/card'
import { AgencyCard } from '@/features/agencies/agency-card'
import { useAgencies } from '@/features/agencies/queries'
import { SearchForm } from '@/features/trips/search-form'

const STEPS = [
  { icon: Search, title: 'Recherchez', text: 'Ville de départ, ville d’arrivée et date : les trajets disponibles s’affichent, sans compte.' },
  { icon: Ticket, title: 'Réservez', text: 'Choisissez un trajet et indiquez vos passagers, enfants compris.' },
  { icon: CreditCard, title: 'Payez', text: 'Orange Money, MTN MoMo ou carte bancaire. Votre réservation est confirmée.' },
]

export function HomePage() {
  const agencies = useAgencies()

  return (
    <>
      <section className="border-b bg-gradient-to-b from-secondary to-background">
        <Container className="grid gap-8 py-12 sm:py-16">
          <div className="grid max-w-2xl gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Voyagez sur les routes du Cameroun</h1>
            <p className="text-lg text-muted-foreground">
              Comparez les horaires, classes et prix des agences de transport, puis réservez vos places en ligne.
            </p>
          </div>
          <Card>
            <CardContent>
              <SearchForm inline />
            </CardContent>
          </Card>
        </Container>
      </section>

      <Container className="grid gap-12">
        <section aria-labelledby="how-it-works" className="grid gap-6">
          <h2 id="how-it-works" className="text-xl font-semibold">
            Comment ça marche
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="grid gap-1">
                  <p className="font-medium">
                    {index + 1}. {title}
                  </p>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="agencies" className="grid gap-6">
          <h2 id="agencies" className="text-xl font-semibold">
            Agences partenaires
          </h2>
          {agencies.isPending && <LoadingState rows={2} />}
          {agencies.isError && <ErrorState onRetry={() => agencies.refetch()} />}
          {agencies.data && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agencies.data.data.map((agency) => (
                <AgencyCard key={agency.id} agency={agency} />
              ))}
            </div>
          )}
        </section>
      </Container>
    </>
  )
}
