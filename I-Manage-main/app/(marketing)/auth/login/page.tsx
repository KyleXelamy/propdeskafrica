import type { Metadata } from "next"
import { Suspense } from "react"
import LoginForm from "@/components/login-form"
import { AuthShell } from "@/components/auth-shell"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Sign in — I-Manage",
  description: "Sign in to your I-Manage landlord dashboard.",
}

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Run your portfolio without the paperwork."
      body="Pick up exactly where you left off — tenants, leases, payments and maintenance all waiting for you."
      footerPrompt="First time here?"
      footerHref="/auth/sign-up"
      footerLabel="Create an account"
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}