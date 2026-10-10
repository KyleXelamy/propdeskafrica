import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatKenyaCurrency(amount: number | null | undefined): string {
  const n = Number(amount || 0)
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatCurrency(amount: number | null | undefined, currency = "KES"): string {
  const n = Number(amount || 0)
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

/**
 * Safely resolve a tenant's display name from any combination of the
 * `full_name` / `first_name` / `last_name` fields the API may return.
 */
export function tenantName(tenant: any): string {
  if (!tenant) return "—"
  if (tenant.full_name) return tenant.full_name
  const first = tenant.first_name || ""
  const last = tenant.last_name || ""
  const joined = [first, last].filter(Boolean).join(" ")
  return joined || "—"
}

/**
 * Safely resolve a property display name.
 */
export function propertyName(property: any): string {
  return property?.name || "—"
}

/** Human-friendly short date in the user's locale. */
export function formatDate(d: string | Date | null | undefined, fallback = "—") {
  if (!d) return fallback
  try {
    return new Date(d).toLocaleDateString()
  } catch {
    return fallback
  }
}

/** File-size pretty printer. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
