"use client"

import {
  RECEIPT_NOTA_FISCAL_FOOTER,
  type SaleReceipt,
} from "@/features/pos/types"
import {
  formatReceiptDate,
  formatReceiptMoney,
} from "@/features/pos/lib/receipt-format"

interface ThermalReceiptProps {
  receipt: SaleReceipt
}

export function ThermalReceipt({ receipt }: ThermalReceiptProps) {
  const name = receipt.pharmacy.PHARMACY_NAME ?? "OpenPharmacy"

  return (
    <div
      id="pos-receipt"
      className="print-pos-receipt"
      aria-hidden="true"
    >
      <h1 className="receipt-center receipt-bold">{name}</h1>
      {receipt.pharmacy.PHARMACY_ADDRESS && (
        <p className="receipt-center">{receipt.pharmacy.PHARMACY_ADDRESS}</p>
      )}
      {receipt.pharmacy.PHARMACY_PHONE && (
        <p className="receipt-center">
          Tel: {receipt.pharmacy.PHARMACY_PHONE}
        </p>
      )}
      {receipt.pharmacy.PHARMACY_NIT && (
        <p className="receipt-center">NIT: {receipt.pharmacy.PHARMACY_NIT}</p>
      )}
      <hr className="receipt-dashed" />
      <p>
        <span>Recibo:</span>
        <span className="receipt-bold">{receipt.receiptNumber}</span>
      </p>
      <p>
        <span>Fecha:</span>
        <span>{formatReceiptDate(receipt.createdAt)}</span>
      </p>
      <hr className="receipt-dashed" />
      {receipt.items.map((item) => (
        <div key={item.id} className="receipt-item">
          <p>
            <span>{item.productName}</span>
            <span>{formatReceiptMoney(item.lineTotal)}</span>
          </p>
          <p className="receipt-muted">
            <span>
              {item.quantity} x {formatReceiptMoney(item.unitPrice)} · Lote{" "}
              {item.lotNumber}
            </span>
          </p>
        </div>
      ))}
      <hr className="receipt-dashed" />
      <p>
        <span>Subtotal</span>
        <span>{formatReceiptMoney(receipt.subtotal)}</span>
      </p>
      {receipt.discount > 0 && (
        <p>
          <span>Descuento</span>
          <span>-{formatReceiptMoney(receipt.discount)}</span>
        </p>
      )}
      <p className="receipt-bold">
        <span>TOTAL</span>
        <span>{formatReceiptMoney(receipt.total)}</span>
      </p>
      <p>
        <span>
          {receipt.paymentMethod === "MIXED"
            ? "Mixto (efectivo)"
            : "Pago"}
        </span>
        <span>{formatReceiptMoney(receipt.cashReceived)}</span>
      </p>
      {receipt.paymentMethod === "MIXED" && (
        <p>
          <span>Resto electrónico</span>
          <span>
            {formatReceiptMoney(receipt.total - receipt.cashReceived)}
          </span>
        </p>
      )}
      <p>
        <span>Cambio</span>
        <span>{formatReceiptMoney(receipt.changeGiven)}</span>
      </p>
      <hr className="receipt-dashed" />
      <p className="receipt-center receipt-bold">
        {RECEIPT_NOTA_FISCAL_FOOTER}
      </p>
      <p className="receipt-center">¡Gracias por su compra!</p>
    </div>
  )
}
