"use client"

import { useActionState, useEffect, useMemo } from "react"
import { useFormStatus } from "react-dom"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { signIn } from "@/lib/actions"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        "Sign In"
      )}
    </Button>
  )
}

export default function LoginForm() {
  const [state, formAction] = useActionState(signIn, null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const justReset = searchParams.get("reset") === "success"
  const justVerified = searchParams.get("verified") === "true"

  const prefillError = useMemo(() => {
    const e = searchParams.get("error")
    if (!e) return null
    if (e === "verification_failed") return "Email verification failed. Please try signing up again."
    return decodeURIComponent(e)
  }, [searchParams])

  // Single redirect on success — middleware already handles session refresh,
  // so we just send the user to the dashboard (or the page they came from).
  useEffect(() => {
    if (state?.success) {
      const raw = new URLSearchParams(window.location.search).get("next") || ""
      // Only accept same-origin relative paths.
      const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard"
      router.push(next)
    }
  }, [state?.success, router])

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
        <CardDescription className="text-center">Back to your properties</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {justReset && (
            <div className="flex items-start gap-2 bg-chart-4/10 border border-chart-4/40 text-chart-4 px-4 py-3 rounded-md text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Password reset successful. Sign in with your new password.</span>
            </div>
          )}
          {justVerified && (
            <div className="flex items-start gap-2 bg-chart-4/10 border border-chart-4/40 text-chart-4 px-4 py-3 rounded-md text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Email verified. You can sign in now.</span>
            </div>
          )}
          {(state?.error || prefillError) && (
            <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-md text-sm">
              {state?.error || prefillError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required className="bg-input" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required className="bg-input" />
          </div>

          <SubmitButton />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm gap-2">
            <Link href="/auth/forgot-password" className="text-muted-foreground hover:text-primary hover:underline">
              Forgot password?
            </Link>
            <span className="text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/auth/sign-up" className="text-primary hover:underline">
                Sign up
              </Link>
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

