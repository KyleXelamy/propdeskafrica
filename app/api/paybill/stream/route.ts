import { type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { neonConfigured, getDb } from "@/lib/db/neon"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/paybill/stream
 *
 * Server-Sent Events stream of new C2B transactions for the current
 * user. Clients open an EventSource on this URL; the server polls
 * every 2 seconds and emits any new transactions since the last
 * seen TransID. Auto-closes after 5 minutes to keep idle connections
 * from leaking.
 */
export async function GET(_request: NextRequest) {
  const supa = await createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const encoder = new TextEncoder()
  let lastSeen: string | null = null
  let lastPollAt = Date.now()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {/* connection closed */}
      }

      // Initial hello
      send("hello", { user: user.id, ts: new Date().toISOString() })

      const interval = setInterval(async () => {
        if (closed) return
        try {
          const rows = await pollNewTransactions(user.id, lastSeen)
          if (rows.length > 0) {
            lastSeen = rows[0].trans_id
            for (const r of rows) send("c2b", r)
            send("ping", { count: rows.length, lastSeen, ts: new Date().toISOString() })
          } else {
            send("ping", { ts: new Date().toISOString() })
          }
        } catch (err) {
          send("error", { message: err instanceof Error ? err.message : "poll failed" })
        }
      }, 2000)

      // Auto-close after 5 min
      const timeout = setTimeout(() => {
        send("bye", { reason: "idle-timeout" })
        clearInterval(interval)
        try { controller.close() } catch {/* already closed */}
        closed = true
      }, 5 * 60 * 1000)

      // Cleanup on cancel
      const originalCancel = (reason?: unknown) => {
        clearInterval(interval)
        clearTimeout(timeout)
        closed = true
        try { controller.close() } catch {/* */}
      }
      // The runtime will call our cancel
      ;(stream as any)._cancel = originalCancel
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

type C2BRow = {
  trans_id: string
  trans_time: string
  trans_amount: number
  business_short_code: string
  bill_ref_number: string
  msisdn: string
  first_name: string
  last_name: string
  match_status: string
  match_method: string | null
  match_confidence: number | null
  matched_tenant_id: string | null
  created_at: string
}

async function pollNewTransactions(userId: string, after: string | null): Promise<C2BRow[]> {
  if (neonConfigured()) {
    try {
      const sql = getDb()
      const params: any[] = [userId]
      let where = `where p.user_id = $1`
      if (after) {
        params.push(after)
        where += ` and t.trans_id > $2`
      }
      const rows = (await (sql as any).unsafe(
        `select t.trans_id, t.trans_time, t.trans_amount::float8 as trans_amount,
                t.business_short_code, t.bill_ref_number, t.msisdn,
                t.first_name, t.last_name, t.match_status, t.match_method,
                t.match_confidence::float8 as match_confidence, t.matched_tenant_id, t.created_at
         from public.c2b_transactions t
         join public.paybills p on p.id = t.paybill_id
         ${where}
         order by t.trans_id desc
         limit 20`,
        params,
      )) as unknown as C2BRow[]
      return rows
    } catch {
      return []
    }
  }
  const supa = await createClient()
  let q = supa
    .from("c2b_transactions")
    .select("trans_id, trans_time, trans_amount, business_short_code, bill_ref_number, msisdn, first_name, last_name, match_status, match_method, match_confidence, matched_tenant_id, created_at, paybill_id, paybills!inner(user_id)")
    .eq("paybills.user_id", userId)
    .order("trans_id", { ascending: false })
    .limit(20)
  if (after) q = q.gt("trans_id", after)
  const { data } = await q
  return (data ?? []).map((r: any) => ({
    trans_id: r.trans_id,
    trans_time: r.trans_time,
    trans_amount: Number(r.trans_amount),
    business_short_code: r.business_short_code,
    bill_ref_number: r.bill_ref_number,
    msisdn: r.msisdn,
    first_name: r.first_name,
    last_name: r.last_name,
    match_status: r.match_status,
    match_method: r.match_method,
    match_confidence: r.match_confidence ? Number(r.match_confidence) : null,
    matched_tenant_id: r.matched_tenant_id,
    created_at: r.created_at,
  }))
}
