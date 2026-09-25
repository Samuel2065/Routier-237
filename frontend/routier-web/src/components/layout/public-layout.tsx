import { Bus, LayoutDashboard, LogOut, Menu, Ticket, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useNavigate, type To } from 'react-router'
import { UserAvatar } from '@/components/common/user-avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useCustomerLogout } from '@/features/auth/queries'
import { useNotifications } from '@/features/notifications/queries'
import { useSession } from '@/store/auth-store'

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Routier+237, accueil">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Bus className="size-5" aria-hidden="true" />
      </span>
      <span className="text-lg">
        Routier<span className="text-primary">+237</span>
      </span>
    </Link>
  )
}

/** Sections de la page d'accueil, accessibles depuis toutes les pages publiques. */
const HOME_LINKS: { to: To; label: string }[] = [
  { to: { pathname: '/', hash: '#recherche' }, label: 'Rechercher' },
  { to: { pathname: '/', hash: '#destinations' }, label: 'Destinations' },
  { to: { pathname: '/', hash: '#agences' }, label: 'Agences' },
  { to: { pathname: '/', hash: '#fonctionnement' }, label: 'Comment ça marche' },
  { to: { pathname: '/', hash: '#faq' }, label: 'FAQ' },
]

const navLinkClass = 'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

function CustomerMenu() {
  const session = useSession('customer')
  const navigate = useNavigate()
  const logout = useCustomerLogout()
  const notifications = useNotifications({}, !!session)
  const unread = notifications.data?.unread_count ?? 0

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link to="/login">Connexion</Link>
        </Button>
        <Button asChild>
          <Link to="/register">Créer un compte</Link>
        </Button>
      </div>
    )
  }

  const { user } = session

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2 px-1.5 py-1" aria-label={`Menu du compte — ${user.name}${unread > 0 ? `, ${unread} notification(s) non lue(s)` : ''}`}>
          <span className="relative">
            <UserAvatar name={user.name} src={user.avatar_url} className="size-8" />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background" aria-hidden="true" />}
          </span>
          <span className="max-w-32 truncate text-sm font-medium">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-1.5">
        <DropdownMenuLabel className="grid gap-0.5 px-2 py-1.5">
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Utilisateur</span>
          <span className="truncate text-sm font-semibold text-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/account')} className="py-2">
          <LayoutDashboard aria-hidden="true" />
          Mon espace {unread > 0 && `(${unread})`}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/account/reservations')} className="py-2">
          <Ticket aria-hidden="true" />
          Mes réservations
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/account/profile')} className="py-2">
          <UserRound aria-hidden="true" />
          Mon profil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => logout.mutate(undefined, { onSettled: () => navigate('/') })} className="py-2">
          <LogOut aria-hidden="true" />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MobileMenu() {
  const [open, setOpen] = useState(false)
  const session = useSession('customer')
  const logout = useCustomerLogout()
  const navigate = useNavigate()
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label="Ouvrir le menu">
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">Navigation du site</SheetDescription>
        </SheetHeader>
        <nav className="grid gap-1 px-4" aria-label="Navigation mobile">
          {HOME_LINKS.map(({ to, label }) => (
            <Link key={label} to={to} className={navLinkClass} onClick={close}>
              {label}
            </Link>
          ))}
          <div className="my-2 border-t" />
          {session ? (
            <>
              <Link to="/account" className={navLinkClass} onClick={close}>
                Mon espace
              </Link>
              <Link to="/account/reservations" className={navLinkClass} onClick={close}>
                Mes réservations
              </Link>
              <Link to="/account/profile" className={navLinkClass} onClick={close}>
                Mon profil
              </Link>
              <button
                type="button"
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
                onClick={() =>
                  logout.mutate(undefined, {
                    onSettled: () => {
                      close()
                      navigate('/')
                    },
                  })
                }
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={navLinkClass} onClick={close}>
                Connexion
              </Link>
              <Button asChild className="mt-1">
                <Link to="/register" onClick={close}>
                  Créer un compte
                </Link>
              </Button>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

function Footer() {
  const session = useSession('customer')

  return (
    <footer className="border-t bg-slate-950 text-slate-300">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-white" aria-label="Routier+237, accueil">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Bus className="size-5" aria-hidden="true" />
            </span>
            Routier+237
          </Link>
          <p className="max-w-sm text-sm text-slate-400">
            Plateforme de recherche et de réservation de voyages routiers au Cameroun, et logiciel de gestion pour les agences de
            transport.
          </p>
          <p className="text-sm text-slate-400">Paiement par Orange Money, MTN MoMo ou carte bancaire.</p>
        </div>

        <nav aria-label="Découvrir" className="grid content-start gap-3">
          <p className="text-sm font-semibold text-white">Découvrir</p>
          <ul className="grid gap-2 text-sm">
            {HOME_LINKS.map(({ to, label }) => (
              <li key={label}>
                <Link to={to} className="hover:text-white">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Espaces" className="grid content-start gap-3">
          <p className="text-sm font-semibold text-white">Espaces</p>
          <ul className="grid gap-2 text-sm">
            {session ? (
              <>
                <li>
                  <Link to="/account" className="hover:text-white">
                    Mon espace voyageur
                  </Link>
                </li>
                <li>
                  <Link to="/account/reservations" className="hover:text-white">
                    Mes réservations
                  </Link>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link to="/login" className="hover:text-white">
                    Connexion voyageur
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-white">
                    Créer un compte voyageur
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link to="/agency/login" className="hover:text-white">
                Espace agence
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-slate-500">
          © {new Date().getFullYear()} Routier+237. Résultats de recherche classés par heure ou par prix, sans préférence pour une agence.
        </p>
      </div>
    </footer>
  )
}

/**
 * Mise en page de l'espace public (accueil, recherche, trajets, agences, réservation).
 */
export function PublicLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
            {HOME_LINKS.map(({ to, label }) => (
              <Link key={label} to={to} className={navLinkClass}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:block">
            <CustomerMenu />
          </div>
          <MobileMenu />
        </div>
      </header>

      <main id="contenu" className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}
