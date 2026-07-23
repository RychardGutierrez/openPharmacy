import type { Metadata } from "next"
import { Pill } from "lucide-react"

import { BrandPanel } from "@/features/auth/components/brand-panel"
import { LoginForm } from "@/features/auth/components/login-form"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
}

/** Decorative arc pattern echoing the mockup's background curves. */
function FormBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="absolute -right-40 -top-40 size-[36rem] text-muted-foreground/15"
        viewBox="0 0 400 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1">
        <circle cx="200" cy="200" r="180" />
        <circle cx="200" cy="200" r="140" />
        <circle cx="200" cy="200" r="100" />
        <path d="M 20 200 Q 200 20 380 200" />
        <path d="M 20 200 Q 200 380 380 200" />
        <path d="M 80 80 Q 200 200 320 80" />
        <path d="M 80 320 Q 200 200 320 320" />
      </svg>
      <svg
        className="absolute -bottom-32 -left-32 size-[28rem] text-primary/10"
        viewBox="0 0 400 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1">
        <circle cx="200" cy="200" r="160" />
        <circle cx="200" cy="200" r="120" />
        <path d="M 40 200 Q 200 40 360 200" />
        <path d="M 40 200 Q 200 360 360 200" />
      </svg>
    </div>
  )
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const { from } = await searchParams

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <BrandPanel />

      <div className="relative flex items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-8">
        <FormBackdrop />

        <div className="relative z-10 flex w-full max-w-md flex-col gap-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="flex size-9 items-center justify-center bg-primary text-primary-foreground">
              <Pill className="size-4" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              OpenPharmacy
            </span>
          </div>

          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                Sign in to your account
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and password to continue.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <LoginForm from={from} />
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Protected by JWT authentication · 7-day session
          </p>
        </div>
      </div>
    </main>
  )
}
