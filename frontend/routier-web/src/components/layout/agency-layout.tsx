import { Bus, LogOut, Menu, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
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
import { AGENCY_SECTIONS } from '@/features/agency/sections'
import { useAgencyLogout, useAgencyProfileRefresh, useCan } from '@/features/agency/session'
import { ROLE_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useSession } from '@/store/auth-store'

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const can = useCan()

  return (
    <nav className="grid gap-1" aria-label="Navigation de l'espace agence">
      {AGENCY_SECTIONS.filter((section) => section.permissions.some(can)).map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={`/agency/${path}`}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent',
            )
          }
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <Link to="/agency/dashboard" className="flex items-center gap-2 px-3 font-semibold">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Bus className="size-5" aria-hidden="true" />
      </span>
      <span>
        Routier<span className="text-primary">+237</span>
        <span className="block text-xs font-normal text-muted-foreground">Espace agence</span>
      </span>
    </Link>
  )
}

/**
 * Mise en page de l'espace agence : logiciel métier avec navigation latérale (§18.2).
 */
export function AgencyLayout() {
  const session = useSession('agency')
  const navigate = useNavigate()
  const logout = useAgencyLogout()
  const [menuOpen, setMenuOpen] = useState(false)
  useAgencyProfileRefresh()

  if (!session) return null
  const { user } = session
  const scopeLabel = user.agency?.name ?? user.organization?.name ?? ''

  const signOut = () => logout.mutate(undefined, { onSettled: () => navigate('/agency/login', { replace: true }) })

  return (
    <div className="flex min-h-svh bg-muted/30">
      <a href="#contenu-agence" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">
        Aller au contenu
      </a>

      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar py-4 lg:flex">
        <Brand />
        <div className="px-3">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu">
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <SheetHeader>
                  <SheetTitle>Espace agence</SheetTitle>
                </SheetHeader>
                <div className="px-4">
                  <SidebarNav onNavigate={() => setMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <p className="truncate text-sm font-medium">{scopeLabel}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <UserRound aria-hidden="true" />
                <span className="hidden max-w-40 truncate sm:inline">{user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="grid gap-0.5">
                <span className="truncate">{user.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{user.role ? ROLE_LABELS[user.role] : ''}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut}>
                <LogOut aria-hidden="true" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main id="contenu-agence" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
