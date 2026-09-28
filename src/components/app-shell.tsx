"use client"

import { signOut } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { FormEvent, ReactNode, useEffect, useState, useSyncExternalStore } from "react"
import {
  BarChart3,
  Bell,
  Boxes,
  BrainCircuit,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Moon,
  PackageSearch,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react"
import Link from "next/link"

import { NotificationBell } from "@/components/notification-bell"

export type AppRole = "ADMIN" | "MANUFACTURER" | "STOCKIST"

type AppShellProps = {
  role: AppRole
  email: string
  children: ReactNode
}

const navigation: Record<AppRole, { href: string; label: string; icon: typeof LayoutDashboard }[]> = {
  ADMIN: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/verifications", label: "Verifications", icon: ClipboardCheck },
  ],
  MANUFACTURER: [
    { href: "/manufacturer", label: "Dashboard", icon: LayoutDashboard },
    { href: "/manufacturer/access-requests", label: "Access requests", icon: Users },
    { href: "/manufacturer/catalogue", label: "Catalogue", icon: Boxes },
  ],
  STOCKIST: [
    { href: "/stockist", label: "Dashboard", icon: LayoutDashboard },
    { href: "/stockist/insights", label: "Smart insights", icon: BrainCircuit },
    { href: "/stockist/inventory", label: "Inventory", icon: PackageSearch },
    { href: "/stockist/expiry", label: "Expiry watch", icon: CalendarClock },
    { href: "/stockist/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/stockist/catalogue", label: "Catalogue", icon: PackageSearch },
    { href: "/stockist/manufacturers", label: "Manufacturers", icon: Boxes },
    { href: "/stockist/orders", label: "Orders", icon: ClipboardList },
    { href: "/stockist/notifications", label: "Notifications", icon: Bell },
  ],
}

const roleLabels: Record<AppRole, string> = {
  ADMIN: "Admin console",
  MANUFACTURER: "Manufacturer",
  STOCKIST: "Stockist",
}

export function AppShell({ role, email, children }: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const darkMode = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange)
      window.addEventListener("pharmalink-theme-change", onStoreChange)
      return () => {
        window.removeEventListener("storage", onStoreChange)
        window.removeEventListener("pharmalink-theme-change", onStoreChange)
      }
    },
    () => {
      const savedTheme = window.localStorage.getItem("pharmalink-theme")
      return savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches
    },
    () => false,
  )
  const [query, setQuery] = useState("")

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode)
  }, [darkMode])

  function toggleTheme() {
    window.localStorage.setItem("pharmalink-theme", darkMode ? "light" : "dark")
    window.dispatchEvent(new Event("pharmalink-theme-change"))
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (role === "STOCKIST") {
      router.push(`/stockist/catalogue${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`)
    }
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: "/login" })
  }

  const links = navigation[role]
  const dashboardHref = links[0]?.href ?? "/"

  return (
    <div className="app-shell flex min-h-screen">
      <aside className="hidden w-60 shrink-0 bg-[color:var(--sidebar)] p-5 text-white md:block lg:w-64">
        <div className="mb-10 flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-emerald-300 text-slate-900"><ShieldCheck className="size-5" /></div>
          <span className="text-xl font-bold tracking-tight">PharmaLink</span>
        </div>
        <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-emerald-200">{roleLabels[role]}</p>
        <nav className="space-y-1" aria-label="Primary navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${pathname === href ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-12 text-xs leading-5 text-white/45">Drug-license verification is simulated and does not replace regulatory compliance.</div>
      </aside>

      {mobileMenuOpen && <div className="fixed inset-0 z-40 bg-slate-950/40 md:hidden" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[color:var(--sidebar)] p-6 text-white shadow-2xl transition-transform md:hidden ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`} aria-label="Mobile navigation">
        <div className="mb-10 flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-emerald-300 text-slate-900"><ShieldCheck className="size-5" /></div><span className="text-xl font-bold">PharmaLink</span></div><button type="button" onClick={() => setMobileMenuOpen(false)} className="grid size-11 place-items-center rounded-lg hover:bg-white/10" aria-label="Close navigation"><X className="size-5" /></button></div>
        <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-emerald-200">{roleLabels[role]}</p>
        <nav className="space-y-1">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"><Icon className="size-4" /> {label}</Link>)}</nav>
      </aside>

      <main className="min-w-0 flex-1 pb-20 md:pb-0">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="grid size-11 place-items-center rounded-lg border border-border bg-background md:hidden" aria-label="Open navigation"><Menu className="size-5" /></button>
            <form onSubmit={submitSearch} className="relative min-w-0 flex-1 md:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={role === "STOCKIST" ? "Search catalogue..." : "Search workspace..."} aria-label="Global search" className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /></form>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={toggleTheme} className="grid size-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={darkMode ? "Use light theme" : "Use dark theme"}>{darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
              {role === "STOCKIST" ? <NotificationBell /> : null}
              <details className="relative"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 hover:bg-muted"><span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{email.slice(0, 1).toUpperCase()}</span><span className="hidden max-w-32 truncate text-sm font-medium lg:block">{email}</span></summary><div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl"><div className="border-b border-border px-3 py-2"><p className="text-sm font-semibold">{roleLabels[role]}</p><p className="truncate text-xs text-muted-foreground">{email}</p></div><Link href={dashboardHref} className="mt-1 flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted"><Users className="size-4" /> Profile</Link><Link href={dashboardHref} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted"><Settings className="size-4" /> Settings</Link><button type="button" onClick={handleSignOut} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-destructive hover:bg-destructive/10">Sign out</button></div></details>
            </div>
          </div>
        </header>
        <div className="p-5 sm:p-8">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-2 py-2 backdrop-blur md:hidden" aria-label="Mobile primary navigation"><div className="mx-auto grid max-w-lg grid-cols-4 gap-1">{(role === "STOCKIST" ? links.filter((link) => ["/stockist", "/stockist/catalogue", "/stockist/inventory", "/stockist/orders"].includes(link.href)) : links.slice(0, 4)).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-[0.65rem] font-medium ${pathname === href ? "bg-secondary text-primary" : "text-muted-foreground"}`}><Icon className="size-4" />{label}</Link>)}</div></nav>
    </div>
  )
}
