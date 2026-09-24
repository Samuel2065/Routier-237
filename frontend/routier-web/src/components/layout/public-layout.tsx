import { Bell, Bus, LogOut, Menu, Ticket, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useCustomerLogout } from '@/features/auth/queries'
import { useNotifications } from '@/features/notifications/queries'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/auth-store'

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Routier+237, accueil">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Bus className="size-5" aria-hidden="true" />
      </span>
      <span className="text-lg">
        Routier<span className="text-primary">+237</span>
      </span>
    </Link>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn('rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted', isActive ? 'text-foreground' : 'text-muted-foreground')

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserRound aria-hidden="true" />
          <span className="max-w-32 truncate">{session.user.name}</span>
          {unread > 0 && (
            <Badge className="h-5 min-w-5 px-1" aria-label={`${unread} notification(s) non lue(s)`}>
              {unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{session.user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/account')}>
          <Bell aria-hidden="true" />
          Mon compte {unread > 0 && `(${unread})`}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/account/reservations')}>
          <Ticket aria-hidden="true" />
          Mes réservations
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate(undefined, { onSettled: () => navigate('/') })}>
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
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Ouvrir le menu">
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="grid gap-1 px-4" aria-label="Navigation mobile">
          <NavLink to="/" end className={navLinkClass} onClick={close}>
            Rechercher un trajet
          </NavLink>
          {session ? (
            <>
              <NavLink to="/account" end className={navLinkClass} onClick={close}>
                Mon compte
              </NavLink>
              <NavLink to="/account/reservations" className={navLinkClass} onClick={close}>
                Mes réservations
              </NavLink>
              <button
                type="button"
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-muted"
                onClick={() => logout.mutate(undefined, { onSettled: () => { close(); navigate('/') } })}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navLinkClass} onClick={close}>
                Connexion
              </NavLink>
              <NavLink to="/register" className={navLinkClass} onClick={close}>
                Créer un compte
              </NavLink>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Mise en page de l'espace public et de l'espace client.
 */
export function PublicLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">
        Aller au contenu
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            <NavLink to="/" end className={navLinkClass}>
              Rechercher
            </NavLink>
          </nav>
          <div className="hidden md:block">
            <CustomerMenu />
          </div>
          <MobileMenu />
        </div>
      </header>

      <main id="contenu" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Routier+237 — Réservation de voyages routiers au Cameroun.</p>
          <p>Paiement par Orange Money, MTN MoMo ou carte bancaire.</p>
        </div>
      </footer>
    </div>
  )
}
