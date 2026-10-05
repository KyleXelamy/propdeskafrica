import { withAuth, successResponse, errorResponse } from "@/lib/api"
import type { NextRequest } from "next/server"

/**
 * GET /api/notifications?limit=50
 * Returns the current user's notifications, newest first.
 * Supports an optional `?unread=1` filter for the badge counter.
 */
export const GET = withAuth(async (req: NextRequest, { supabase, userId }) => {
  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200)
  const unreadOnly = url.searchParams.get("unread") === "1"

  let q = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (unreadOnly) q = q.eq("is_read", false)

  const { data, error } = await q
  if (error) return errorResponse("Failed to load notifications", 500)
  return successResponse(data || [])
})

/**
 * PATCH /api/notifications
 * Body: { id?: string, all?: true }
 * - If `id` is provided, marks that single notification as read.
 * - If `all: true`, marks every notification as read (uses the RPC helper).
 */
export const PATCH = withAuth(async (req: NextRequest, { supabase, userId }) => {
  let body: any = {}
  try { body = await req.json() } catch {}

  if (body.all === true) {
    const { error } = await supabase.rpc("mark_all_notifications_read", { p_user: userId })
    if (error) return errorResponse("Failed to mark all read", 500)
    return successResponse({ ok: true })
  }

  if (!body.id || typeof body.id !== "string") {
    return errorResponse("Provide id or all=true", 400)
  }
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", body.id)
    .eq("user_id", userId)
  if (error) return errorResponse("Failed to update notification", 500)
  return successResponse({ ok: true })
})

/**
 * DELETE /api/notifications
 * Body: { id?: string, all_read?: true }
 * - If `id` is provided, deletes that single notification.
 * - If `all_read: true`, deletes all of the user's read notifications.
 */
export const DELETE = withAuth(async (req: NextRequest, { supabase, userId }) => {
  let body: any = {}
  try { body = await req.json() } catch {}

  if (body.all_read === true) {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId)
      .eq("is_read", true)
    if (error) return errorResponse("Failed to clear", 500)
    return successResponse({ ok: true })
  }

  if (!body.id || typeof body.id !== "string") {
    return errorResponse("Provide id or all_read=true", 400)
  }
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", body.id)
    .eq("user_id", userId)
  if (error) return errorResponse("Failed to delete notification", 500)
  return successResponse({ ok: true })
})
