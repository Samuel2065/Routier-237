import { Bus, LogOut, Menu, UserRound, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
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
import { cn } from '@/lib/utils'

export interface BackOfficeNavItem {
  to: string
  label: string
  icon: LucideIcon
}

interface BackOfficeLayoutProps {
  /** Nom de l'espace (« Espace agence », « Administration »). */
  spaceLabel: string
  homePath: string
  navItems: BackOfficeNavItem[]
  /** Périmètre affiché dans l'en-tête (agence, organisation, plateforme). */
  scopeLabel: string
  userName: string
  roleLabel: string
  onLogout: () => void
}

function SidebarNav({ items, label, onNavigate }: { items: BackOfficeNavItem[]; label: string; onNavigate?: () => void }) {
  return (
    <nav className="grid gap-1" aria-label={`Navigation — ${label}`}>
      {items.map(({ to, label: itemLabel, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent',
            )
          }
        >
          <Icon className="size-4" aria-hidden="true" />
          {itemLabel}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * Mise en page des logiciels métier (espaces agence et administration, §18.2) :
 * navigation latérale, en-tête avec périmètre et menu utilisateur.
 */
export function BackOfficeLayout({ spaceLabel, homePath, navItems, scopeLabel, userName, roleLabel, onLogout }: BackOfficeLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-svh bg-muted/30">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">
        Aller au contenu
      </a>

      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar py-4 lg:flex">
        <Link to={homePath} className="flex items-center gap-2 px-3 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bus className="size-5" aria-hidden="true" />
          </span>
          <span>
            Routier<span className="text-primary">+237</span>
            <span className="block text-xs font-normal text-muted-foreground">{spaceLabel}</span>
          </span>
        </Link>
        <div className="px-3">
          <SidebarNav items={navItems} label={spaceLabel} />
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
                  <SheetTitle>{spaceLabel}</SheetTitle>
                </SheetHeader>
                <div className="px-4">
                  <SidebarNav items={navItems} label={spaceLabel} onNavigate={() => setMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <p className="truncate text-sm font-medium">{scopeLabel}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <UserRound aria-hidden="true" />
                <span className="hidden max-w-40 truncate sm:inline">{userName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="grid gap-0.5">
                <span className="truncate">{userName}</span>
                <span className="text-xs font-normal text-muted-foreground">{roleLabel}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onLogout}>
                <LogOut aria-hidden="true" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main id="contenu" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
