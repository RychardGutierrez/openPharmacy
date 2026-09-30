import { Injectable } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  formatDateInZone,
  resolveDateRange,
} from '../../reports/utils/report-date.util';
import {
  DashboardExpiringResponseDto,
  DashboardLowStockResponseDto,
  DashboardRecentSalesResponseDto,
  DashboardSalesTrendResponseDto,
  DashboardUnitsSoldResponseDto,
  ExpiringLotDto,
  KpiSummaryDto,
  LowStockItemDto,
  RecentSaleDto,
} from '../dto/dashboard-response.dto';
import {
  DashboardQueryDto,
  ExpiringQueryDto,
  LowStockQueryDto,
  RecentSalesQueryDto,
  SalesTrendQueryDto,
  UnitsSoldQueryDto,
} from '../dto/dashboard-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const num = (value: unknown): number => Number(value ?? 0);

interface SalesAggregateRow {
  totalSales: Prisma.Decimal;
  transactions: bigint;
  unitsSold: bigint;
}

interface CashierAggregateRow {
  userId: string;
  fullName: string;
  transactions: bigint;
  totalSales: Prisma.Decimal;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  private resolveRange(dto: DashboardQueryDto) {
    const timezone = dto.timezone ?? 'America/La_Paz';
    const today = formatDateInZone(new Date(), timezone);

    return resolveDateRange(
      { from: dto.from ?? today, to: dto.to ?? today, timezone },
      timezone,
      366,
    );
  }

  /** Aggregate KPI summary for the selected date range. */
  async getKpis(
    dto: DashboardQueryDto,
    activeAlerts: number,
    expiringCount: number,
    lowStockCount: number,
    includeSales = true,
  ): Promise<KpiSummaryDto> {
    const { startUtc, endUtc } = this.resolveRange(dto);

    const cashierQuery: Promise<CashierAggregateRow[]> =
      includeSales && dto.groupByCashier
        ? this.prisma.$queryRaw<CashierAggregateRow[]>`
          SELECT u.id AS "userId",
                 u.full_name AS "fullName",
                 COUNT(*)::bigint AS transactions,
                 COALESCE(SUM(s.total), 0)::numeric AS "totalSales"
          FROM pharmacy.sales s
          JOIN auth.users u ON u.id = s.user_id
          WHERE s.status = ${SaleStatus.COMPLETED}::pharmacy."SaleStatus"
            AND s.created_at >= ${startUtc}
            AND s.created_at < ${endUtc}
          GROUP BY u.id, u.full_name
          ORDER BY "totalSales" DESC
        `
        : Promise.resolve([]);

    const [summary, cashierRows] = await Promise.all([
      this.prisma.$queryRaw<SalesAggregateRow[]>`
        WITH filtered_sales AS (
          SELECT id, total
          FROM pharmacy.sales
          WHERE status = ${SaleStatus.COMPLETED}::pharmacy."SaleStatus"
            AND created_at >= ${startUtc}
            AND created_at < ${endUtc}
        )
        SELECT
          (SELECT COALESCE(SUM(total), 0) FROM filtered_sales)::numeric AS "totalSales",
          (SELECT COUNT(*) FROM filtered_sales)::bigint AS transactions,
          (
            SELECT COALESCE(SUM(si.quantity), 0)
            FROM pharmacy.sale_items si
            JOIN filtered_sales fs ON fs.id = si.sale_id
          )::bigint AS "unitsSold"
      `,
      cashierQuery,
    ]);

    const row = summary[0];

    return {
      startAt: startUtc,
      endAt: endUtc,
      salesVisible: includeSales,
      totalSales: includeSales ? round2(num(row?.totalSales)) : null,
      transactions: includeSales ? Number(row?.transactions ?? 0) : null,
      unitsSold: Number(row?.unitsSold ?? 0),
      lowStockCount,
      expiringCount,
      activeAlerts,
      cashierTotals: cashierRows.map((r) => ({
        userId: r.userId,
        fullName: r.fullName,
        transactions: Number(r.transactions),
        totalSales: round2(num(r.totalSales)),
      })),
    };
  }

