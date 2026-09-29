import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ReportType, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ReportColumn,
  ReportFilters,
  ReportRow,
  ReportTable,
  ResolvedDateRange,
} from '../types';
import { ReportGroupBy } from '../dto/preview-report.dto';
import { formatDateInZone, formatInZone } from '../utils/report-date.util';
import {
  expiryStatusFor,
  labelExpiryStatus,
  labelMovementType,
  labelPaymentMethod,
  labelProductCategory,
  labelPurchaseOrderStatus,
  labelReturnSource,
} from '../utils/report-labels.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const num = (value: unknown): number => Number(value ?? 0);

interface SalesSummaryRow {
  day: Date;
  transactions: bigint;
  revenue: Prisma.Decimal;
  discounts: Prisma.Decimal;
  net: Prisma.Decimal;
}

/**
 * Read-only reporting queries. Every method returns a `ReportTable` (columns +
 * rows + totals) so the Excel and PDF generators stay generic and adding a
 * report type never touches the export layer.
 *
 * Design note (issue #42): these are pure `SELECT`s with a half-open UTC date
 * filter. They never take row locks and reuse the existing `sales_created_at`,
 * `inventory_movements_created_at`(via idx) and lot indexes, so POS traffic is
 * unaffected. Aggregation is pushed down to PostgreSQL to avoid shipping full
 * result sets to the Node process.
 */
@Injectable()
export class ReportDataRepository {
  constructor(private readonly prisma: PrismaService) {}

  async run(
    reportType: ReportType,
    filters: ReportFilters,
    range: ResolvedDateRange,
  ): Promise<ReportTable> {
    switch (reportType) {
      case ReportType.SALES_SUMMARY:
        return this.applyGrouping(
          await this.salesSummary(range, filters),
          filters,
        );
      case ReportType.SALES_DETAIL:
        return this.applyGrouping(
          await this.salesDetail(range, filters),
          filters,
        );
      case ReportType.INVENTORY_MOVEMENTS:
        return this.inventoryMovements(range, filters);
      case ReportType.STOCK_SNAPSHOT:
        return this.stockSnapshot(filters);
      case ReportType.EXPIRY:
        return this.expiry(filters);
      case ReportType.PURCHASES:
        return this.purchases(range, filters);
      case ReportType.RETURNS:
        return this.returns(range, filters);
      default:
        throw new BadRequestException(
          `Unsupported report type: ${String(reportType)}`,
        );
    }
  }

  private applyGrouping(
    table: ReportTable,
    filters: ReportFilters,
  ): ReportTable {
    if (!filters.groupBy || !table.rows.length) return table;
    const byProduct = filters.groupBy === ReportGroupBy.PRODUCT;
    const key = byProduct ? 'product' : 'cashier';
    const label = byProduct ? 'Ranking de productos' : 'Rendimiento por cajero';
    const groups = new Map<
      string,
      { transactions: number; quantity: number; total: number }
    >();
    for (const row of table.rows) {
      const raw = row[key];
      const name =
        typeof raw === 'string'
          ? raw
          : typeof raw === 'number'
            ? String(raw)
            : 'Desconocido';
      const current = groups.get(name) ?? {
        transactions: 0,
        quantity: 0,
        total: 0,
      };
      current.transactions += 1;
      current.quantity += Number(row.quantity ?? 0);
      current.total += Number(row.lineTotal ?? row.net ?? 0);
      groups.set(name, current);
    }
    const rows = [...groups.entries()]
      .map(([name, value]) => ({
        [key]: name,
        transactions: value.transactions,
        quantity: value.quantity,
        total: round2(value.total),
      }))
      .sort((a, b) => Number(b.total) - Number(a.total));
    return {
      title: label,
      subtitle: 'Vista agregada del reporte',
      columns: [
        { key, label: byProduct ? 'Producto' : 'Cajero' },
        { key: 'transactions', label: 'Transacciones', format: 'number' },
        { key: 'quantity', label: 'Cantidad', format: 'number' },
        { key: 'total', label: 'Total', format: 'money' },
      ],
      rows,
      totals: [
        {
          label: 'Total',
          value: round2(rows.reduce((sum, row) => sum + Number(row.total), 0)),
        },
      ],
    };
  }

