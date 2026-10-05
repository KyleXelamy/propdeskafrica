// Lightweight type stubs for shared API error shapes. Kept tiny so
// the rest of the app doesn't need to import Supabase types.
export type ApiErrorBody = { error: string; [k: string]: unknown }
