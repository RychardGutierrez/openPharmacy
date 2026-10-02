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
          <CardTitle className="text-xl">Acceso denegado</CardTitle>
          <CardDescription>
            No tienes permiso para ver esta página. Si crees que es un error,
            contacta al administrador del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/dashboard">Volver al panel</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