  /** Lightweight row estimate used to decide sync vs queued and to enforce maxRows. */
  async estimateRows(
    reportType: ReportType,
    range: ResolvedDateRange,
    filters: ReportFilters,
  ): Promise<number> {
    const { startUtc, endUtc } = range;
    const created: Prisma.DateTimeFilter = { gte: startUtc, lt: endUtc };

    switch (reportType) {
      case ReportType.SALES_SUMMARY:
        return this.prisma.sale.count({
          where: { status: SaleStatus.COMPLETED, created_at: created },
        });
      case ReportType.SALES_DETAIL:
        return this.prisma.saleItem.count({
          where: {
            sale: { status: SaleStatus.COMPLETED, created_at: created },
            ...(filters.productId ? { product_id: filters.productId } : {}),
            ...(filters.category
              ? { product: { category: filters.category } }
              : {}),
          },
        });
      case ReportType.INVENTORY_MOVEMENTS:
        return this.prisma.inventoryMovement.count({
          where: this.movementWhere(range, filters),
        });
      case ReportType.STOCK_SNAPSHOT:
        return this.prisma.lot.count({ where: { voided_at: null } });
      case ReportType.EXPIRY:
        return this.prisma.lot.count({
          where: {
            voided_at: null,
            current_qty: { gt: 0 },
            expiry_date: { lte: this.expiryHorizonEnd(filters) },
          },
        });
      case ReportType.PURCHASES:
        return this.prisma.purchaseOrder.count({
          where: { created_at: created },
        });
      case ReportType.RETURNS:
        return this.prisma.return.count({ where: { created_at: created } });
      default:
        return 0;
    }
  }

  // ─── Sales ─────────────────────────────────────────────────────────────────

  private async salesSummary(
    range: ResolvedDateRange,
    filters: ReportFilters,
  ): Promise<ReportTable> {
    const rows = await this.prisma.$queryRaw<SalesSummaryRow[]>`
      SELECT date_trunc('day', s.created_at AT TIME ZONE ${range.timezone}::text) AS day,
             COUNT(*)::bigint AS transactions,
             COALESCE(SUM(s.subtotal), 0)::numeric AS revenue,
             COALESCE(SUM(s.discount), 0)::numeric AS discounts,
             COALESCE(SUM(s.total), 0)::numeric AS net
      FROM pharmacy.sales s
      WHERE s.status = 'COMPLETED'::pharmacy."SaleStatus"
        AND s.created_at >= ${range.startUtc}
        AND s.created_at < ${range.endUtc}
        AND (
          ${filters.category ?? null}::text IS NULL OR EXISTS (
            SELECT 1
            FROM pharmacy.sale_items si
            JOIN pharmacy.products p ON p.id = si.product_id
            WHERE si.sale_id = s.id
              AND p.category = ${filters.category ?? null}::pharmacy."ProductCategory"
          )
        )
      GROUP BY 1
      ORDER BY 1
    `;
    const columns: ReportColumn[] = [
      { key: 'day', label: 'Fecha', format: 'date' },
      { key: 'transactions', label: 'Transacciones', format: 'number' },
      { key: 'revenue', label: 'Ingresos brutos', format: 'money' },
      { key: 'discounts', label: 'Descuentos', format: 'money' },
      { key: 'net', label: 'Total neto', format: 'money' },
    ];

    const data: ReportRow[] = rows.map((r) => ({
      day: formatDateInZone(new Date(r.day), range.timezone),
      transactions: Number(r.transactions),
      revenue: round2(num(r.revenue)),
      discounts: round2(num(r.discounts)),
      net: round2(num(r.net)),
    }));

    return {
      title: 'Resumen de ventas',
      subtitle:
        'Ventas completadas agrupadas por día (zona horaria del reporte)',
      columns,
      rows: data,
      totals: [
        {
          label: 'Total de transacciones',
          value: data.reduce((acc, r) => acc + Number(r.transactions), 0),
        },
        {
          label: 'Ingresos netos totales',
          value: round2(data.reduce((acc, r) => acc + Number(r.net), 0)),
        },
      ],
    };
  }

