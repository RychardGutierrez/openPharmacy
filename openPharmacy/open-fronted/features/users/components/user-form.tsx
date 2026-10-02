"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle } from "lucide-react"
import { useForm } from "react-hook-form"

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
import { userFormSchema, type UserFormValues } from "@/features/users/types"
import { RoleCardGroup } from "@/features/users/components/role-card-group"

export interface UserFormProps {
  defaultValues?: Partial<UserFormValues>
  onSubmit: (values: UserFormValues) => Promise<void> | void
  submitLabel?: string
  isPending?: boolean
}

const EMPTY_DEFAULTS: UserFormValues = {
  fullName: "",
  ci: "",
  email: "",
  role: "CASHIER",
  regNumber: "",
}

export function UserForm({
  defaultValues,
  onSubmit,
  submitLabel = "Guardar",
  isPending = false,
}: UserFormProps) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { ...EMPTY_DEFAULTS, ...defaultValues },
  })

  const role = form.watch("role")
  const isPharmacist = role === "PHARMACIST"

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
      >
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre completo</FormLabel>
              <FormControl>
                <Input placeholder="Ej. María López" autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="ci"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CI</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    placeholder="De 6 a 12 dígitos"
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo electrónico</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="nombre@farmacia.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rol</FormLabel>
              <FormControl>
                <RoleCardGroup
                  value={field.value}
                  onChange={field.onChange}
                  name={field.name}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isPharmacist ? (
          <FormField
            control={form.control}
            name="regNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número de registro profesional</FormLabel>
                <FormControl>
                <Input placeholder="Ej. CR-12345" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending} className="min-w-32">
            {isPending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                <span>Guardando…</span>
              </>
            ) : (
              <span>{submitLabel}</span>
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
