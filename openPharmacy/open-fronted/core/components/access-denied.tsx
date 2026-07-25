"use client"

import { ShieldOff } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Renders a friendly access-denied state for users who don't have the
 * required role to view a page. Used by `RoleGate`.
 */
export function AccessDenied() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="max-w-md border-border/60">
        <CardHeader className="items-center text-center">
          <div className="mb-2 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <ShieldOff className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">Access denied</CardTitle>
          <CardDescription>
            You don&apos;t have permission to view this page. If you believe
            this is a mistake, contact a system administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
