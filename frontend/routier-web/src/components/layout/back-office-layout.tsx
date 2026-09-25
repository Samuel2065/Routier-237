import { Bell, Bus, ChevronDown, Loader2, LogOut, Menu, type LucideIcon } from 'lucide-react'
import { useLayoutEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
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
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Space } from '@/types/api'

export interface BackOfficeNavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Actif uniquement sur ce chemin exact (page d'accueil d'un espace). */
  end?: boolean
}

export interface BackOfficeUser {
  name: string
  email: string
  roleLabel: string
  avatarUrl?: string | null
}

interface BackOfficeLayoutProps {
  /** Espace courant : fixe la couleur d'accent (client bleu, agence vert, administration ambre). */
  space: Space
  /** Nom de l'espace (« Espace agence », « Administration »). */
  spaceLabel: string
  homePath: string
  /** Page « Mon profil » de l'espace (photo et informations du compte). */
  profilePath: string
  navItems: BackOfficeNavItem[]
  /** Périmètre affiché dans la barre supérieure (agence, organisation, plateforme). */
  scopeLabel: string
  user: BackOfficeUser
  /** Entrées du menu du profil, en plus de la déconnexion (routes existantes uniquement). */
  menuItems?: BackOfficeNavItem[]
  /** Cloche de notifications : affichée seulement si l'espace dispose de notifications. */
  notifications?: { unread: number; to: string }
  onLogout: () => void
  logoutPending?: boolean
}

/**
 * Pose la couleur d'accent de l'espace sur la racine du document, pour que les fenêtres
 * et menus (rendus hors du layout) la reçoivent aussi.
 */
function useSpaceAccent(space: Space) {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.space = space

    return () => {
      delete root.dataset.space
    }
  }, [space])
}

function SidebarContent({
  spaceLabel,
  homePath,
  profilePath,
  navItems,
  user,
  onLogout,
  logoutPending,
  onNavigate,
}: Pick<BackOfficeLayoutProps, 'spaceLabel' | 'homePath' | 'profilePath' | 'navItems' | 'user' | 'onLogout' | 'logoutPending'> & { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link
        to={homePath}
        onClick={onNavigate}
        className="flex items-center gap-3 px-5 py-5 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
          <Bus className="size-5" aria-hidden="true" />
        </span>
        <span className="leading-tight">
          <span className="block text-lg font-semibold tracking-tight text-white">Routier+237</span>
          <span className="block text-xs font-medium tracking-wide text-sidebar-foreground/70 uppercase">{spaceLabel}</span>
        </span>
      </Link>

      <div className="mx-5 border-t border-sidebar-border" />

      <nav className="grid flex-1 content-start gap-1 overflow-y-auto px-3 py-4" aria-label={`Navigation — ${spaceLabel}`}>
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )
            }
          >
            <Icon className="size-4.5" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="grid gap-2 border-t border-sidebar-border p-3">
        <Link
          to={profilePath}
          onClick={onNavigate}
          aria-label={`Mon profil — ${user.name}`}
          className="flex items-center gap-3 rounded-lg bg-white/5 p-2.5 transition-colors outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <UserAvatar name={user.name} src={user.avatarUrl} className="ring-2 ring-white/15" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{user.roleLabel}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={onLogout}
          disabled={logoutPending}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-300 transition-colors outline-none hover:bg-red-500/15 hover:text-red-200 focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-60"
        >
          {logoutPending ? <Loader2 className="size-4.5 animate-spin" aria-hidden="true" /> : <LogOut className="size-4.5" aria-hidden="true" />}
          Déconnexion
        </button>
      </div>
    </div>
  )
}

/**
 * Mise en page des tableaux de bord (espace client, logiciel métier des agences et
 * administration, §18.2) : navigation latérale avec compte et déconnexion, barre supérieure
 * avec périmètre, notifications et menu du profil. Tiroir de navigation sur mobile.
 */
export function BackOfficeLayout({
  space,
  spaceLabel,
  homePath,
  profilePath,
  navItems,
  scopeLabel,
  user,
  menuItems = [],
  notifications,
  onLogout,
  logoutPending,
}: BackOfficeLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  useSpaceAccent(space)

  const sidebarProps = { spaceLabel, homePath, profilePath, navItems, user, onLogout, logoutPending }

  return (
    <div className="flex min-h-svh bg-muted/40">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        Aller au contenu
      </a>

      <aside className="sticky top-0 z-20 hidden h-svh w-64 shrink-0 shadow-sidebar lg:block">
        <SidebarContent {...sidebarProps} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/90 px-4 backdrop-blur supports-backdrop-filter:bg-background/75 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label="Ouvrir le menu">
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
                <SheetTitle className="sr-only">{spaceLabel}</SheetTitle>
                <SheetDescription className="sr-only">Navigation de l'espace</SheetDescription>
                <SidebarContent {...sidebarProps} onNavigate={() => setMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <p className="truncate text-sm font-semibold sm:text-base">{scopeLabel}</p>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {notifications && (
              <Button variant="ghost" size="icon-lg" className="relative" asChild>
                <Link
                  to={notifications.to}
                  aria-label={notifications.unread > 0 ? `Notifications, ${notifications.unread} non lue(s)` : 'Notifications'}
                >
                  <Bell aria-hidden="true" />
                  {notifications.unread > 0 && (
                    <span
                      className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white"
                      aria-hidden="true"
                    >
                      {notifications.unread > 9 ? '9+' : notifications.unread}
                    </span>
                  )}
                </Link>
              </Button>
            )}

            <span className="mx-1 hidden h-8 w-px bg-border sm:block" aria-hidden="true" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto gap-2.5 px-1.5 py-1 sm:px-2" aria-label={`Menu du compte — ${user.name}`}>
                  <span className="hidden text-right leading-tight sm:block">
                    <span className="block max-w-44 truncate text-sm font-semibold">{user.name}</span>
                    <span className="block max-w-44 truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      {user.roleLabel}
                    </span>
                  </span>
                  <UserAvatar name={user.name} src={user.avatarUrl} className="ring-2 ring-primary/20" />
                  <ChevronDown className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-1.5">
                <DropdownMenuLabel className="grid gap-0.5 px-2 py-1.5">
                  <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Utilisateur</span>
                  <span className="truncate text-sm font-semibold text-foreground">{user.email}</span>
                </DropdownMenuLabel>
                {menuItems.length > 0 && <DropdownMenuSeparator />}
                {menuItems.map(({ to, label, icon: Icon }) => (
                  <DropdownMenuItem key={to} onSelect={() => navigate(to)} className="py-2">
                    <Icon aria-hidden="true" />
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onLogout} disabled={logoutPending} className="py-2">
                  <LogOut aria-hidden="true" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main id="contenu" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
