"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UserForm } from "@/features/users/components/user-form"
import { useCreateUser } from "@/features/users/api/use-create-user"
import type { UserFormValues } from "@/features/users/types"

export function NewUserPageClient() {
  const router = useRouter()
  const create = useCreateUser()

  const onSubmit = async (values: UserFormValues) => {
    await create.mutateAsync(values)
    router.push("/users")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.back()}
           aria-label="Volver"
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div>
           <h1 className="text-2xl font-semibold tracking-tight">Nuevo usuario</h1>
          <p className="text-sm text-muted-foreground">
             Crea un nuevo usuario del sistema. Recibirá una contraseña temporal
             por correo electrónico.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
           <CardTitle>Datos del usuario</CardTitle>
          <CardDescription>
             Todos los campos son obligatorios, salvo los indicados como opcionales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm
            onSubmit={onSubmit}
             submitLabel="Crear usuario"
            isPending={create.isPending}
          />
        </CardContent>
      </Card>
    </div>
  )
}
