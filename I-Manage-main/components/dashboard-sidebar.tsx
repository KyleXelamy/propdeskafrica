"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Building2,
  Users,
  DollarSign,
  Wrench,
  FileText,
  StickyNote,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Home,
  Wallet,
  ShieldAlert,
  Contact,
  Briefcase,
  ClipboardList,
  Map,
  GitMerge,
  Building,
  Archive,
  Activity,
} from "lucide-react"
import { signOut } from "@/lib/actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Properties", href: "/dashboard/properties", icon: Building2 },
  { name: "Map", href: "/dashboard/properties/map", icon: Map },
  { name: "Tenants", href: "/dashboard/tenants", icon: Users },
  { name: "Contacts", href: "/dashboard/contacts", icon: Contact },
  { name: "Finances", href: "/dashboard/finances", icon: DollarSign },
  { name: "Paybill", href: "/dashboard/paybill", icon: Wallet },
  { name: "Reconciliation", href: "/dashboard/reconciliation", icon: GitMerge },
  { name: "Maintenance", href: "/dashboard/maintenance", icon: Wrench },
  { name: "Quotations", href: "/dashboard/quotations", icon: ClipboardList },
  { name: "Damages", href: "/dashboard/damages", icon: ShieldAlert },
  { name: "Documents", href: "/dashboard/documents", icon: FileText },
  { name: "Notes", href: "/dashboard/notes", icon: StickyNote },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { name: "Landlords", href: "/dashboard/landlords", icon: Building },
  { name: "Company", href: "/dashboard/company", icon: Briefcase },
  { name: "Backup", href: "/dashboard/settings/backup", icon: Archive },
  { name: "System", href: "/dashboard/settings/system", icon: Activity },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

interface SidebarProps {
  userEmail?: string
  userName?: string
  avatarUrl?: string | null
}

function initials(name?: string | null, email?: string): string {
  const src = (name || email || "").trim()
  if (!src) return "?"
  return src.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "?"
}

function SidebarContent({ userEmail, userName, avatarUrl, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-14 md:h-16 items-center border-b border-sidebar-border px-4 md:px-6">
        <Building2 className="h-6 w-6 md:h-8 md:w-8 text-sidebar-accent" />
        <span className="ml-2 text-base md:text-lg font-bold text-sidebar-foreground">I-Manage</span>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 md:px-3 py-3 md:py-4">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 md:py-2 text-sm font-medium transition-colors touch-manipulation",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3 md:p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={avatarUrl || undefined} alt={userName || userEmail || "User"} />
            <AvatarFallback className="text-xs bg-sidebar-accent text-sidebar-accent-foreground">
              {initials(userName, userEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            {userName && (
              <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
            )}
            <p className={`text-xs ${userName ? "text-muted-foreground" : "text-sm font-medium text-sidebar-foreground"} truncate`}>
              {userEmail}
            </p>
          </div>
        </div>
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground touch-manipulation"
          >
            <LogOut className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Sign Out</span>
          </Button>
        </form>
      </div>
    </div>
  )
}

export function DashboardSidebar({ userEmail, userName, avatarUrl }: SidebarProps) {
  const [open, setOpen] = useState(false)

  const handleNavigate = () => {
    setOpen(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="md:hidden fixed top-4 left-4 z-50 h-10 w-10 bg-background border-2 border-primary/20 shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 sm:w-80">
          <SidebarContent userEmail={userEmail} userName={userName} avatarUrl={avatarUrl} onNavigate={handleNavigate} />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <SidebarContent userEmail={userEmail} userName={userName} avatarUrl={avatarUrl} />
      </div>
    </>
  )
}
