"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, Upload, Building2, Boxes, Mail, ReceiptText } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { configurationSchema, EMPTY_CONFIGURATION, type ConfigurationValues } from "@/features/configuration/types"
import {
  useConfiguration,
  useUpdateConfiguration,
  useUploadConfigurationLogo,
} from "@/features/configuration/api/use-configuration"
import { ConfigurationApiError } from "@/features/configuration/api/configuration-api"

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description: string
  icon: typeof Building2
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  )
}

export function ConfigurationPageClient() {
  const query = useConfiguration()
  const update = useUpdateConfiguration()
  const uploadLogo = useUploadConfigurationLogo()
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const form = useForm<ConfigurationValues>({
    resolver: zodResolver(configurationSchema),
    defaultValues: EMPTY_CONFIGURATION,
  })

  useEffect(() => {
    if (query.data) form.reset(query.data)
  }, [form, query.data])

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  const onLogoChange = (file: File | undefined) => {
    if (!file) return
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const onSubmit = async (values: ConfigurationValues) => {
    setSaved(false)
    let nextValues: Partial<ConfigurationValues> = { ...values }
    if (!values.SMTP_PASSWORD) delete nextValues.SMTP_PASSWORD
    if (values.SMTP_HOST && !values.SMTP_PASSWORD) nextValues.SMTP_PASSWORD = ""
    if (logoFile) {
      const uploaded = await uploadLogo.mutateAsync(logoFile)
      nextValues = { ...nextValues, RECEIPT_LOGO_PATH: uploaded.path }
    }
    await update.mutateAsync(nextValues)
    setLogoFile(null)
    setSaved(true)
  }

  const isPending = update.isPending || uploadLogo.isPending
  const error = update.error ?? uploadLogo.error

  if (query.isLoading) {
    return <div className="rounded-xl border bg-card p-8 text-sm text-muted-foreground">Cargando configuración…</div>
  }

  if (query.error) {
    const message = query.error instanceof ConfigurationApiError && query.error.status === 403
      ? "Solo los administradores pueden ver la configuración del sistema."
      : query.error instanceof ConfigurationApiError && query.error.status === 401
        ? "Tu sesión ha expirado. Inicia sesión nuevamente e inténtalo otra vez."
        : "No se pudo cargar la configuración del sistema. Inténtalo nuevamente."
    return <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Administración</p>
            <h1 className="text-3xl font-semibold tracking-tight">Configuración del sistema</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Administra la identidad de la farmacia, el inventario, los recibos y el correo electrónico desde un solo lugar.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">Los cambios se aplican al guardar.</span>
        </div>

        {error ? <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert> : null}
        {saved ? <Alert><AlertDescription>Configuración guardada correctamente.</AlertDescription></Alert> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Información de la farmacia" description="Datos mostrados en recibos y reportes." icon={Building2}>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField form={form} name="PHARMACY_NAME" label="Nombre de la farmacia" required />
              <TextField form={form} name="PHARMACY_NIT" label="NIT o número de registro" />
            </div>
            <TextField form={form} name="PHARMACY_ADDRESS" label="Dirección" />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField form={form} name="PHARMACY_PHONE" label="Teléfono" />
              <TextField form={form} name="PHARMACY_PROPRIETOR" label="Propietario o representante legal" />
            </div>
          </SectionCard>

          <SectionCard title="Configuración de inventario" description="Umbrales utilizados por las alertas de stock y vencimiento." icon={Boxes}>
            <NumberField form={form} name="INVENTORY_LOW_STOCK" label="Umbral de stock bajo" description="Alerta cuando las unidades disponibles llegan a este valor." />
            <NumberField form={form} name="EXPIRY_WARNING_DAYS" label="Plazo de alerta de vencimiento" description="Cantidad de días antes del vencimiento para mostrar una alerta." />
          </SectionCard>

          <SectionCard title="Envío de correo" description="Configuración SMTP utilizada por los correos del sistema." icon={Mail}>
            <div className="grid gap-5 sm:grid-cols-[1fr_140px]">
              <TextField form={form} name="SMTP_HOST" label="Servidor SMTP" />
              <NumberField form={form} name="SMTP_PORT" label="Puerto" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField form={form} name="SMTP_USER" label="Usuario" />
              <FormField control={form.control} name="SMTP_PASSWORD" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña (encriptada)</FormLabel>
                  <FormControl><Input {...field} type="password" autoComplete="new-password" placeholder="Ingresa la contraseña SMTP" /></FormControl>
                  <FormDescription>La contraseña nunca se muestra después de guardarla.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField form={form} name="SMTP_FROM" label="Correo remitente" type="email" />
              <FormField control={form.control} name="SMTP_SECURE" render={({ field }) => (
                <FormItem>
                  <FormLabel>Seguridad del transporte</FormLabel>
                  <FormControl>
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" value={field.value ? "secure" : "plain"} onChange={(event) => field.onChange(event.target.value === "secure")}>
                      <option value="secure">TLS / seguro</option>
                      <option value="plain">STARTTLS / estándar</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </SectionCard>

          <SectionCard title="Configuración de recibos" description="Marca y formato de los recibos impresos." icon={ReceiptText}>
            <FormField control={form.control} name="RECEIPT_PAPER_WIDTH" render={({ field }) => (
              <FormItem>
                <FormLabel>Ancho del papel</FormLabel>
                <FormControl><select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" {...field}><option value="58mm">58 mm</option><option value="80mm">80 mm</option></select></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="RECEIPT_FOOTER" render={({ field }) => (
              <FormItem>
                <FormLabel>Pie del recibo</FormLabel>
                <FormControl><Textarea {...field} rows={3} placeholder="Gracias por su compra" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-medium">Logo del recibo</p><p className="text-xs text-muted-foreground">PNG, JPEG o WebP de hasta 2 MB.</p></div>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload aria-hidden="true" />Elegir logo</Button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => onLogoChange(event.target.files?.[0])} />
              {logoPreview ? <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4"><img src={logoPreview} alt="Selected receipt logo preview" className="max-h-24 max-w-full object-contain" /></div> : valuesLogo(form.getValues("RECEIPT_LOGO_PATH"))}
            </div>
          </SectionCard>
        </div>

        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-4 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
          <span className="hidden text-sm text-muted-foreground sm:inline">Todas las secciones se guardan juntas.</span>
          <Button type="submit" disabled={isPending} className="min-w-40">
            {isPending ? <><LoaderCircle className="animate-spin" aria-hidden="true" />Guardando…</> : "Guardar configuración"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function valuesLogo(path: string) {
  return path ? <p className="text-xs text-muted-foreground">Ya hay un logo configurado. Elige un archivo nuevo para reemplazarlo.</p> : <p className="text-xs text-muted-foreground">No hay ningún logo seleccionado.</p>
}

function TextField({ form, name, label, required, type = "text" }: { form: UseFormReturn<ConfigurationValues>; name: "PHARMACY_NAME" | "PHARMACY_NIT" | "PHARMACY_ADDRESS" | "PHARMACY_PHONE" | "PHARMACY_PROPRIETOR" | "SMTP_HOST" | "SMTP_USER" | "SMTP_FROM"; label: string; required?: boolean; type?: string }) {
  return <FormField control={form.control} name={name} render={({ field }) => <FormItem><FormLabel>{label}{required ? " *" : ""}</FormLabel><FormControl><Input {...field} type={type} /></FormControl><FormMessage /></FormItem>} />
}

function NumberField({ form, name, label, description }: { form: UseFormReturn<ConfigurationValues>; name: "INVENTORY_LOW_STOCK" | "EXPIRY_WARNING_DAYS" | "SMTP_PORT"; label: string; description?: string }) {
  return <FormField control={form.control} name={name} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Input type="number" min={0} {...field} onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))} /></FormControl>{description ? <FormDescription>{description}</FormDescription> : null}<FormMessage /></FormItem>} />
}
