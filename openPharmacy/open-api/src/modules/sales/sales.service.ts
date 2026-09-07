import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, ProductCategory, Sale } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { ShiftsService } from '../shifts/shifts.service';
import { FefoService } from '../lots/fefo.service';
import { ConfigService } from '../config/config.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SaleResponseDto } from './dto/sale-response.dto';
import { SalesRepository } from './repositories/sales.repository';
import { EmptyCartException } from './exceptions/empty-cart.exception';
import { ProductInactiveException } from './exceptions/product-inactive.exception';
import { CashShortException } from './exceptions/cash-short.exception';

const money = (value: number) => Math.round(value * 100) / 100;
const rxCategories = new Set<ProductCategory>([
  ProductCategory.PRESCRIPTION_ONLY,
  ProductCategory.PSYCHOTROPIC,
  ProductCategory.NARCOTIC,
]);

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftsService: ShiftsService,
    private readonly fefoService: FefoService,
    private readonly sales: SalesRepository,
    private readonly audit: AuditLogRepository,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateSaleDto): Promise<SaleResponseDto> {
    if (!dto.items?.length) throw new EmptyCartException();
    const activeShift = await this.shiftsService.validateActiveShift(userId);
    const result = await this.prisma.$transaction(
      async (tx) => {
        const shift = await tx.shift.findUnique({
          where: { id: dto.shiftId ?? activeShift.id },
        });
        if (!shift || shift.user_id !== userId || shift.status !== 'OPEN') {
          throw new ConflictException(
            'An open shift belonging to the current user is required',
          );
        }

        const productIds = [
          ...new Set(dto.items.map((item) => item.productId)),
        ];
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, deleted_at: null },
        });
        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );
        for (const item of dto.items) {
          const product = productMap.get(item.productId);
          if (!product || !product.active)
            throw new ProductInactiveException(item.productId);
        }

        const lines: Array<{
          productId: string;
          productName: string;
          lotId: string;
          lotNumber: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
        }> = [];
        let subtotal = 0;
        for (const item of dto.items) {
          const product = productMap.get(item.productId)!;
          const unitPrice = Number(product.sale_price);
          const deduction = await this.fefoService.deductStockInTx(
            tx,
            item.productId,
            item.quantity,
            userId,
          );
          for (const lot of deduction.lotsUsed) {
            const lineTotal = money(lot.deductedQty * unitPrice);
            lines.push({
              productId: item.productId,
              productName: product.commercial_name,
              lotId: lot.lotId,
              lotNumber: lot.lotNumber,
              quantity: lot.deductedQty,
              unitPrice,
              lineTotal,
            });
            subtotal = money(subtotal + lineTotal);
          }
        }

        const discount = money(dto.discount ?? 0);
        if (discount > subtotal) {
          throw new BadRequestException({
            statusCode: 400,
            code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
            message: 'Discount cannot exceed the sale subtotal',
          });
        }
        const total = money(subtotal - discount);
        const cashReceived = money(dto.cashReceived ?? 0);
        if (dto.paymentMethod === 'CASH' && cashReceived < total)
          throw new CashShortException();
        let secondaryMethod: Sale['secondary_method'] = null;
        if (dto.paymentMethod === 'MIXED') {
          if (total <= 0 || cashReceived <= 0 || cashReceived >= total) {
            throw new BadRequestException({
              statusCode: 400,
              code: 'INVALID_MIXED_SPLIT',
              message:
                'Mixed payment requires 0 < cashReceived < total; the remainder is charged to the secondary method',
            });
          }
          secondaryMethod = dto.secondaryMethod ?? 'CARD';
        }
        const changeGiven =
          dto.paymentMethod === 'CASH' ? money(cashReceived - total) : 0;
        const receiptNumber = await this.sales.nextReceiptNumberTx(tx);
        const sale = await this.sales.createTx(tx, {
          shift_id: shift.id,
          user_id: userId,
          receipt_number: receiptNumber,
          subtotal,
          discount,
          total,
          paymentMethod: dto.paymentMethod,
          secondary_method: secondaryMethod,
          cash_received: cashReceived,
          change_given: changeGiven,
          status: 'COMPLETED',
        });
        for (const line of lines) {
          await this.sales.createItemTx(tx, {
            sale_id: sale.id,
            product_id: line.productId,
            lot_id: line.lotId,
            quantity: line.quantity,
            unit_price: line.unitPrice,
            line_total: line.lineTotal,
          });
        }

        const missingRx = dto.items
          .filter((item) =>
            rxCategories.has(productMap.get(item.productId)!.category),
          )
          .filter(
            (item) => !dto.prescriptionProductIds?.includes(item.productId),
          )
          .map((item) => item.productId);
        await this.audit.createInTx(tx, {
          userId,
          event: 'SALE_COMPLETED',
          metadata: {
            saleId: sale.id,
            receiptNumber,
            total,
            itemCount: dto.items.length,
          },
        });
        if (missingRx.length) {
          await this.audit.createInTx(tx, {
            userId,
            event: 'SALE_RX_MISSING',
            metadata: { saleId: sale.id, productIds: missingRx },
          });
        }
        return { sale, lines };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const pharmacy = await this.config.getPharmacyInfo();
    const response = this.toResponse(result.sale, result.lines, pharmacy);
    void this.events.emitAsync('sale.created', {
      saleId: response.id,
      receiptNumber: response.receiptNumber,
      total: response.total,
      paymentMethod: response.paymentMethod,
      createdAt: response.createdAt,
    });
    return response;
  }

  async findAll() {
    const [data, total] = await this.sales.findAll(1, 20);
    return {
      data: await Promise.all(data.map((sale) => this.findOne(sale.id))),
      total,
      page: 1,
      pageSize: 20,
      totalPages: Math.ceil(total / 20),
    };
  }

  async findOne(id: string): Promise<SaleResponseDto> {
    const sale = await this.sales.findOne(id);
    if (!sale) throw new NotFoundException('Sale not found');
    return this.toResponse(
      sale,
      sale.saleItems.map((item) => ({
        productId: item.product_id,
        productName: item.product.commercial_name,
        lotId: item.lot_id,
        lotNumber: item.lot.lot_number,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total),
      })),
      await this.config.getPharmacyInfo(),
    );
  }

  private toResponse(
    sale: Sale,
    lines: Array<{
      productId: string;
      productName: string;
      lotId: string;
      lotNumber: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>,
    pharmacy: Record<string, string>,
  ): SaleResponseDto {
    return {
      id: sale.id,
      receiptNumber: sale.receipt_number,
      shiftId: sale.shift_id,
      userId: sale.user_id,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      total: Number(sale.total),
      paymentMethod: sale.paymentMethod,
      secondaryMethod: sale.secondary_method,
      cashReceived: Number(sale.cash_received),
      changeGiven: Number(sale.change_given),
      status: sale.status,
      createdAt: sale.created_at,
      pharmacy,
      items: lines.map((line, index) => ({
        id: `${sale.id}-${index}`,
        ...line,
      })),
    };
  }
}