  private async salesDetail(
    range: ResolvedDateRange,
    filters: ReportFilters,
  ): Promise<ReportTable> {
    const items = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          status: SaleStatus.COMPLETED,
          created_at: { gte: range.startUtc, lt: range.endUtc },
          ...(filters.userId ? { user_id: filters.userId } : {}),
        },
        ...(filters.productId ? { product_id: filters.productId } : {}),
        ...(filters.category
          ? { product: { category: filters.category } }
          : {}),
      },
      orderBy: { sale: { created_at: 'asc' } },
      include: {
        product: { select: { commercial_name: true } },
        lot: { select: { lot_number: true } },
        sale: {
          select: {
            receipt_number: true,
            created_at: true,
            paymentMethod: true,
            user: { select: { full_name: true } },
          },
        },
      },
    });

    const rows: ReportRow[] = items.map((item) => ({
      date: formatInZone(new Date(item.sale.created_at), range.timezone),
      receipt: item.sale.receipt_number,
      cashier: item.sale.user.full_name,
      paymentMethod: labelPaymentMethod(item.sale.paymentMethod),
      product: item.product.commercial_name,
      lot: item.lot.lot_number,
      quantity: item.quantity,
      unitPrice: round2(num(item.unit_price)),
      lineTotal: round2(num(item.line_total)),
    }));

    return {
      title: 'Detalle de ventas',
      subtitle: 'Una fila por línea de venta',
      columns: [
        { key: 'date', label: 'Fecha y hora', format: 'datetime' },
        { key: 'receipt', label: 'Recibo' },
        { key: 'cashier', label: 'Cajero' },
        { key: 'paymentMethod', label: 'Pago' },
        { key: 'product', label: 'Producto' },
        { key: 'lot', label: 'Lote' },
        { key: 'quantity', label: 'Cant.', format: 'number' },
        { key: 'unitPrice', label: 'Precio unitario', format: 'money' },
        { key: 'lineTotal', label: 'Total línea', format: 'money' },
      ],
      rows,
      totals: [
        {
          label: 'Ingresos totales',
          value: round2(rows.reduce((acc, r) => acc + Number(r.lineTotal), 0)),
        },
      ],
    };
  }

  // ─── Inventory ─────────────────────────────────────────────────────────────

  private movementWhere(
    range: ResolvedDateRange,
    filters: ReportFilters,
  ): Prisma.InventoryMovementWhereInput {
    const where: Prisma.InventoryMovementWhereInput = {
      created_at: { gte: range.startUtc, lt: range.endUtc },
    };
    if (filters.productId) where.product_id = filters.productId;
    if (filters.lotId) where.lot_id = filters.lotId;
    if (filters.userId) where.user_id = filters.userId;
    if (filters.category) where.product = { category: filters.category };
    if (filters.movementType) {
      where.movementType = filters.movementType;
    }
    return where;
  }

  private async inventoryMovements(
    range: ResolvedDateRange,
    filters: ReportFilters,
  ): Promise<ReportTable> {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: this.movementWhere(range, filters),
      orderBy: { created_at: 'asc' },
      include: {
        product: { select: { commercial_name: true } },
        lot: { select: { lot_number: true } },
        user: { select: { full_name: true } },
      },
    });

    return {
      title: 'Movimientos de inventario',
      subtitle:
        'Libro mayor de inventario (compras, ventas, devoluciones, ajustes)',
      columns: [
        { key: 'date', label: 'Fecha y hora', format: 'datetime' },
        { key: 'movementType', label: 'Tipo' },
        { key: 'product', label: 'Producto' },
        { key: 'lot', label: 'Lote' },
        { key: 'quantity', label: 'Cant.', format: 'number' },
        { key: 'user', label: 'Usuario' },
        { key: 'reason', label: 'Motivo' },
      ],
      rows: movements.map((m) => ({
        date: formatInZone(new Date(m.created_at), range.timezone),
        movementType: labelMovementType(m.movementType),
        product: m.product.commercial_name,
        lot: m.lot.lot_number,
        quantity: m.quantity,
        user: m.user.full_name,
        reason: m.reason ?? '',
      })),
    };
  }

  private async stockSnapshot(filters: ReportFilters): Promise<ReportTable> {
    const lots = await this.prisma.lot.findMany({
      where: {
        voided_at: null,
        ...(filters.productId ? { product_id: filters.productId } : {}),
        ...(filters.lotId ? { id: filters.lotId } : {}),
        ...(filters.category
          ? { product: { category: filters.category } }
          : {}),
      },
      orderBy: { product: { commercial_name: 'asc' } },
      include: {
        product: { select: { commercial_name: true, category: true } },
      },
    });

    let valuation = 0;
    let units = 0;
    const rows: ReportRow[] = lots.map((lot) => {
      const value = round2(lot.current_qty * num(lot.unit_cost));
      valuation += value;
      units += lot.current_qty;
      return {
        product: lot.product.commercial_name,
        category: labelProductCategory(lot.product.category),
        lot: lot.lot_number,
        expiryDate: formatDateInZone(
          new Date(lot.expiry_date),
          filters.timezone ?? 'UTC',
        ),
        quantity: lot.current_qty,
        unitCost: round2(num(lot.unit_cost)),
        valuation: value,
      };
    });

    return {
      title: 'Inventario actual',
      subtitle: 'Existencias actuales por lote con valorización',
      columns: [
        { key: 'product', label: 'Producto' },
        { key: 'category', label: 'Categoría' },
        { key: 'lot', label: 'Lote' },
        { key: 'expiryDate', label: 'Vencimiento', format: 'date' },
        { key: 'quantity', label: 'Cant.', format: 'number' },
        { key: 'unitCost', label: 'Costo unitario', format: 'money' },
        { key: 'valuation', label: 'Valorización', format: 'money' },
      ],
      rows,
      totals: [
        { label: 'Unidades totales', value: units },
        { label: 'Valorización total', value: round2(valuation) },
      ],
    };
  }

  private expiryHorizonEnd(filters: ReportFilters): Date {
    const horizon = filters.horizonDays ?? 90;
    return new Date(Date.now() + horizon * DAY_MS);
  }

  private async expiry(filters: ReportFilters): Promise<ReportTable> {
    const horizonEnd = this.expiryHorizonEnd(filters);
    const lots = await this.prisma.lot.findMany({
      where: {
        voided_at: null,
        current_qty: { gt: 0 },
        expiry_date: { lte: horizonEnd },
        ...(filters.productId ? { product_id: filters.productId } : {}),
        ...(filters.category
          ? { product: { category: filters.category } }
          : {}),
      },
      orderBy: { expiry_date: 'asc' },
      include: { product: { select: { commercial_name: true } } },
    });

    const tz = filters.timezone ?? 'UTC';
    let totalValue = 0;
    const rows: ReportRow[] = lots.map((lot) => {
      const days = Math.ceil(
        (new Date(lot.expiry_date).getTime() - Date.now()) / DAY_MS,
      );
      const value = round2(lot.current_qty * num(lot.unit_cost));
      totalValue += value;
      return {
        product: lot.product.commercial_name,
        lot: lot.lot_number,
        expiryDate: formatDateInZone(new Date(lot.expiry_date), tz),
        daysUntilExpiry: days,
        status: labelExpiryStatus(expiryStatusFor(days)),
        quantity: lot.current_qty,
        valuation: value,
      };
    });

    return {
      title: 'Reporte de vencimientos',
      subtitle: `Lotes activos que vencen dentro de ${filters.horizonDays ?? 90} días`,
      columns: [
        { key: 'product', label: 'Producto' },
        { key: 'lot', label: 'Lote' },
        { key: 'expiryDate', label: 'Vencimiento', format: 'date' },
        { key: 'daysUntilExpiry', label: 'Días restantes', format: 'number' },
        { key: 'status', label: 'Estado' },
        { key: 'quantity', label: 'Cant.', format: 'number' },
        { key: 'valuation', label: 'Valorización', format: 'money' },
      ],
      rows,
      totals: [{ label: 'Valor en riesgo', value: round2(totalValue) }],
    };
  }

  // ─── Purchasing ────────────────────────────────────────────────────────────

  private async purchases(
    range: ResolvedDateRange,
    filters: ReportFilters,
  ): Promise<ReportTable> {
    const orders = await this.prisma.purchaseOrder.findMany({
      where: {
        created_at: { gte: range.startUtc, lt: range.endUtc },
        ...(filters.supplierId ? { supplier_id: filters.supplierId } : {}),
        ...(filters.category
          ? {
              orderItems: { some: { product: { category: filters.category } } },
            }
          : {}),
      },
      orderBy: { created_at: 'asc' },
      include: {
        supplier: { select: { name: true, nit: true } },
        user: { select: { full_name: true } },
        orderItems: { select: { qty_ordered: true, unit_cost: true } },
      },
    });

    let totalValue = 0;
    const rows: ReportRow[] = orders.map((order) => {
      const orderedValue = round2(
        order.orderItems.reduce(
          (acc, item) => acc + item.qty_ordered * num(item.unit_cost),
          0,
        ),
      );
      const orderedQty = order.orderItems.reduce(
        (acc, item) => acc + item.qty_ordered,
        0,
      );
      totalValue += orderedValue;
      return {
        date: formatDateInZone(new Date(order.created_at), range.timezone),
        order: order.id.slice(0, 8),
        supplier: order.supplier.name,
        requestedBy: order.user.full_name,
        status: labelPurchaseOrderStatus(order.status),
        lines: order.orderItems.length,
        orderedQty,
        orderedValue,
      };
    });

    return {
      title: 'Compras',
      subtitle: 'Órdenes de compra y avance de recepción',
      columns: [
        { key: 'date', label: 'Fecha', format: 'date' },
        { key: 'order', label: 'Orden' },
        { key: 'supplier', label: 'Proveedor' },
        { key: 'requestedBy', label: 'Solicitado por' },
        { key: 'status', label: 'Estado' },
        { key: 'lines', label: 'Líneas', format: 'number' },
        { key: 'orderedQty', label: 'Cant. ordenada', format: 'number' },
        { key: 'orderedValue', label: 'Valor ordenado', format: 'money' },
      ],
      rows,
      totals: [{ label: 'Valor total ordenado', value: round2(totalValue) }],
    };
  }

  // ─── Returns & cancellations ─────────────────────────────────────────────

  private async returns(
    range: ResolvedDateRange,
    filters: ReportFilters,
  ): Promise<ReportTable> {
    const returns = await this.prisma.return.findMany({
      where: {
        created_at: { gte: range.startUtc, lt: range.endUtc },
        ...(filters.userId ? { user_id: filters.userId } : {}),
      },
      orderBy: { created_at: 'asc' },
      include: {
        user: { select: { full_name: true } },
        sale: { select: { receipt_number: true } },
        returnItems: { select: { quantity: true } },
      },
    });

    const rows: ReportRow[] = returns.map((ret) => ({
      date: formatInZone(new Date(ret.created_at), range.timezone),
      source: labelReturnSource(ret.source),
      receipt: ret.sale.receipt_number,
      user: ret.user.full_name,
      reason: ret.reason,
      lineCount: ret.returnItems.length,
      totalQty: ret.returnItems.reduce((acc, item) => acc + item.quantity, 0),
    }));

    return {
      title: 'Devoluciones y anulaciones',
      subtitle: 'Devoluciones y anulaciones del período',
      columns: [
        { key: 'date', label: 'Fecha y hora', format: 'datetime' },
        { key: 'source', label: 'Origen' },
        { key: 'receipt', label: 'Recibo' },
        { key: 'user', label: 'Usuario' },
        { key: 'reason', label: 'Motivo' },
        { key: 'lineCount', label: 'Líneas', format: 'number' },
        { key: 'totalQty', label: 'Cant.', format: 'number' },
      ],
      rows,
      totals: [
        { label: 'Total de eventos', value: rows.length },
        {
          label: 'Unidades devueltas totales',
          value: rows.reduce((acc, r) => acc + Number(r.totalQty), 0),
        },
      ],
    };
  }
}