  async getSalesTrend(
    dto: SalesTrendQueryDto,
  ): Promise<DashboardSalesTrendResponseDto> {
    const { startUtc, endUtc } = this.resolveRange(dto);
    const interval = dto.interval ?? (dto.from === dto.to ? 'hour' : 'day');
    const timezone = dto.timezone ?? 'America/La_Paz';
    const rows = await this.prisma.$queryRaw<
      Array<{
        bucket: string;
        totalSales: Prisma.Decimal;
        transactions: bigint;
      }>
    >`
      SELECT
        TO_CHAR(
          DATE_TRUNC(${interval}, s.created_at AT TIME ZONE ${timezone}),
          ${interval === 'hour' ? 'YYYY-MM-DD HH24:00:00' : 'YYYY-MM-DD'}
        ) AS bucket,
        COALESCE(SUM(s.total), 0)::numeric AS "totalSales",
        COUNT(*)::bigint AS transactions
      FROM pharmacy.sales s
      WHERE s.status = ${SaleStatus.COMPLETED}::pharmacy."SaleStatus"
        AND s.created_at >= ${startUtc}
        AND s.created_at < ${endUtc}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    return {
      generatedAt: new Date(),
      interval,
      points: rows.map((row) => ({
        bucket: row.bucket,
        totalSales: round2(num(row.totalSales)),
        transactions: Number(row.transactions),
      })),
    };
  }

  async getUnitsSold(
    dto: UnitsSoldQueryDto,
  ): Promise<DashboardUnitsSoldResponseDto> {
    const { startUtc, endUtc } = this.resolveRange(dto);
    const rows = await this.prisma.$queryRaw<
      Array<{ productId: string; productName: string; unitsSold: bigint }>
    >`
      SELECT p.id AS "productId",
             p.commercial_name AS "productName",
             SUM(si.quantity)::bigint AS "unitsSold"
      FROM pharmacy.sale_items si
      JOIN pharmacy.sales s ON s.id = si.sale_id
      JOIN pharmacy.products p ON p.id = si.product_id
      WHERE s.status = ${SaleStatus.COMPLETED}::pharmacy."SaleStatus"
        AND s.created_at >= ${startUtc}
        AND s.created_at < ${endUtc}
      GROUP BY p.id, p.commercial_name
      ORDER BY "unitsSold" DESC, "productName" ASC
      ${dto.limit ? Prisma.sql`LIMIT ${dto.limit}` : Prisma.empty}
    `;

    return {
      generatedAt: new Date(),
      items: rows.map((row) => ({
        productId: row.productId,
        productName: row.productName,
        unitsSold: Number(row.unitsSold),
      })),
    };
  }

  /** Products whose active stock is at or below min_stock, including zero. */
  async getLowStock(
    dto: LowStockQueryDto,
  ): Promise<DashboardLowStockResponseDto> {
    const search = dto.q?.trim().toLowerCase();

    const rows = await this.prisma.$queryRaw<
      Array<{
        productId: string;
        commercialName: string;
        dciName: string;
        category: string;
        minStock: number;
        currentStock: Prisma.Decimal;
      }>
    >`
      SELECT
        p.id AS "productId",
        p.commercial_name AS "commercialName",
        p.dci_name AS "dciName",
        p.category::text AS "category",
        p.min_stock AS "minStock",
        COALESCE(SUM(l.current_qty), 0)::numeric AS "currentStock"
      FROM pharmacy.products p
      LEFT JOIN pharmacy.lots l
        ON l.product_id = p.id
        AND l.voided_at IS NULL
      WHERE p.deleted_at IS NULL
        AND p.active = true
        ${
          search
            ? Prisma.sql`AND (LOWER(p.commercial_name) LIKE ${`%${search}%`} OR LOWER(p.dci_name) LIKE ${`%${search}%`})`
            : Prisma.empty
        }
      GROUP BY p.id, p.commercial_name, p.dci_name, p.category, p.min_stock
      HAVING COALESCE(SUM(l.current_qty), 0) <= p.min_stock
         ORDER BY (p.min_stock - COALESCE(SUM(l.current_qty), 0)) DESC
         ${dto.limit ? Prisma.sql`LIMIT ${dto.limit}` : Prisma.empty}
    `;

    return {
      generatedAt: new Date(),
      items: rows.map(
        (r): LowStockItemDto => ({
          productId: r.productId,
          commercialName: r.commercialName,
          dciName: r.dciName,
          category: r.category,
          minStock: r.minStock,
          currentStock: round2(num(r.currentStock)),
          deficit: Math.max(0, r.minStock - round2(num(r.currentStock))),
        }),
      ),
    };
  }

  /** Lots expiring within the selected horizon. */
  async getExpiring(
    dto: ExpiringQueryDto,
  ): Promise<DashboardExpiringResponseDto> {
    const horizonDays = dto.horizonDays ?? 30;
    const horizonEnd = new Date(Date.now() + horizonDays * DAY_MS);

    const rows = await this.prisma.$queryRaw<
      Array<{
        lotId: string;
        productId: string;
        productName: string;
        lotNumber: string;
        expiryDate: Date;
        currentQty: number;
      }>
    >`
      SELECT
        l.id AS "lotId",
        p.id AS "productId",
        p.commercial_name AS "productName",
        l.lot_number AS "lotNumber",
        l.expiry_date AS "expiryDate",
        l.current_qty AS "currentQty"
      FROM pharmacy.lots l
      JOIN pharmacy.products p ON p.id = l.product_id
      WHERE l.voided_at IS NULL
        AND l.current_qty > 0
        AND l.expiry_date <= ${horizonEnd}
       ORDER BY l.expiry_date ASC
       ${dto.limit ? Prisma.sql`LIMIT ${dto.limit}` : Prisma.empty}
    `;

    return {
      generatedAt: new Date(),
      lots: rows.map((r): ExpiringLotDto => {
        const days = Math.ceil(
          (new Date(r.expiryDate).getTime() - Date.now()) / DAY_MS,
        );
        return {
          lotId: r.lotId,
          productId: r.productId,
          productName: r.productName,
          lotNumber: r.lotNumber,
          expiryDate: r.expiryDate,
          currentQty: r.currentQty,
          daysUntilExpiry: days,
          status: classifyExpiry(days),
        };
      }),
    };
  }

  /** Most recent completed sales in the selected range. */
  async getRecentSales(
    dto: RecentSalesQueryDto,
  ): Promise<DashboardRecentSalesResponseDto> {
    const { startUtc, endUtc } = this.resolveRange(dto);
    const limit = Math.min(Math.max(dto.limit ?? 10, 1), 50);

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        receiptNumber: string;
        createdAt: Date;
        cashier: string;
        paymentMethod: string;
        itemCount: bigint;
        total: Prisma.Decimal;
      }>
    >`
      SELECT
        s.id,
        s.receipt_number AS "receiptNumber",
        s.created_at AS "createdAt",
        u.full_name AS cashier,
        s.payment_method::text AS "paymentMethod",
        COALESCE((
          SELECT SUM(si.quantity)
          FROM pharmacy.sale_items si
          WHERE si.sale_id = s.id
        ), 0)::bigint AS "itemCount",
        s.total
      FROM pharmacy.sales s
      JOIN auth.users u ON u.id = s.user_id
      WHERE s.status = ${SaleStatus.COMPLETED}::pharmacy."SaleStatus"
        AND s.created_at >= ${startUtc}
        AND s.created_at < ${endUtc}
      ORDER BY s.created_at DESC
      LIMIT ${limit}
    `;

    return {
      generatedAt: new Date(),
      sales: rows.map(
        (r): RecentSaleDto => ({
          id: r.id,
          receiptNumber: r.receiptNumber,
          createdAt: r.createdAt,
          cashier: r.cashier,
          paymentMethod: r.paymentMethod,
          itemCount: Number(r.itemCount),
          total: round2(num(r.total)),
        }),
      ),
    };
  }
}

function classifyExpiry(daysUntilExpiry: number): 'RED' | 'ORANGE' | 'GREEN' {
  if (daysUntilExpiry < 0) return 'RED';
  if (daysUntilExpiry <= 30) return 'RED';
  if (daysUntilExpiry <= 90) return 'ORANGE';
  return 'GREEN';
}
