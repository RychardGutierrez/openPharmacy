"use client"

import { useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, CalendarDays, CircleDollarSign, Clock3, Package, Radio, ShoppingCart } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DatePicker } from "@/features/purchase-orders/components/date-picker"
import { useDashboardInvalidation, useDashboardQueries } from "@/features/dashboard/api/use-dashboard"
import { useDashboardStream } from "@/features/dashboard/hooks/use-dashboard-stream"
import type { DashboardQuery } from "@/features/dashboard/types"

function today(): string {
  return format(new Date(), "yyyy-MM-dd")
}

function money(value: number | null | undefined): string {
  return value == null ? "-" : new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" }).format(value)
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function PanelState({ loading, error, children }: { loading: boolean; error: Error | null; children: React.ReactNode }) {
  if (loading) return <Skeleton className="h-48 w-full" />
  if (error) {
    return <Alert variant="destructive"><AlertTitle>No se pudo cargar el panel</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>
  }
  return <>{children}</>
}

export function DashboardPageClient() {
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [expanded, setExpanded] = useState(false)
  const query: DashboardQuery = { from, to, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/La_Paz" }
  const queries = useDashboardQueries(query, expanded)
  const invalidate = useDashboardInvalidation()
  const streamStatus = useDashboardStream(invalidate)

  const kpis = queries.kpis.data
  const lowStock = queries.lowStock.data?.items ?? []
  const expiring = queries.expiring.data?.lots ?? []
  const unitsSold = queries.unitsSold.data?.items ?? []
  const recentSales = queries.recentSales.data?.sales ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Estado operativo de la farmacia.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full sm:w-40"><label className="mb-1 block text-xs text-muted-foreground">Desde</label><DatePicker value={from} onChange={(value) => value && setFrom(value)} /></div>
          <div className="w-full sm:w-40"><label className="mb-1 block text-xs text-muted-foreground">Hasta</label><DatePicker value={to} minDate={new Date(`${from}T00:00:00`)} onChange={(value) => value && setTo(value)} /></div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={streamStatus === "live" ? "size-2 rounded-full bg-emerald-500" : "size-2 rounded-full bg-amber-500"} />
        <Radio className="size-4" aria-hidden="true" />
        {streamStatus === "live" ? "LIVE · Actualizado en tiempo real" : streamStatus === "connecting" ? "Conectando..." : "Desconectado · Reintentando"}
      </div>

      {queries.kpis.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)}</div> : kpis ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.salesVisible ? <>
            <MetricCard title="Ventas del periodo" value={money(kpis.totalSales)} icon={<CircleDollarSign className="size-4 text-muted-foreground" />} />
            <MetricCard title="Transacciones" value={String(kpis.transactions ?? 0)} icon={<ShoppingCart className="size-4 text-muted-foreground" />} />
            <MetricCard title="Ticket promedio" value={money(kpis.transactions ? (kpis.totalSales ?? 0) / kpis.transactions : 0)} icon={<CircleDollarSign className="size-4 text-muted-foreground" />} />
          </> : <>
            <MetricCard title="Productos bajo stock" value={String(kpis.lowStockCount)} icon={<Package className="size-4 text-muted-foreground" />} />
            <MetricCard title="Lotes por vencer" value={String(kpis.expiringCount)} icon={<Clock3 className="size-4 text-muted-foreground" />} />
            <MetricCard title="Alertas activas" value={String(kpis.activeAlerts)} icon={<AlertTriangle className="size-4 text-muted-foreground" />} />
          </>}
          <MetricCard title="Unidades vendidas" value={String(kpis.unitsSold)} icon={<Package className="size-4 text-muted-foreground" />} />
        </div>
      ) : null}

      {kpis?.salesVisible ? <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Tendencia de ventas</CardTitle></CardHeader>
          <CardContent className="h-72">
            {queries.trend.isLoading ? <Skeleton className="h-full w-full" /> : queries.trend.error ? <p className="text-sm text-destructive">{queries.trend.error.message}</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={queries.trend.data?.points ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Bar dataKey="totalSales" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Ventas recientes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recentSales.length === 0 ? <p className="text-sm text-muted-foreground">No hay ventas en el periodo.</p> : recentSales.map((sale) => <div key={sale.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0"><div><p className="font-medium">{sale.receiptNumber}</p><p className="text-xs text-muted-foreground">{sale.cashier} · {sale.paymentMethod}</p></div><span className="font-medium tabular-nums">{money(sale.total)}</span></div>)}
          </CardContent>
        </Card>
      </div> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Alertas de bajo stock</CardTitle><Badge variant="outline">{kpis?.lowStockCount ?? lowStock.length}</Badge></CardHeader>
          <CardContent><PanelState loading={queries.lowStock.isLoading} error={queries.lowStock.error as Error | null}>{lowStock.length === 0 ? <p className="text-sm text-muted-foreground">No hay productos bajo stock.</p> : <Table><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Stock</TableHead><TableHead>Déficit</TableHead></TableRow></TableHeader><TableBody>{lowStock.map((item) => <TableRow key={item.productId}><TableCell><div className="font-medium">{item.commercialName}</div><div className="text-xs text-muted-foreground">{item.dciName}</div></TableCell><TableCell>{item.currentStock} / {item.minStock}</TableCell><TableCell><Badge variant="destructive">-{item.deficit}</Badge></TableCell></TableRow>)}</TableBody></Table>}</PanelState></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Productos por vencer</CardTitle><Badge variant="outline">{kpis?.expiringCount ?? expiring.length}</Badge></CardHeader>
          <CardContent><PanelState loading={queries.expiring.isLoading} error={queries.expiring.error as Error | null}>{expiring.length === 0 ? <p className="text-sm text-muted-foreground">No hay lotes próximos a vencer.</p> : <div className="space-y-3">{expiring.map((lot) => <div key={lot.lotId} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0"><div><p className="font-medium">{lot.productName}</p><p className="text-xs text-muted-foreground">Lote {lot.lotNumber} · {lot.currentQty} unidades</p></div><Badge variant={lot.status === "RED" ? "destructive" : "outline"}>{lot.daysUntilExpiry < 0 ? "Vencido" : `${lot.daysUntilExpiry} días`}</Badge></div>)}</div>}</PanelState></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Unidades vendidas por producto</CardTitle><Badge variant="outline">{kpis?.unitsSold ?? 0} total</Badge></CardHeader>
        <CardContent><PanelState loading={queries.unitsSold.isLoading} error={queries.unitsSold.error as Error | null}>{unitsSold.length === 0 ? <p className="text-sm text-muted-foreground">No hay unidades vendidas en el periodo.</p> : <Table><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Unidades</TableHead></TableRow></TableHeader><TableBody>{unitsSold.map((item) => <TableRow key={item.productId}><TableCell className="font-medium">{item.productName}</TableCell><TableCell className="text-right font-medium tabular-nums">{item.unitsSold}</TableCell></TableRow>)}</TableBody></Table>}</PanelState></CardContent>
      </Card>
      <Button variant="outline" className="self-center" onClick={() => setExpanded((value) => !value)}><CalendarDays className="mr-2 size-4" />{expanded ? "Mostrar solo los 10 primeros" : "Mostrar más alertas"}</Button>
    </div>
  )
}
