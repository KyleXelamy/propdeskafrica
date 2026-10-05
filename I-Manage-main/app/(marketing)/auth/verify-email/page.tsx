'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

// Mark this page as dynamic to prevent static prerendering
export const dynamic = "force-dynamic"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || "your email"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
          <CardDescription>We sent a confirmation link to {email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 text-center">
            <p className="text-muted-foreground leading-relaxed">
              Click the link in the email to verify your account and unlock full access to I-Manage.
            </p>
            <p className="text-sm text-muted-foreground">
              Didn't receive the email? Check your spam folder or the promotions tab.
            </p>
          </div>

          <div className="space-y-3">
            <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/login" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Once verified, you'll have full access to manage your properties, tenants, and finances.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
