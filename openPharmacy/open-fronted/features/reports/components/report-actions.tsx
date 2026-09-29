import { FileSpreadsheet, FileText, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ReportActions({
  isPending,
  disabled,
  onExport,
}: {
  isPending: boolean
  disabled: boolean
  onExport: (format: "XLSX" | "PDF") => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Button type="button" variant="outline" disabled={disabled || isPending} onClick={() => onExport("XLSX")}>
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
        Exportar Excel
      </Button>
      <Button type="button" disabled={disabled || isPending} onClick={() => onExport("PDF")}>
        {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
        Exportar PDF
      </Button>
    </div>
  )
}
