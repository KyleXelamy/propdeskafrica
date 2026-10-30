"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowUp, Loader2 } from "lucide-react"

type Status = "Under review" | "Planned" | "In progress" | "Shipped"

type Request = {
  slug: string
  title: string
  body: string
  status: Status
  votes: number
  category: string
}

/**
 * The public roadmap API returns the canonical status vocabulary
 * (Now / Next / Later / Shipped). Map it onto the board's four lanes.
 */
const STATUS_MAP: Record<string, Status> = {
  Now: "In progress",
  Next: "Planned",
  Later: "Under review",
  Shipped: "Shipped",
}

const statusStyles: Record<Status, string> = {
  "Under review": "bg-muted text-muted-foreground",
  Planned: "bg-primary text-primary-foreground",
  "In progress": "bg-warning/15 text-warning",
  Shipped: "bg-success/15 text-success",
}

export function FeedbackBoard() {
  const [items, setItems] = useState<Request[] | null>(null)
  const [voted, setVoted] = useState<Set<string>>(new Set())
  const [pendingVote, setPendingVote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/customer-requests")
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || "Couldn't load the board")
      const list: Request[] = (body?.items ?? []).map((item: any) => ({
        slug: item.slug,
        title: item.title,
        body: item.description,
        status: STATUS_MAP[item.status] ?? "Under review",
        votes: Number(item.votes ?? 0),
        category: item.category,
      }))
      setItems(list)
    } catch (e: any) {
      setError(e?.message || "Couldn't load the board")
      setItems([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(
    () => [...(items ?? [])].sort((a, b) => b.votes - a.votes),
    [items],
  )

  async function vote(id: string) {
    if (voted.has(id) || pendingVote) return
    setPendingVote(id)
    setError(null)
    try {
      const res = await fetch("/api/customer-requests?vote=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || "Couldn't record your vote")
      setItems((prev) =>
        (prev ?? []).map((r) =>
          r.slug === id ? { ...r, votes: Number(body?.votes ?? r.votes + 1) } : r,
        ),
      )
      setVoted((prev) => new Set(prev).add(id))
    } catch (e: any) {
      setError(e?.message || "Couldn't record your vote")
    } finally {
      setPendingVote(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(["Under review", "Planned", "In progress", "Shipped"] as Status[]).map((s) => (
            <span key={s} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[s]}`}>
              {s}
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Sorted by votes</p>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="status">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading the board…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No ideas on the board yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <li
              key={r.slug}
              className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5"
            >
              <button
                type="button"
                onClick={() => vote(r.slug)}
                disabled={voted.has(r.slug) || pendingVote === r.slug}
                className={
                  "flex shrink-0 flex-col items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-semibold " +
                  (voted.has(r.slug)
                    ? "bg-muted text-muted-foreground"
                    : "bg-background hover:border-primary hover:text-primary")
                }
                aria-label={`Upvote ${r.title}`}
              >
                {pendingVote === r.slug ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
                <span className="mt-1">{r.votes}</span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${statusStyles[r.status]}`}>
                    {r.status}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {r.category}
                  </span>
                </div>
                <p className="mt-2 text-base font-medium leading-tight">{r.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
