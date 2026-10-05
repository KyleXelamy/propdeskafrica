import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, type LucideIcon } from "lucide-react"
import Link from "next/link"
import {
  IllustrationEmptyBuilding,
  IllustrationEmptyInbox,
  IllustrationEmptyWallet,
  IllustrationEmptyWrench,
  IllustrationEmptyFile,
  IllustrationUsers,
  IllustrationSearch,
  type Props as IllustrationProps,
} from "@/components/illustrations"

interface EmptyStateProps {
  icon?: LucideIcon
  illustration?: React.FC<IllustrationProps>
  title: string
  description: string
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  variant?: "card" | "plain"
  className?: string
}

const illustrationMap: Record<string, React.FC<IllustrationProps>> = {
  building: IllustrationEmptyBuilding,
  inbox: IllustrationEmptyInbox,
  wallet: IllustrationEmptyWallet,
  wrench: IllustrationEmptyWrench,
  file: IllustrationEmptyFile,
  users: IllustrationUsers,
  search: IllustrationSearch,
}

/**
 * Reusable empty state. Two visual modes:
 *   - Pass `icon={LucideIcon}` for a small icon + circle (compact)
 *   - Pass `illustration="building"` (etc) for a richer inline SVG
 *
 *   <EmptyState
 *     illustration="building"
 *     title="No properties yet"
 *     description="Start by adding your first rental property"
 *     action={{ label: "Add Property", href: "/dashboard/properties/new" }}
 *   />
 */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  variant = "card",
  className,
}: EmptyStateProps) {
  const Illustration = illustration ? illustrationMap[illustration] : null
  const inner = (
    <>
      {Illustration ? (
        <div className="mx-auto mb-4 max-w-[200px]">
          <Illustration className="w-full h-auto" />
        </div>
      ) : (
        <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
          {Icon && <Icon className="h-7 w-7 text-muted-foreground" />}
        </div>
      )}
      <h3 className="text-lg md:text-xl font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Button asChild className="w-full sm:w-auto">
              <Link href={action.href}>
                {action.href.includes("/new") ? <Plus className="h-4 w-4 mr-2" /> : null}
                {action.label}
              </Link>
            </Button>
          ) : (
            <Button onClick={action.onClick}>
              <Plus className="h-4 w-4 mr-2" />
              {action.label}
            </Button>
          )}
        </div>
      )}
    </>
  )

  if (variant === "plain") {
    return <div className={`text-center py-8 ${className || ""}`}>{inner}</div>
  }
  return (
    <Card className={className}>
      <CardContent className="text-center py-10">{inner}</CardContent>
    </Card>
  )
}
