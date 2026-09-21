"use client"

import { Building2, UserCircle2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { SupplierSummary } from "@/features/purchase-orders/api/use-search-suppliers"

export interface SupplierInfoCardProps {
  supplier: SupplierSummary | null | undefined
  loading?: boolean
}

/**
 * Read-only card that shows every persisted supplier field. Used on the
 * purchase-order detail page so the printable receipt carries the same
 * identifying data the buyer needs (NIT, address, contact, payment terms).
 */
export function SupplierInfoCard({
  supplier,
  loading = false,
}: SupplierInfoCardProps) {
  return (
    <Card className="print:shadow-none print:border-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4" aria-hidden="true" />
          Datos del proveedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-5 w-28" />
          </div>
        ) : supplier ? (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <DetailRow label="Razón social" value={supplier.name} />
            <DetailRow label="NIT" value={supplier.nit} mono />
            <DetailRow label="Ciudad" value={supplier.city ?? "—"} />
            <DetailRow label="Dirección" value={supplier.address ?? "—"} wide />
            <DetailRow label="Contacto" value={supplier.contactPerson ?? "—"} />
            <DetailRow label="Teléfono" value={supplier.phone ?? "—"} />
            <DetailRow label="Email" value={supplier.email ?? "—"} />
            <DetailRow
              label="Condiciones de pago"
              value={supplier.paymentTerms ?? "—"}
            />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No se pudo cargar la información del proveedor.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export interface RequesterInfoCardProps {
  requesterName: string
  requesterRole?: string
  createdAt: string
  loading?: boolean
}

/**
 * Card with the pharmacist/admin who raised the purchase order. Printed on
 * the letter-paper receipt so the supplier and the controller can see who
 * is accountable for the request.
 */
export function RequesterInfoCard({
  requesterName,
  requesterRole,
  createdAt,
  loading = false,
}: RequesterInfoCardProps) {
  const DATE_FORMAT = new Intl.DateTimeFormat("es-BO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
  return (
    <Card className="print:shadow-none print:border-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCircle2 className="size-4" aria-hidden="true" />
          Solicitante
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-36" />
          </div>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <DetailRow label="Nombre" value={requesterName || "—"} />
            <DetailRow label="Rol" value={requesterRole || "—"} />
            <DetailRow
              label="Fecha de solicitud"
              value={DATE_FORMAT.format(new Date(createdAt))}
            />
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

function DetailRow({
  label,
  value,
  mono = false,
  wide = false,
}: {
  label: string
  value: string
  mono?: boolean
  wide?: boolean
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-0.5 font-medium text-foreground break-words ${
          mono ? "font-mono text-sm" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
