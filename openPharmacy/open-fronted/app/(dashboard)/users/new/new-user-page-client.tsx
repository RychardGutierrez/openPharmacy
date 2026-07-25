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
          aria-label="Back"
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New user</h1>
          <p className="text-sm text-muted-foreground">
            Create a new system user. They will receive a temporary password by
            email.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            All fields are required unless marked optional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm
            onSubmit={onSubmit}
            submitLabel="Create user"
            isPending={create.isPending}
          />
        </CardContent>
      </Card>
    </div>
  )
}
