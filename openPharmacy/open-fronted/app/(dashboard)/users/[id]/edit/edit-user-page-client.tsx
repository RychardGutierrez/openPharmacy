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
import { useUser } from "@/features/users/api/use-user"
import { useUpdateUser } from "@/features/users/api/use-update-user"
import type { UserFormValues } from "@/features/users/types"

export function EditUserPageClient({ id }: { id: string }) {
  const router = useRouter()
  const { data: user, isLoading, error } = useUser(id)
  const update = useUpdateUser()

  const onSubmit = async (values: UserFormValues) => {
    await update.mutateAsync({ id, values })
    router.push("/users")
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading user…</p>
    )
  }

  if (error || !user) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-destructive">Could not load this user.</p>
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => router.push("/users")}
        >
          Back to list
        </Button>
      </div>
    )
  }

  const defaults: Partial<UserFormValues> = {
    fullName: user.fullName,
    ci: user.ci,
    email: user.email,
    role: user.role,
    regNumber: user.regNumber ?? "",
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
          <h1 className="text-2xl font-semibold tracking-tight">Edit user</h1>
          <p className="text-sm text-muted-foreground">
            Update the user&apos;s details and role.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{user.fullName}</CardTitle>
          <CardDescription>
            Changes apply immediately after saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm
            defaultValues={defaults}
            onSubmit={onSubmit}
            submitLabel="Save changes"
            isPending={update.isPending}
          />
        </CardContent>
      </Card>
    </div>
  )
}
