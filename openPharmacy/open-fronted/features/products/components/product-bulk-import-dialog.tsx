"use client"

import { useState } from "react"
import { Download, FileUp, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBulkImportProducts } from "@/features/products/api/use-bulk-import-products"
import { BULK_IMPORT_HEADERS } from "@/features/products/types"

export interface ProductBulkImportDialogProps {
  children: React.ReactNode
}

const SAMPLE_ROW = [
  "Paracetamol",
  "Paracetamol MK",
  "Genfar",
  "Tableta",
  "500mg",
  "7771234500011",
  "OTC",
  "2.50",
  "1.20",
  "20",
]

function downloadTemplate() {
  const csv = [BULK_IMPORT_HEADERS.join(","), SAMPLE_ROW.join(",")].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "plantilla-productos.csv"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function ProductBulkImportDialog({
  children,
}: ProductBulkImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const importMutation = useBulkImportProducts()
  const result = importMutation.data

  const reset = () => {
    setFile(null)
    importMutation.reset()
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      reset()
    }
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) return
    await importMutation.mutateAsync(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar productos</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con los productos. Descarga la plantilla para
            ver el formato esperado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              className="gap-1"
            >
              <Download aria-hidden="true" />
              Descargar ejemplo de plantilla
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bulk-import-file">Archivo CSV</Label>
            <Input
              id="bulk-import-file"
              type="file"
              accept=".csv"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null
                setFile(selected)
                importMutation.reset()
              }}
            />
          </div>

          {result ? (
            <div className="rounded border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                Insertados: {result.inserted} · Fallidos:{" "}
                {result.failed.length}
              </p>
              {result.failed.length > 0 ? (
                <div className="mt-2 max-h-60 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fila</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Errores</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.failed.map((failedRow) => (
                        <TableRow key={`${failedRow.row}-${failedRow.barcode}`}>
                          <TableCell>{failedRow.row}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {failedRow.barcode || "—"}
                          </TableCell>
                          <TableCell className="text-destructive whitespace-pre-wrap">
                            {failedRow.errors.join("; ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="submit"
              disabled={!file || importMutation.isPending}
              className="gap-1"
            >
              {importMutation.isPending ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                  <span>Importando…</span>
                </>
              ) : (
                <>
                  <FileUp aria-hidden="true" />
                  <span>Importar</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
