"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle } from "lucide-react"
import { useEffect } from "react"
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
import {
  supplierFormSchema,
  type Supplier,
  type SupplierFormValues,
} from "@/features/suppliers/types"

export interface SupplierFormProps {
  defaultValues?: Supplier
  onSubmit: (values: SupplierFormValues) => Promise<void> | void
  submitLabel?: string
  isPending?: boolean
  serverError?: { field?: string; message: string } | null
}

const EMPTY_DEFAULTS: SupplierFormValues = {
  name: "",
  nit: "",
  address: "",
  city: "",
  contactPerson: "",
  phone: "",
  email: "",
  paymentTerms: "",
}

function normalizeNit(value: string): string {
  return value.replace(/\D/g, "")
}

export function SupplierForm({
  defaultValues,
  onSubmit,
  submitLabel = "Save",
  isPending = false,
  serverError,
}: SupplierFormProps) {
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: defaultValues
      ? {
          name: defaultValues.name,
          nit: defaultValues.nit,
          address: defaultValues.address ?? "",
          city: defaultValues.city ?? "",
          contactPerson: defaultValues.contactPerson ?? "",
          phone: defaultValues.phone ?? "",
          email: defaultValues.email ?? "",
          paymentTerms: defaultValues.paymentTerms ?? "",
        }
      : EMPTY_DEFAULTS,
  })

  useEffect(() => {
    if (serverError?.field) {
      form.setError(serverError.field as keyof SupplierFormValues, {
        type: "manual",
        message: serverError.message,
      })
    }
  }, [serverError, form])

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la empresa</FormLabel>
              <FormControl>
                <Input placeholder="p. ej. Distribuidora Nacional" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>NIT</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  placeholder="p. ej. 900123456"
                  autoComplete="off"
                  {...field}
                  onChange={(event) => {
                    const normalized = normalizeNit(event.target.value)
                    field.onChange(normalized)
                  }}
                  value={field.value}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dirección</FormLabel>
                <FormControl>
                  <Input placeholder="Dirección" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ciudad</FormLabel>
                <FormControl>
                  <Input placeholder="p. ej. La Paz" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="contactPerson"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Persona de contacto</FormLabel>
                <FormControl>
                  <Input placeholder="p. ej. Ana López" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="p. ej. +591 70012345"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo electrónico</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="nombre@ejemplo.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="paymentTerms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Condiciones de pago</FormLabel>
                <FormControl>
                  <Input placeholder="p. ej. 30 días" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
