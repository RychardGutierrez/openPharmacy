"use client"

import { create } from "zustand"

import type { Product } from "@/features/products/types"
import type { CartLine, SaleReceipt } from "@/features/pos/types"

const STORAGE_KEY = "pos-cart:v1"
const EXPIRING_SOON_DAYS = 60

interface PersistedCart {
  version: 1
  lines: CartLine[]
  lastSaleId: string | null
  savedAt: string
}

interface LotInfo {
  id: string
  lotNumber: string
  expiryDate: string
  currentQty: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function daysUntil(dateIso: string): number {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const target = new Date(dateIso)
  target.setUTCHours(0, 0, 0, 0)
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000)
}

function loadPersisted(): PersistedCart | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedCart
    if (parsed.version !== 1 || !Array.isArray(parsed.lines)) return null
    return parsed
  } catch {
    return null
  }
}

function savePersisted(cart: PersistedCart): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...cart, savedAt: new Date().toISOString() }),
    )
  } catch {
    return
  }
}

interface PosState {
  lines: CartLine[]
  lastSale: SaleReceipt | null
  lastSaleId: string | null
  hydrated: boolean
  hydrate: () => void
  addProduct: (product: Product, lots: LotInfo[]) => void
  incrementQty: (productId: string) => void
  decrementQty: (productId: string) => void
  removeLine: (productId: string) => void
  setLineDiscount: (productId: string, discountPct: number) => void
  clearCart: () => void
  finishSale: (receipt: SaleReceipt) => void
}

function persist(state: PosState): void {
  savePersisted({
    version: 1,
    lines: state.lines,
    lastSaleId: state.lastSaleId,
    savedAt: new Date().toISOString(),
  })
}

function toFefoLots(lots: LotInfo[]): CartLine["fefoLots"] {
  return lots
    .filter((lot) => daysUntil(lot.expiryDate) >= 0)
    .toSorted((a, b) => a.expiryDate.localeCompare(b.expiryDate))
    .map((lot) => ({
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      expiryDate: lot.expiryDate,
      availableQty: lot.currentQty,
    }))
}

export const usePosStore = create<PosState>()((set, get) => ({
  lines: [],
  lastSale: null,
  lastSaleId: null,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return
    const persisted = loadPersisted()
    set({
      hydrated: true,
      lines: persisted?.lines ?? [],
      lastSaleId: persisted?.lastSaleId ?? null,
    })
  },

  addProduct: (product, lots) => {
    const sellable = lots.filter((lot) => daysUntil(lot.expiryDate) >= 0)
    const availableQty = sellable.reduce((sum, lot) => sum + lot.currentQty, 0)
    const earliest = sellable[0]?.expiryDate ?? null
    const fefoLots = toFefoLots(lots)

    set((state) => {
      const existing = state.lines.find(
        (line) => line.productId === product.id,
      )
      if (existing) {
        const updatedLines = state.lines.map((line) => {
          if (line.productId !== product.id) return line
          return {
            ...line,
            quantity: Math.min(line.quantity + 1, availableQty),
            availableQty,
            earliestExpiry: earliest,
            expiringSoon:
              earliest !== null && daysUntil(earliest) <= EXPIRING_SOON_DAYS,
            fefoLots,
          }
        })
        return { lines: updatedLines }
      }
      const line: CartLine = {
        productId: product.id,
        barcode: product.barcode,
        commercialName: product.commercialName,
        dciName: product.dciName,
        category: product.category,
        unitPrice: product.salePrice,
        quantity: 1,
        discountPct: 0,
        availableQty,
        earliestExpiry: earliest,
        expiringSoon:
          earliest !== null && daysUntil(earliest) <= EXPIRING_SOON_DAYS,
        fefoLots,
      }
      return { lines: [...state.lines, line] }
    })
    persist(get())
  },

  incrementQty: (productId) => {
    set((state) => ({
      lines: state.lines.map((line) => {
        if (line.productId !== productId) return line
        return {
          ...line,
          quantity: Math.min(line.quantity + 1, line.availableQty),
        }
      }),
    }))
    persist(get())
  },

  decrementQty: (productId) => {
    set((state) => ({
      lines: state.lines
        .map((line) => {
          if (line.productId !== productId) return line
          return { ...line, quantity: line.quantity - 1 }
        })
        .filter((line) => line.quantity > 0),
    }))
    persist(get())
  },

  removeLine: (productId) => {
    set((state) => ({
      lines: state.lines.filter((line) => line.productId !== productId),
    }))
    persist(get())
  },

  setLineDiscount: (productId, discountPct) => {
    const clamped = Math.min(100, Math.max(0, roundMoney(discountPct)))
    set((state) => ({
      lines: state.lines.map((line) => {
        if (line.productId !== productId) return line
        return { ...line, discountPct: clamped }
      }),
    }))
    persist(get())
  },

  clearCart: () => {
    set({ lines: [] })
    persist(get())
  },

  finishSale: (receipt) => {
    set({ lines: [], lastSale: receipt, lastSaleId: receipt.id })
    persist(get())
  },
}))

export function computeCartTotals(lines: CartLine[]): {
  subtotal: number
  discount: number
  total: number
} {
  let subtotal = 0
  let discount = 0
  for (const line of lines) {
    const gross = roundMoney(line.unitPrice * line.quantity)
    subtotal = roundMoney(subtotal + gross)
    discount = roundMoney(discount + gross * (line.discountPct / 100))
  }
  const total = roundMoney(Math.max(0, subtotal - discount))
  return { subtotal, discount, total }
}
