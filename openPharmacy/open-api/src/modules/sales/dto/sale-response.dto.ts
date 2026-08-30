import { PaymentMethod, SaleStatus } from '@prisma/client';

export interface SaleReceiptItemDto {
  id: string;
  productId: string;
  productName: string;
  lotId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SaleResponseDto {
  id: string;
  receiptNumber: string;
  shiftId: string;
  userId: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived: number;
  changeGiven: number;
  status: SaleStatus;
  createdAt: Date;
  pharmacy: Record<string, string>;
  items: SaleReceiptItemDto[];
}
