import {
  ArrowRight,
  Baby,
  BadgeCheck,
  Bus,
  CalendarClock,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Scale,
  Search,
  ShieldCheck,
  Smartphone,
  Ticket,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import agencyFleet from "@/assets/landing/agency-fleet.webp";
import cityBamenda from "@/assets/landing/city-bamenda.webp";
import cityBertoua from "@/assets/landing/city-bertoua.webp";
import cityDouala from "@/assets/landing/city-douala.webp";
import cityYaounde from "@/assets/landing/city-yaounde.webp";
import heroRoute from "@/assets/landing/hero-route.webp";
import { ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AgencyCard } from "@/features/agencies/agency-card";
import { useAgencies } from "@/features/agencies/queries";
import { useCities, useTravelClasses } from "@/features/trips/queries";
import { SearchForm } from "@/features/trips/search-form";
import { useSession } from "@/store/auth-store";
import type { City } from "@/types/api";

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Search,
    title: "Recherchez",
    text: "Ville de départ, ville d’arrivée et date : les trajets disponibles s’affichent, sans créer de compte.",
  },
  {
    icon: Scale,
    title: "Comparez",
    text: "Horaire, classe, prix et places restantes de chaque agence, côte à côte.",
  },
  {
    icon: Ticket,
    title: "Réservez",
    text: "Indiquez vos passagers, enfants compris. Le compte n’est demandé qu’à cette étape.",
  },
  {
    icon: Wallet,
    title: "Payez",
    text: "Orange Money, MTN MoMo ou carte bancaire. Votre réservation est alors confirmée.",
  },
];

/** Illustrations des villes ; seules celles présentes dans le référentiel sont affichées. */
const CITY_IMAGES: Record<string, string> = {
  yaounde: cityYaounde,
  douala: cityDouala,
  bertoua: cityBertoua,
  bamenda: cityBamenda,
};

const TRAVELLER_BENEFITS: { icon: LucideIcon; title: string; text: string }[] =
  [
    {
      icon: Scale,
      title: "Recherche neutre",
      text: "Résultats classés par heure ou par prix, jamais par préférence pour une agence.",
    },
    {
      icon: Users,
      title: "Places restantes à jour",
      text: "Calculées à partir des réservations en cours : pas de surréservation.",
    },
    {
      icon: Baby,
      title: "Voyage en famille",
      text: "Une seule réservation pour plusieurs passagers, enfants sans compte compris.",
    },
    {
      icon: Smartphone,
      title: "Paiement mobile",
      text: "Orange Money et MTN MoMo, ou carte bancaire.",
    },
    {
      icon: Ticket,
      title: "Référence unique",
      text: "Chaque réservation a sa référence, retrouvée en un instant au guichet.",
    },
    {
      icon: ShieldCheck,
      title: "Suivi dans votre espace",
      text: "Statut, paiement et notifications de chaque voyage au même endroit.",
    },
  ];

const AGENCY_BENEFITS: { icon: LucideIcon; text: string }[] = [
  {
    icon: CalendarClock,
    text: "Planifiez vos départs et publiez-les en un clic.",
  },
  {
    icon: Ticket,
    text: "Recevez les réservations et retrouvez-les par référence au guichet.",
  },
  {
    icon: Bus,
    text: "Gérez vos véhicules VIP et Classique, et leur capacité.",
  },
  { icon: Users, text: "Donnez à chaque employé un accès adapté à son rôle." },
  {
    icon: CreditCard,
    text: "Suivez les encaissements et traitez les remboursements.",
  },
  {
    icon: LayoutDashboard,
    text: "Pilotez l’activité depuis un tableau de bord.",
  },
];

