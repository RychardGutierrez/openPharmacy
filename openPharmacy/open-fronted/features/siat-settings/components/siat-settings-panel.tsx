"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Clock, FileText, KeyRound, LoaderCircle, PlugZap, Power, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { SiatSettingsApiError } from "@/features/siat-settings/api/siat-settings-api"
import {
  useSiatCatalogsStatus,
  useSiatSettings,
  useSyncSiatCatalogs,
  useTestSiatConnection,
  useUpdateSiatSettings,
} from "@/features/siat-settings/api/use-siat-settings"
import {
  SIAT_CATALOG_LABELS,
  SIAT_READINESS_LABELS,
  siatSettingsFormSchema,
  toSiatFormValues,
  type SiatConnectionTest,
  type SiatEnvironment,
  type SiatSettings,
  type SiatSettingsFormValues,
} from "@/features/siat-settings/types"

const EMPTY_FORM: SiatSettingsFormValues = {
  systemCode: "",
  razonSocial: "",
  municipio: "",
  telefono: "",
  defaultActivity: "",
  token: "",
  tokenExpiresAt: "",
  enabled: false,
  emailInvoices: false,
}

export function SiatSettingsPanel() {
  const query = useSiatSettings()
  const update = useUpdateSiatSettings()
  const [saved, setSaved] = useState(false)
  const form = useForm<SiatSettingsFormValues>({
    resolver: zodResolver(siatSettingsFormSchema),
    defaultValues: EMPTY_FORM,
  })

  useEffect(() => {
    if (query.data) form.reset(toSiatFormValues(query.data))
  }, [form, query.data])

  const onSubmit = async (values: SiatSettingsFormValues) => {
    setSaved(false)
    await update.mutateAsync(values)
    setSaved(true)
  }

  if (query.isLoading) {
    return <div className="rounded-xl border bg-card p-8 text-sm text-muted-foreground">Cargando configuración SIAT…</div>
  }

  if (query.error || !query.data) {
    const message = query.error instanceof SiatSettingsApiError && query.error.status === 403
      ? "Solo los administradores pueden ver la configuración SIAT."
      : "No se pudo cargar la configuración SIAT. Inténtalo nuevamente."
    return <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>
  }

  const settings = query.data
  const error = update.error

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Facturación en línea</p>
            <h1 className="text-3xl font-semibold tracking-tight">Facturación SIAT</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Datos del contribuyente y credenciales para emitir facturas Computarizadas en Línea ante el SIN.
            </p>
          </div>
          <EnvironmentBadge environment={settings.environment} size="lg" />
        </div>

        {error ? <SaveError error={error} /> : null}
        {saved ? <Alert><AlertDescription>Configuración SIAT guardada correctamente.</AlertDescription></Alert> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Datos del contribuyente"
            description="Deben coincidir exactamente con el Padrón del SIN."
            icon={FileText}
          >
            <div className="grid gap-2">
              <Label htmlFor="siat-nit">NIT</Label>
              <Input id="siat-nit" value={settings.nit || "Sin configurar"} readOnly disabled />
              <p className="text-sm text-muted-foreground">
                Es el NIT de la farmacia. Se edita en la pestaña General.
              </p>
            </div>
            <TextField
              form={form}
              name="razonSocial"
              label="Razón social"
              description="Exactamente como figura en el Padrón. No uses el nombre comercial."
            />
            <div className="grid items-start gap-5 sm:grid-cols-2">
              <TextField form={form} name="systemCode" label="Código de sistema" description="Asignado por el SIN al registrar el sistema." />
              {/* Read-only: not a form field. */}
              <div className="grid gap-2">
                <Label htmlFor="siat-modality">Modalidad</Label>
                <Input id="siat-modality" value={`Computarizada en Línea (${settings.modality})`} readOnly disabled />
              </div>
            </div>
            <div className="grid items-start gap-5 sm:grid-cols-2">
              <TextField form={form} name="municipio" label="Municipio" />
              <TextField form={form} name="telefono" label="Teléfono" />
            </div>
            <TextField
              form={form}
              name="defaultActivity"
              label="Actividad económica por defecto"
              description="Código de actividad registrado en el SIN."
              inputMode="numeric"
            />
          </SectionCard>

          <div className="flex flex-col gap-6">
            <SectionCard
              title="Token delegado"
              description="Se guarda cifrado y nunca se vuelve a mostrar."
              icon={KeyRound}
            >
              <TokenStatus token={settings.token} />
              <FormField control={form.control} name="token" render={({ field }) => (
                <FormItem>
                  <FormLabel>{settings.token.configured ? "Reemplazar token" : "Token"}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" placeholder="Pega el nuevo token delegado" />
                  </FormControl>
                  <FormDescription>Déjalo vacío para conservar el token actual.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tokenExpiresAt" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vence el</FormLabel>
                  <FormControl><Input {...field} type="date" /></FormControl>
                  <FormDescription>Obligatorio al cargar un token nuevo.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </SectionCard>

            <SectionCard title="Estado" description="Interruptor general de la facturación SIAT." icon={Power}>
              <SwitchField
                form={form}
                name="enabled"
                label="Habilitar facturación SIAT"
                description="Mientras esté deshabilitada, las ventas no emiten facturas."
              />
              {!settings.readiness.ready ? (
                <Alert>
                  <AlertTitle>Para habilitarla falta:</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {settings.readiness.missing.map((gap) => <li key={gap}>{SIAT_READINESS_LABELS[gap] ?? gap}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              <SwitchField
                form={form}
                name="emailInvoices"
                label="Enviar facturas por correo"
                description="Envía la factura al correo del comprador cuando lo indique."
              />
            </SectionCard>
          </div>
        </div>

        <CatalogsCard />

        <ConnectionTestCard environment={settings.environment} />

        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-4 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
          <span className="hidden text-sm text-muted-foreground sm:inline">Los cambios se registran en la auditoría.</span>
          <Button type="submit" disabled={update.isPending} className="min-w-40">
            {update.isPending ? <><LoaderCircle className="animate-spin" aria-hidden="true" />Guardando…</> : "Guardar configuración SIAT"}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function SaveError({ error }: { error: Error }) {
  const missing = error instanceof SiatSettingsApiError ? error.missing : []
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {error.message}
        {missing.length > 0 ? (
          <ul className="mt-1 list-disc pl-4">
            {missing.map((gap) => <li key={gap}>{SIAT_READINESS_LABELS[gap] ?? gap}</li>)}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

function EnvironmentBadge({ environment, size = "sm" }: { environment: SiatEnvironment; size?: "sm" | "lg" }) {
  const production = environment === "PRODUCCION"
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-bold tracking-wide",
        size === "lg" && "h-9 px-4 text-base",
        production
          ? "border-red-600 bg-red-600 text-white"
          : "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
      )}
      aria-label={`Ambiente SIAT: ${production ? "Producción" : "Piloto"}`}
    >
      {production ? "PRODUCCIÓN" : "PILOTO"}
    </Badge>
  )
}

function TokenStatus({ token }: { token: SiatSettings["token"] }) {
  if (!token.configured) {
    return <p className="text-sm font-medium text-destructive">No configurado</p>
  }
  if (token.source === "environment") {
    return <p className="text-sm text-muted-foreground">Usando <code>SIAT_TOKEN</code> del entorno (solo en piloto). Carga el token aquí para guardarlo cifrado.</p>
  }
  if (!token.expiresAt) return <p className="text-sm font-medium">Configurado</p>
  const date = formatDate(token.expiresAt)
  if (token.expired) {
    return <p className="text-sm font-medium text-destructive">Configurado, vencido el {date}. Carga un token nuevo.</p>
  }
  const days = token.daysUntilExpiry ?? 0
  return (
    <p className={cn("text-sm font-medium", days <= 15 && "text-amber-700 dark:text-amber-400")}>
      Configurado, vence el {date} ({days === 0 ? "hoy" : `en ${days} ${days === 1 ? "día" : "días"}`})
    </p>
  )
}

const CONNECTION_LABELS: Record<SiatConnectionTest["connection"]["status"], string> = {
  ok: "Conexión exitosa",
  rejected: "SIAT rechazó la solicitud (revisa el token)",
  unavailable: "SIAT no responde",
  "not-configured": "Falta el token delegado",
  error: "Respuesta no válida de SIAT",
}

const CUIS_LABELS: Record<SiatConnectionTest["cuis"]["status"], string> = {
  active: "Vigente",
  expired: "Vencido",
  missing: "Sin CUIS (se solicita al configurar los puntos de venta)",
  "no-point-of-sale": "El punto de venta no está registrado",
}

/** Clock offset above this is flagged to the user (SIAT_CLOCK_WARN_MS default). */
const CLOCK_WARN_MS = 5000

function CatalogsCard() {
  const status = useSiatCatalogsStatus()
  const sync = useSyncSiatCatalogs()
  const data = status.data
  const result = sync.data

  return (
    <SectionCard
      title="Catálogos y hora SIAT"
      description="Catálogos del SIN (productos, leyendas, tipos de documento, monedas) y la hora que usa SIAT. Se sincronizan cada día y al pulsar el botón."
      icon={Clock}
    >
      {status.error ? (
        <Alert variant="destructive"><AlertDescription>{status.error.message}</AlertDescription></Alert>
      ) : null}
      {data ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Desfase de hora</dt>
            <dd>
              {data.clock.sampledAt ? (
                <>
                  {data.clock.offsetMs} ms
                  {Math.abs(data.clock.offsetMs) > CLOCK_WARN_MS ? (
                    <Badge variant="destructive" className="ml-2">Revisar la hora del equipo</Badge>
                  ) : null}
                  {data.clock.stale ? <Badge variant="secondary" className="ml-2">Desactualizada</Badge> : null}
                </>
              ) : (
                "Sin medir todavía"
              )}
            </dd>
            <dt className="text-muted-foreground">Última sincronización completa</dt>
            <dd>{formatLastSuccess(data.catalogs)}</dd>
          </dl>

          {data.missingForEmission.length > 0 ? (
            <Alert>
              <AlertTitle>Faltan catálogos para emitir facturas:</AlertTitle>
              <AlertDescription className="flex flex-wrap gap-2 pt-1">
                {data.missingForEmission.map((slug) => (
                  <Badge key={slug} variant="outline">{SIAT_CATALOG_LABELS[slug] ?? slug}</Badge>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}

          {data.failing.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Fallaron {data.failing.length} catálogo(s) en la última sincronización</AlertTitle>
              <AlertDescription>
                {data.failing.map((slug) => SIAT_CATALOG_LABELS[slug] ?? slug).join(", ")}
              </AlertDescription>
            </Alert>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
          {sync.isPending ? (
            <><LoaderCircle className="animate-spin" aria-hidden="true" />Sincronizando…</>
          ) : (
            <><RefreshCw aria-hidden="true" />Sincronizar ahora</>
          )}
        </Button>
      </div>

      {sync.error ? <Alert variant="destructive"><AlertDescription>{sync.error.message}</AlertDescription></Alert> : null}
      {result ? (
        <Alert variant={result.catalogs.some((c) => c.status === "failed") ? "destructive" : "default"}>
          <AlertTitle>
            {result.catalogs.filter((c) => c.status === "synced").length} sincronizados,{" "}
            {result.catalogs.filter((c) => c.status === "failed").length} con error
          </AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {result.catalogs
                .filter((c) => c.status === "failed")
                .map((c) => (
                  <li key={c.slug}>{(SIAT_CATALOG_LABELS[c.slug] ?? c.slug) + ": " + (c.error ?? "")}</li>
                ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </SectionCard>
  )
}

/** The oldest successful sync: the set is only as fresh as its least recent catalog. */
function formatLastSuccess(catalogs: { lastSuccessAt: string | null }[]) {
  const times = catalogs.map((c) => (c.lastSuccessAt ? Date.parse(c.lastSuccessAt) : null))
  if (times.some((t) => t === null)) return "Algún catálogo nunca se ha sincronizado"
  return new Date(Math.min(...(times as number[]))).toLocaleString("es-BO")
}

function ConnectionTestCard({ environment }: { environment: SiatEnvironment }) {
  const test = useTestSiatConnection()
  const result = test.data
  const ok = result?.connection.status === "ok"

  return (
    <SectionCard
      title="Probar conexión"
      description="Llama a verificarComunicacion y revisa el CUIS guardado. Usa el token guardado: guarda antes de probar."
      icon={PlugZap}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
          {test.isPending ? <><LoaderCircle className="animate-spin" aria-hidden="true" />Probando…</> : "Probar conexión"}
        </Button>
        <span className="text-sm text-muted-foreground">Ambiente:</span>
        <EnvironmentBadge environment={result?.environment ?? environment} size="lg" />
      </div>
      {test.error ? <Alert variant="destructive"><AlertDescription>{test.error.message}</AlertDescription></Alert> : null}
      {result ? (
        <Alert variant={ok ? "default" : "destructive"}>
          <AlertTitle>{CONNECTION_LABELS[result.connection.status]} ({result.connection.durationMs} ms)</AlertTitle>
          <AlertDescription>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {result.connection.mensajes.map((m) => (
                <div key={m.codigo} className="contents"><dt>Mensaje {m.codigo}</dt><dd>{m.descripcion}</dd></div>
              ))}
              {result.connection.detail ? <><dt>Detalle</dt><dd className="break-all">{result.connection.detail}</dd></> : null}
              <dt>CUIS (sucursal {result.cuis.codigoSucursal}, punto de venta {result.cuis.codigoPuntoVenta})</dt>
              <dd>
                {CUIS_LABELS[result.cuis.status]}
                {result.cuis.validUntil ? `, hasta ${new Date(result.cuis.validUntil).toLocaleString("es-BO")}` : ""}
              </dd>
            </dl>
          </AlertDescription>
        </Alert>
      ) : null}
    </SectionCard>
  )
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description: string
  icon: typeof FileText
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

type TextFieldName = "razonSocial" | "systemCode" | "municipio" | "telefono" | "defaultActivity"

function TextField({
  form,
  name,
  label,
  description,
  inputMode,
}: {
  form: UseFormReturn<SiatSettingsFormValues>
  name: TextFieldName
  label: string
  description?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
}) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl><Input {...field} inputMode={inputMode} /></FormControl>
        {description ? <FormDescription>{description}</FormDescription> : null}
        <FormMessage />
      </FormItem>
    )} />
  )
}

function SwitchField({
  form,
  name,
  label,
  description,
}: {
  form: UseFormReturn<SiatSettingsFormValues>
  name: "enabled" | "emailInvoices"
  label: string
  description: string
}) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-3">
        <div className="grid gap-1">
          <FormLabel>{label}</FormLabel>
          <FormDescription>{description}</FormDescription>
        </div>
        <FormControl>
          <Switch checked={field.value} onCheckedChange={field.onChange} />
        </FormControl>
      </FormItem>
    )} />
  )
}

/** `YYYY-MM-DD` → `DD/MM/YYYY`, without a time zone shift. */
function formatDate(date: string) {
  const [year, month, day] = date.split("-")
  return `${day}/${month}/${year}`
}
