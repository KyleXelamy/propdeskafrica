import type { Metadata } from "next"
import SignUpForm from "@/components/sign-up-form"
import { AuthShell } from "@/components/auth-shell"

export const metadata: Metadata = {
  title: "Get started — PropDesk Africa",
  description: "Create your PropDesk Africa landlord account in seconds.",
}

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Get started"
      title="The first 3 units are free. Forever."
      body="No credit card. No phone calls. Set up your portfolio, invite your first tenant and start collecting rent in minutes."
      footerPrompt="Already have an account?"
      footerHref="/auth/login"
      footerLabel="Sign in"
    >
      <SignUpForm />
    </AuthShell>
  )
}