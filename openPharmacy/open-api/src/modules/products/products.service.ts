import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { parse } from 'csv-parse/sync';
import { Prisma, Product } from '@prisma/client';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import {
  BulkImportResponseDto,
  BulkImportRowDto,
} from './dto/bulk-import-response.dto';
import { PaginatedResponseDto } from '../users/dto/paginated-response.dto';
import { DuplicateBarcodeException } from './exceptions/duplicate-barcode.exception';
import { ProductNotFoundException } from './exceptions/product-not-found.exception';
import { ProductsRepository } from './repositories/products.repository';
import { RequestMetadata } from '../users/users.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly products: ProductsRepository,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly audit: AuditLogRepository,
  ) {}

  async create(
    dto: CreateProductDto,
    meta?: RequestMetadata,
  ): Promise<ProductResponseDto> {
    await this.validateUniqueBarcode(dto.barcode);

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await this.products.createTx(tx, this.toCreateInput(dto));

      await this.audit.createInTx(tx, {
        userId: null,
        event: 'PRODUCT_CREATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { productId: created.id, barcode: created.barcode },
      });

      return created;
    });

    this.emitProductCreated(product);
    return this.toResponse(product);
  }

  async findAll(
    query: ProductQueryDto,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    const { data, total, page, pageSize, totalPages } =
      await this.products.findAllPaginated({
        page: query.page,
        pageSize: query.pageSize,
        category: query.category,
        active: query.active,
        q: query.q,
      });

    return {
      data: data.map((product) => this.toResponse(product)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async searchAutocomplete(
    q: string,
    limit = 10,
  ): Promise<ProductResponseDto[]> {
    const products = await this.products.searchAutocomplete(q, limit);
    return products.map((product) => this.toResponse(product));
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.products.findByIdIncludingDeleted(id);
    if (!product) {
      throw new ProductNotFoundException(id);
    }
    return this.toResponse(product);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    meta?: RequestMetadata,
  ): Promise<ProductResponseDto> {
    const existing = await this.products.findByIdIncludingDeleted(id);
    if (!existing) {
      throw new ProductNotFoundException(id);
    }

    if (dto.barcode && dto.barcode !== existing.barcode) {
      await this.validateUniqueBarcode(dto.barcode, id);
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const updated = await this.products.updateTx(
        tx,
        id,
        this.toUpdateInput(dto),
      );

      await this.audit.createInTx(tx, {
        userId: null,
        event: 'PRODUCT_UPDATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: {
          productId: updated.id,
          changedFields: Object.keys(dto),
        },
      });

      return updated;
    });

    return this.toResponse(product);
  }

  async deactivate(
    id: string,
    meta?: RequestMetadata,
  ): Promise<ProductResponseDto> {
    const existing = await this.products.findByIdIncludingDeleted(id);
    if (!existing) {
      throw new ProductNotFoundException(id);
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const deactivated = await this.products.softDeleteTx(tx, id, new Date());

      await this.audit.createInTx(tx, {
        userId: null,
        event: 'PRODUCT_DEACTIVATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { productId: deactivated.id },
      });

      return deactivated;
    });

    return this.toResponse(product);
  }

  async activate(
    id: string,
    meta?: RequestMetadata,
  ): Promise<ProductResponseDto> {
    const existing = await this.products.findByIdIncludingDeleted(id);
    if (!existing) {
      throw new ProductNotFoundException(id);
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const activated = await this.products.restoreTx(tx, id);

      await this.audit.createInTx(tx, {
        userId: null,
        event: 'PRODUCT_ACTIVATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { productId: activated.id },
      });

      return activated;
    });

    return this.toResponse(product);
  }

  async bulkImport(
    file: Express.Multer.File,
    meta?: RequestMetadata,
  ): Promise<BulkImportResponseDto> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'CSV_EMPTY',
        message: 'CSV file is empty or missing',
      });
    }

    let rawRows: Record<string, unknown>[];
    try {
      rawRows = parse(file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch (error: unknown) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'CSV_INVALID',
        message: error instanceof Error ? error.message : 'Invalid CSV file',
      });
    }

    const response: BulkImportResponseDto = { inserted: 0, failed: [] };

    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2; // 1 header + 0-indexed data
      const row = this.normalizeBulkRow(rawRows[i]);
      const rowDto = plainToInstance(BulkImportRowDto, row);
      const rowErrors = await validate(rowDto);

      if (rowErrors.length > 0) {
        response.failed.push({
          row: rowNumber,
          barcode: String(rowDto.barcode ?? row['barcode'] ?? ''),
          errors: rowErrors.flatMap((e) => Object.values(e.constraints ?? {})),
        });
        continue;
      }

      try {
        const product = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.product.findUnique({
            where: { barcode: rowDto.barcode },
          });
          if (existing) {
            throw new DuplicateBarcodeException(rowDto.barcode);
          }

          const created = await this.products.createTx(
            tx,
            this.toCreateInput(rowDto),
          );

          await this.audit.createInTx(tx, {
            userId: null,
            event: 'PRODUCT_CREATED',
            ip: meta?.ip ?? null,
            userAgent: meta?.userAgent ?? null,
            metadata: {
              productId: created.id,
              barcode: created.barcode,
              source: 'bulk_import',
            },
          });

          return created;
        });

        response.inserted++;
        this.emitProductCreated(product);
      } catch (error: unknown) {
        const message =
          error instanceof DuplicateBarcodeException
            ? `Duplicate barcode: ${rowDto.barcode}`
            : error instanceof Error
              ? error.message
              : 'Unknown error';

        response.failed.push({
          row: rowNumber,
          barcode: rowDto.barcode,
          errors: [message],
        });
      }
    }

    await this.audit.create({
      userId: null,
      event: 'PRODUCT_BULK_IMPORTED',
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
      metadata: {
        fileName: file.originalname,
        totalRows: rawRows.length,
        inserted: response.inserted,
        failed: response.failed.length,
      },
    });

    return response;
  }

  private async validateUniqueBarcode(
    barcode: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = excludeId
      ? await this.products.findByBarcodeExcept(barcode, excludeId)
      : await this.products.findByBarcode(barcode);

    if (existing) {
      throw new DuplicateBarcodeException(barcode);
    }
  }

  private emitProductCreated(product: Product): void {
    this.eventEmitter
      .emitAsync('product.created', {
        productId: product.id,
        barcode: product.barcode,
        dciName: product.dci_name,
        commercialName: product.commercial_name,
        category: product.category,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to emit product.created event for ${product.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
  }

  private normalizeBulkRow(
    raw: Record<string, unknown>,
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(raw)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter: string) =>
        letter.toUpperCase(),
      );
      normalized[camelKey] = value;
    }

    const snakeToCamel: Record<string, string> = {
      dci_name: 'dciName',
      commercial_name: 'commercialName',
      sale_price: 'salePrice',
      cost_price: 'costPrice',
      min_stock: 'minStock',
    };

    for (const [snake, camel] of Object.entries(snakeToCamel)) {
      if (snake in raw && !(camel in normalized)) {
        normalized[camel] = raw[snake];
      }
    }

    return normalized;
  }

  private toCreateInput(
    dto: CreateProductDto | BulkImportRowDto,
  ): Prisma.ProductUncheckedCreateInput {
    return {
      dci_name: dto.dciName,
      commercial_name: dto.commercialName,
      laboratory: dto.laboratory ?? null,
      form: dto.form ?? null,
      concentration: dto.concentration ?? null,
      barcode: dto.barcode,
      category: dto.category,
      sale_price: dto.salePrice,
      cost_price: dto.costPrice,
      min_stock: dto.minStock,
      active: true,
      deleted_at: null,
    };
  }

  private toUpdateInput(
    dto: UpdateProductDto,
  ): Prisma.ProductUncheckedUpdateInput {
    const data: Prisma.ProductUncheckedUpdateInput = {};

    if (dto.dciName !== undefined) data.dci_name = dto.dciName;
    if (dto.commercialName !== undefined)
      data.commercial_name = dto.commercialName;
    if (dto.laboratory !== undefined) data.laboratory = dto.laboratory ?? null;
    if (dto.form !== undefined) data.form = dto.form ?? null;
    if (dto.concentration !== undefined)
      data.concentration = dto.concentration ?? null;
    if (dto.barcode !== undefined) data.barcode = dto.barcode;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.salePrice !== undefined) data.sale_price = dto.salePrice;
    if (dto.costPrice !== undefined) data.cost_price = dto.costPrice;
    if (dto.minStock !== undefined) data.min_stock = dto.minStock;

    return data;
  }

  private toResponse(product: Product): ProductResponseDto {
    return plainToInstance(ProductResponseDto, {
      id: product.id,
      dciName: product.dci_name,
      commercialName: product.commercial_name,
      laboratory: product.laboratory,
      form: product.form,
      concentration: product.concentration,
      barcode: product.barcode,
      category: product.category,
      salePrice: Number(product.sale_price),
      costPrice: Number(product.cost_price),
      minStock: product.min_stock,
      active: product.active,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: product.deleted_at,
    });
  }
}