const FAQ: { question: string; answer: string }[] = [
  {
    question: "Faut-il un compte pour rechercher un trajet ?",
    answer:
      "Non. La recherche et la consultation des trajets et des agences sont libres. Un compte voyageur n’est demandé qu’au moment de réserver.",
  },
  {
    question: "Puis-je réserver pour plusieurs personnes, dont des enfants ?",
    answer:
      "Oui. Une réservation peut contenir plusieurs passagers. Les enfants sont enregistrés comme passagers, sans avoir besoin de leur propre compte.",
  },
  {
    question: "Comment payer ma réservation ?",
    answer:
      "Par Orange Money, MTN MoMo ou carte bancaire, depuis la page de votre réservation. Elle est confirmée dès que le paiement est validé.",
  },
  {
    question:
      "Combien de temps ma réservation est-elle gardée avant paiement ?",
    answer:
      "Vos places sont bloquées pendant un délai limité, affiché avec un compte à rebours sur la page de la réservation. Passé ce délai, la réservation expire.",
  },
  {
    question: "Puis-je choisir mon siège ?",
    answer:
      "Pas en ligne : vous réservez un nombre de places sur un trajet, et le nombre de places restantes est affiché avant la réservation.",
  },
  {
    question: "Puis-je annuler ou céder ma réservation ?",
    answer:
      "Vous pouvez l’annuler depuis votre espace avant le départ ; si vous aviez payé, le remboursement est traité par l’agence. Une réservation est nominative et ne peut pas être cédée.",
  },
  {
    question: "Quelle différence entre VIP et Classique ?",
    answer:
      "Ce sont des véhicules distincts, chacun avec sa propre capacité et son propre prix : pas deux zones dans un même car.",
  },
  {
    question:
      "Je suis une agence de transport : comment rejoindre Routier+237 ?",
    answer:
      "Les organisations de transport sont inscrites par l’administration de la plateforme. Leurs équipes se connectent ensuite par l’Espace agence.",
  },
];

function SectionHeading({
  id,
  eyebrow,
  title,
  text,
}: {
  id: string;
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="grid max-w-2xl gap-2">
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">
        {eyebrow}
      </p>
      <h2 id={id} className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {text && <p className="text-muted-foreground">{text}</p>}
    </div>
  );
}

function Section({
  id,
  className,
  children,
  labelledBy,
}: {
  id: string;
  className?: string;
  children: ReactNode;
  labelledBy: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`scroll-mt-20 py-16 sm:py-20 ${className ?? ""}`}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4">
        {children}
      </div>
    </section>
  );
}

function DestinationCard({
  city,
  image,
  agencyCount,
}: {
  city: City;
  image: string;
  agencyCount: number;
}) {
  return (
    <Link
      to={`/?destination=${city.id}#recherche`}
      className="group relative block aspect-[4/5] overflow-hidden rounded-2xl shadow-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:aspect-[3/4]"
    >
      <img
        src={image}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <span
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
        aria-hidden="true"
      />
      <span className="absolute inset-x-0 bottom-0 grid gap-1 p-5 text-white">
        <span className="text-xl font-semibold">{city.name}</span>
        {agencyCount > 0 && (
          <span className="text-sm text-white/85">
            {agencyCount} agence{agencyCount > 1 ? "s" : ""} sur place
          </span>
        )}
        <span className="mt-1 inline-flex items-center gap-1 text-sm font-medium">
          Voyager vers {city.name}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </span>
    </Link>
  );
}

/**
 * Page d'accueil publique : présentation de Routier+237, moteur de recherche,
 * destinations, agences, classes, avantages, FAQ. Seules des données de l'API ou
 * des textes éditoriaux sont affichés (aucune statistique ni aucun avis inventés).
 */
