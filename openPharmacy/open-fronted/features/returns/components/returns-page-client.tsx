"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { AlertCircle, History, Search } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useCancelSale,
  useCreateReturn,
  useReturnableSale,
  useReturns,
} from "@/features/returns/api/use-returns"
import { CancelSaleDialog } from "@/features/returns/components/cancel-sale-dialog"
import { FoundSaleCard } from "@/features/returns/components/found-sale-card"
import { ReturnFormCard } from "@/features/returns/components/return-form"
import { ReturnReceipt } from "@/features/returns/components/return-receipt"
import { ReturnsList } from "@/features/returns/components/returns-list"
import { SaleLookupCard } from "@/features/returns/components/sale-lookup-card"
import { useThermalPrint } from "@/features/returns/hooks/use-thermal-print"
import {
  isControlledCategory,
  returnFormSchema,
  type ReturnFormValues,
  type ReturnResponse,
  type ReturnableSale,
} from "@/features/returns/types"

export function ReturnsPageClient() {
  const [view, setView] = useState<"search" | "list">("search")
  const [listPage, setListPage] = useState(1)
  const [search, setSearch] = useState("")
  const [searched, setSearched] = useState<string | undefined>(undefined)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [printData, setPrintData] = useState<
    { returnData: ReturnResponse; sale: ReturnableSale } | null
  >(null)

  const {
    data: sale,
    isLoading,
    error,
  } = useReturnableSale(searched)

  const returnsQuery = useReturns(listPage)
  const createReturn = useCreateReturn()
  const cancelSale = useCancelSale()

  const form = useForm<ReturnFormValues>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: {
      returnType: "PARTIAL",
      reason: "",
    },
    mode: "onChange",
  })

  const returnType = form.watch("returnType")
  const reason = form.watch("reason")

  useThermalPrint(printData)

  const returnableItems = useMemo(() => {
    if (!sale || sale.status !== "COMPLETED") return []
    return sale.items.filter((item) => {
      const controlled = isControlledCategory(item.productCategory)
      const remaining = item.quantity - item.alreadyReturnedQuantity
      return !controlled && remaining > 0
    })
  }, [sale])

  const hasControlledLine = useMemo(
    () =>
      sale?.items.some((item) => isControlledCategory(item.productCategory)) ??
      false,
    [sale],
  )

  useEffect(() => {
    if (returnType === "FULL") {
      setSelectedIds(new Set(returnableItems.map((item) => item.id)))
    }
  }, [returnType, returnableItems])

  useEffect(() => {
    if (!searched) {
      setSelectedIds(new Set())
      form.reset({ returnType: "PARTIAL", reason: "" })
      setPrintData(null)
    }
  }, [searched, form])

  useEffect(() => {
    if (search.trim().length === 0 && searched) {
      setSearched(undefined)
    }
  }, [search, searched])

  const refund = useMemo(() => {
    if (!sale) return 0
    return sale.items.reduce((sum, item) => {
      if (!selectedIds.has(item.id)) return sum
      const remaining = item.quantity - item.alreadyReturnedQuantity
      return sum + item.unitPrice * remaining
    }, 0)
  }, [sale, selectedIds])

  const selectedCount = selectedIds.size
  const canSubmit = Boolean(
    sale &&
      sale.status === "COMPLETED" &&
      !hasControlledLine &&
      selectedCount > 0 &&
      reason.trim().length >= 3,
  )

  const resetSearch = () => {
    setSearch("")
    setSearched(undefined)
    setSelectedIds(new Set())
    form.reset({ returnType: "PARTIAL", reason: "" })
    setPrintData(null)
  }

  const handleSearch = () => {
    const trimmed = search.trim()
    if (trimmed.length === 0) return
    setSearched(trimmed)
    setSelectedIds(new Set())
    form.reset({ returnType: "PARTIAL", reason: "" })
    setPrintData(null)
  }

  const handleToggle = (id: string) => {
    if (returnType === "FULL") return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSubmit = (values: ReturnFormValues) => {
    if (!sale || selectedCount === 0) return

    const items = sale.items
      .filter((item) => selectedIds.has(item.id))
      .map((item) => ({
        saleItemId: item.id,
        quantity: item.quantity - item.alreadyReturnedQuantity,
      }))

    createReturn.mutate(
      {
        saleId: sale.id,
        reason: values.reason,
        returnType: values.returnType,
        items,
      },
      {
        onSuccess: (response) => {
          setPrintData({ returnData: response, sale })
          resetSearch()
          setView("list")
        },
      },
    )
  }

  const handleCancel = (cancelReason: string) => {
    if (!sale) return
    cancelSale.mutate(
      { saleId: sale.id, payload: { reason: cancelReason } },
      {
        onSuccess: () => {
          resetSearch()
          setView("list")
        },
      },
    )
  }

  const showNotFound =
    error?.code === "SALE_NOT_FOUND" ||
    (searched && !isLoading && !sale && !error)

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Devoluciones y cancelaciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Busque una venta por número de recibo para procesar su devolución o
          cancelación.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant={view === "search" ? "default" : "outline"}
          onClick={() => setView("search")}
        >
          <Search className="size-4" aria-hidden="true" />
          Nueva devolución
        </Button>
        <Button
          type="button"
          variant={view === "list" ? "default" : "outline"}
          onClick={() => setView("list")}
        >
          <History className="size-4" aria-hidden="true" />
          Historial
        </Button>
      </div>

      {view === "search" ? (
        <>
          <SaleLookupCard
            value={search}
            onChange={setSearch}
            onSearch={handleSearch}
            isLoading={isLoading}
          />

          {error && error.code !== "SALE_NOT_FOUND" && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {showNotFound && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertTitle>Venta no encontrada</AlertTitle>
              <AlertDescription>
                No existe una venta con el n&uacute;mero &quot;{searched}&quot;.
                Verifique el n&uacute;mero e intente nuevamente.
              </AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="grid gap-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}

          {sale && (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="grid gap-6">
                <FoundSaleCard
                  sale={sale}
                  selectedIds={selectedIds}
                  onToggle={handleToggle}
                  returnType={returnType}
                  disabled={createReturn.isPending || cancelSale.isPending}
                />
                <div className="flex justify-end">
                  <CancelSaleDialog
                    sale={sale}
                    disabled={
                      sale.status !== "COMPLETED" ||
                      hasControlledLine ||
                      createReturn.isPending ||
                      cancelSale.isPending
                    }
                    isPending={cancelSale.isPending}
                    onConfirm={handleCancel}
                  />
                </div>
              </div>

              <ReturnFormCard
                form={form}
                selectedCount={selectedCount}
                refund={refund}
                isPending={createReturn.isPending}
                canSubmit={canSubmit}
                onSubmit={handleSubmit}
              />
            </div>
          )}
        </>
      ) : (
        <>
          {returnsQuery.isLoading && (
            <div className="grid gap-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}
          {returnsQuery.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {returnsQuery.error.message}
              </AlertDescription>
            </Alert>
          )}
          {returnsQuery.data && (
            <ReturnsList
              response={returnsQuery.data}
              page={listPage}
              onPageChange={setListPage}
            />
          )}
        </>
      )}

      {printData && (
        <ReturnReceipt
          returnData={printData.returnData}
          sale={printData.sale}
        />
      )}
    </div>
  )
}
