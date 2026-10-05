"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"
import { Home, Map, User, LogIn, UserPlus, LayoutDashboard } from "lucide-react"

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/mapa", label: "Mapa", icon: Map },
]

export function Navbar() {
  const pathname = usePathname()

  // Don't show navbar on auth pages
  if (pathname === "/login" || pathname === "/register") {
    return null
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/")

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-heading text-xl font-semibold">
          Ohana
        </Link>

        <nav className="flex items-center gap-4 md:gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-colors hover:text-foreground",
                isActive(item.href)
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-foreground",
              isActive("/dashboard")
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            <LayoutDashboard className="size-4" />
            Panel
          </Link>
          <Link
            href="/profil"
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-foreground",
              isActive("/profil")
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            <User className="size-4" />
            Profil
          </Link>
          <Link
            href="/login"
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-foreground",
              isActive("/login")
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            <LogIn className="size-4" />
            Logowanie
          </Link>
          <Link
            href="/register"
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-foreground",
              isActive("/register")
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            <UserPlus className="size-4" />
            Rejestracja
          </Link>
        </nav>
      </div>
    </header>
  )
}