export function HomePage() {
  const agencies = useAgencies();
  const cities = useCities();
  const travelClasses = useTravelClasses();
  const customer = useSession("customer");
  const [searchParams] = useSearchParams();
  const { hash } = useLocation();

  // Destination pré-remplie depuis une carte de ville (?destination=ID#recherche).
  const destination = Number(searchParams.get("destination")) || undefined;
  const destinationCity = cities.data?.find((city) => city.id === destination);

  // Liens d'ancre (#destinations, #faq…) depuis la navigation.
  useEffect(() => {
    if (hash)
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, destination]);

  const agencyList = agencies.data?.data ?? [];
  const featuredCities = (cities.data ?? []).filter(
    (city) => CITY_IMAGES[city.slug],
  );
  const otherCities = (cities.data ?? []).filter(
    (city) => !CITY_IMAGES[city.slug],
  );
  const agenciesIn = (cityId: number) =>
    agencyList.filter((agency) => agency.city?.id === cityId).length;

  return (
    <>
      {/* Hero */}
      <section
        aria-labelledby="hero-title"
        className="relative isolate overflow-hidden bg-slate-900"
      >
        <img
          src={heroRoute}
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover"
          fetchPriority="high"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/85 via-slate-950/60 to-slate-950/20"
          aria-hidden="true"
        />
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-20 pb-36 text-white sm:pt-28 sm:pb-44">
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium backdrop-blur">
            <BadgeCheck className="size-4" aria-hidden="true" />
            Réservation de voyages routiers au Cameroun
          </p>
          <h1
            id="hero-title"
            className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            Voyagez sereinement sur les routes du Cameroun
          </h1>
          <p className="max-w-2xl text-lg text-white/85">
            Comparez les départs des agences de transport, choisissez votre
            classe et réservez vos places en ligne, pour vous et toute votre
            famille. Payez par Orange Money, MTN MoMo ou carte.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="h-11 px-5 text-base" asChild>
              <a href="#recherche">
                <Search aria-hidden="true" />
                Rechercher un trajet
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 border-white/40 bg-white/10 px-5 text-base text-white hover:bg-white/20 hover:text-white"
              asChild
            >
              <a href="#agences">Découvrir les agences</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Recherche, à cheval sur le hero */}
      <div
        id="recherche"
        className="relative z-10 mx-auto -mt-24 w-full max-w-6xl scroll-mt-24 px-4 sm:-mt-28"
      >
        <Card className="shadow-card-hover [--card-spacing:--spacing(6)]">
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Où allez-vous ?</h2>
              {destinationCity && (
                <p className="text-sm text-muted-foreground">
                  Destination choisie : {destinationCity.name}
                </p>
              )}
            </div>
            <SearchForm
              key={destination ?? "none"}
              inline
              defaultValues={
                destination ? { destination_city_id: destination } : undefined
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Fonctionnement */}
      <Section id="fonctionnement" labelledBy="how-title">
        <SectionHeading
          id="how-title"
          eyebrow="Comment ça marche"
          title="Votre voyage en quatre étapes"
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              className="relative grid gap-3 rounded-2xl border bg-card p-6 shadow-card"
            >
              <span className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span
                  className="text-3xl font-bold text-muted-foreground/30 tabular-nums"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
              </span>
              <p className="font-semibold">
                <span className="sr-only">Étape {index + 1} : </span>
                {title}
              </p>
              <p className="text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Destinations */}
      <Section
        id="destinations"
        labelledBy="destinations-title"
        className="bg-muted/40"
      >
        <SectionHeading
          id="destinations-title"
          eyebrow="Destinations"
          title="Des villes reliées par les agences partenaires"
          text="Choisissez une ville pour la définir comme destination de votre recherche."
        />
        {cities.isPending && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        )}
        {cities.isError && <ErrorState onRetry={() => cities.refetch()} />}
        {cities.data && (
          <>
            {featuredCities.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {featuredCities.map((city) => (
                  <DestinationCard
                    key={city.id}
                    city={city}
                    image={CITY_IMAGES[city.slug]}
                    agencyCount={agenciesIn(city.id)}
                  />
                ))}
              </div>
            )}
            {otherCities.length > 0 && (
              <div className="grid gap-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Autres villes desservies
                </p>
                <ul className="flex flex-wrap gap-2">
                  {otherCities.map((city) => (
                    <li key={city.id}>
                      <Link
                        to={`/?destination=${city.id}#recherche`}
                        className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm font-medium transition-colors outline-none hover:border-primary/40 hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <MapPin
                          className="size-3.5 text-primary"
                          aria-hidden="true"
                        />
                        {city.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Section>

      {/* Agences partenaires */}
      <Section id="agences" labelledBy="agencies-title">
        <SectionHeading
          id="agencies-title"
          eyebrow="Agences partenaires"
          title="Les agences présentes sur Routier+237"
          text="Consultez leurs coordonnées et leurs prochains départs publiés."
        />
        {agencies.isPending && <LoadingState rows={2} />}
        {agencies.isError && <ErrorState onRetry={() => agencies.refetch()} />}
        {agencies.data && agencyList.length === 0 && (
          <p className="text-muted-foreground">
            Aucune agence n’est encore en ligne.
          </p>
        )}
        {agencyList.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agencyList.map((agency) => (
              <AgencyCard key={agency.id} agency={agency} />
            ))}
          </div>
        )}
      </Section>

      {/* Avantages voyageurs */}
      <Section
        id="avantages"
        labelledBy="benefits-title"
        className="bg-muted/40"
      >
        <SectionHeading
          id="benefits-title"
          eyebrow="Pour les voyageurs"
          title="Pensé pour voyager l’esprit tranquille"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRAVELLER_BENEFITS.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="flex gap-4 rounded-2xl border bg-card p-6 shadow-card"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="grid gap-1">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Classes de voyage */}
      <Section id="classes" labelledBy="classes-title">
        <SectionHeading
          id="classes-title"
          eyebrow="Classes de voyage"
          title="VIP ou Classique : à vous de choisir"
          text="Chaque classe correspond à des véhicules distincts : la capacité et le prix sont ceux du trajet choisi."
        />
        {travelClasses.isPending && <LoadingState rows={1} />}
        {travelClasses.isError && (
          <ErrorState onRetry={() => travelClasses.refetch()} />
        )}
        {travelClasses.data && (
          <div className="grid gap-4 md:grid-cols-2">
            {travelClasses.data.map((travelClass) => (
              <div
                key={travelClass.id}
                className="grid gap-3 rounded-2xl border bg-card p-6 shadow-card"
              >
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  <Bus className="size-4" aria-hidden="true" />
                  {travelClass.name}
                </span>
                {travelClass.description && (
                  <p className="text-muted-foreground">
                    {travelClass.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Pour les agences */}
      <section
        id="pour-les-agences"
        aria-labelledby="for-agencies-title"
        className="scroll-mt-20 bg-slate-900 py-16 text-white sm:py-20"
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
          <div className="grid gap-6">
            <div className="grid gap-2">
              <p className="text-sm font-semibold tracking-wide text-emerald-300 uppercase">
                Pour les agences de transport
              </p>
              <h2
                id="for-agencies-title"
                className="text-2xl font-semibold tracking-tight sm:text-3xl"
              >
                Un logiciel de gestion complet pour votre agence
              </h2>
              <p className="text-white/75">
                Vos trajets publiés sont visibles des voyageurs, et votre équipe
                gère toute l’activité depuis un espace privé.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {AGENCY_BENEFITS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-sm text-white/90">
                  <Icon
                    className="mt-0.5 size-5 shrink-0 text-emerald-300"
                    aria-hidden="true"
                  />
                  {text}
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="h-11 w-fit bg-white px-5 text-base text-slate-900 hover:bg-white/90"
              asChild
            >
              <Link to="/agency/login">
                Accéder à l’espace agence
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <img
            src={agencyFleet}
            alt=""
            loading="lazy"
            className="aspect-3/2 w-full rounded-2xl object-cover shadow-2xl"
          />
        </div>
      </section>

      {/* FAQ */}
      <Section id="faq" labelledBy="faq-title">
        <SectionHeading
          id="faq-title"
          eyebrow="Questions fréquentes"
          title="Vous avez une question ?"
        />
        <div className="grid gap-3">
          {FAQ.map(({ question, answer }) => (
            <details
              key={question}
              className="group rounded-xl border bg-card shadow-card open:shadow-card-hover"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl p-5 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-5 pb-5 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Appel final */}
      <section aria-labelledby="cta-title" className="px-4 pb-16 sm:pb-20">
        <div className="mx-auto grid w-full max-w-6xl gap-6 rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
          <h2
            id="cta-title"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Prêt pour votre prochain voyage ?
          </h2>
          <p className="mx-auto max-w-xl text-primary-foreground/85">
            Trouvez votre départ en quelques secondes et réservez vos places en
            ligne.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              size="lg"
              className="h-11 bg-white px-5 text-base text-primary hover:bg-white/90"
              asChild
            >
              <a href="#recherche">
                <Search aria-hidden="true" />
                Rechercher un trajet
              </a>
            </Button>
            {!customer && (
              <Button
                size="lg"
                variant="outline"
                className="h-11 border-white/50 bg-transparent px-5 text-base text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link to="/register">Créer un compte voyageur</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
