"use client"

import { formatReceiptDate } from "@/features/pos/lib/receipt-format"
import {
  RETURN_SOURCE_LABELS,
  type ReturnableSale,
  type ReturnResponse,
} from "@/features/returns/types"

export interface ReturnReceiptProps {
  returnData: ReturnResponse
  sale: ReturnableSale
}

export function ReturnReceipt({ returnData, sale }: ReturnReceiptProps) {
  const returnedItems = returnData.items.map((item) => {
    const saleItem = sale.items.find(
      (line) => line.id === item.saleItemId || line.lotId === item.lotId,
    )
    return {
      ...item,
      productName: saleItem?.productName ?? "Producto",
      unitPrice: saleItem?.unitPrice ?? 0,
    }
  })

  const refund = returnedItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )

  return (
    <div
      id="return-receipt"
      className="print-pos-receipt"
      aria-hidden="true"
    >
      <h1 className="receipt-center receipt-bold">
        {RETURN_SOURCE_LABELS[returnData.source].toUpperCase()}
      </h1>
      <p className="receipt-center">Venta original: {sale.receiptNumber}</p>
      <p className="receipt-center">
        Fecha: {formatReceiptDate(returnData.createdAt)}
      </p>
      <hr className="receipt-dashed" />
      {returnedItems.map((item) => (
        <div key={item.id} className="receipt-item">
          <p>
            <span>{item.productName}</span>
            <span>
              {(item.unitPrice * item.quantity).toFixed(2)} Bs
            </span>
          </p>
          <p className="receipt-muted">
            <span>
              {item.quantity} x {item.unitPrice.toFixed(2)} Bs · Lote{" "}
              {item.lotNumber}
            </span>
          </p>
        </div>
      ))}
      <hr className="receipt-dashed" />
      <p className="receipt-bold">
        <span>TOTAL REEMBOLSO</span>
        <span>{refund.toFixed(2)} Bs</span>
      </p>
      <hr className="receipt-dashed" />
      <p className="receipt-muted">
        <span>Motivo:</span>
      </p>
      <p className="receipt-center">{returnData.reason}</p>
      <p className="receipt-center receipt-muted">
        Documento no válido como nota fiscal
      </p>
    </div>
  )
}
