"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
} from "lucide-react"

import { loginSchema, type LoginValues } from "@/features/auth/types"
import { useLogin } from "@/features/auth/api/use-login"
import { useSession } from "@/features/auth/api/use-session"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const DEFAULT_REDIRECT_PATH = "/dashboard"

/** Open-redirect guard: only allow paths inside this app. */
function safeRedirectPath(from: string | undefined): string {
  if (from !== undefined && from.startsWith("/") && !from.startsWith("//")) {
    return from
  }
  return DEFAULT_REDIRECT_PATH
}

/** Module-level so it is not re-created on every keystroke. */
function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
      {children}
    </span>
  )
}

export function LoginForm({ from }: { from?: string }) {
  const router = useRouter()
  const loginMutation = useLogin()
  const { status } = useSession()
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(safeRedirectPath(from))
    }
  }, [status, from, router])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await loginMutation.mutateAsync(values)
    } catch {
      // Handled declaratively below via loginMutation.isError.
    }
  })

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-5">
        {loginMutation.isError ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Sign-in failed</AlertTitle>
            <AlertDescription>
              {loginMutation.error.message}
            </AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <div className="relative">
                  <FieldIcon>
                    <Mail className="size-4" />
                  </FieldIcon>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email"
                    className={cn("h-11 pl-10", "text-sm")}
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
              </div>
              <FormControl>
                <div className="relative">
                  <FieldIcon>
                    <Lock className="size-4" />
                  </FieldIcon>
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={cn("h-11 pl-10 pr-11", "text-sm")}
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex items-center px-3.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          size="lg"
          className="mt-2 h-11 w-full text-sm font-semibold tracking-wide shadow-sm transition-all hover:shadow-md"
          disabled={loginMutation.isPending}>
          {loginMutation.isPending ? (
            <>
              <LoaderCircle
                className="animate-spin"
                aria-hidden="true"
              />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>
    </Form>
  )
}
