import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { requestPasswordReset } from "./action"

export function ForgotPasswordForm() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-2">
          <KeyRound className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold text-center">Reset your password</CardTitle>
        <CardDescription className="text-center">
          Enter your email and we'll send a reset link if the account exists.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={requestPasswordReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="bg-input"
            />
          </div>
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            Send reset link
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            <Link href="/auth/login" className="text-primary hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              Back to sign in
            </Link>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-md">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              If the address is on file, you'll receive an email shortly. Check spam if it
              doesn't arrive within a few minutes.
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
