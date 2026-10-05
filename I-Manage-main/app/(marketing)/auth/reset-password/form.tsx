"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, AlertCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialError = searchParams.get("error")

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [pending, startTransition] = useTransition()
  const supabase = createClient()

  // The Supabase email-recovery flow puts an access_token in the URL hash.
  // The browser client auto-detects it on mount and creates a session.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (cancelled) return
      if (sessionError) setError(sessionError.message)
      setReady(true)
      // No session yet? Force a hash-exchange by listening briefly.
      if (!data.session) {
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session) {
            setError(null)
            sub.subscription.unsubscribe()
          }
        })
        // Clean up the listener after a few seconds either way.
        setTimeout(() => sub.subscription.unsubscribe(), 5000)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  async function onSubmit(formData: FormData) {
    startTransition(async () => {
      const password = formData.get("password") as string
      if (!password || password.length < 6) {
        setError("Password must be at least 6 characters.")
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }

      // Sign the recovery session out — user signs in fresh with the new password.
      await supabase.auth.signOut()
      router.push("/auth/login?reset=success")
    })
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-2">
          <KeyRound className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold text-center">Set a new password</CardTitle>
        <CardDescription className="text-center">
          Choose a strong password you don't reuse anywhere else.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/50 text-destructive px-3 py-2 rounded-md text-sm mb-4">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="bg-input"
              disabled={!ready || pending}
            />
            <p className="text-xs text-muted-foreground">At least 6 characters.</p>
          </div>
          <Button
            type="submit"
            disabled={!ready || pending}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
