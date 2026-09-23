import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Supplier } from '@prisma/client';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestMetadata } from '../users/users.service';
import {
  CreateSupplierDto,
  normalizeNit,
  SuppliersListQueryDto,
} from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { DuplicateNitException } from './exceptions/duplicate-nit.exception';
import { SuppliersRepository } from './repositories/suppliers.repository';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'P2002';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly suppliers: SuppliersRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogRepository,
  ) {}

  /**
   * Return the full active-supplier list (used by simple dropdowns).
   */
  findAll(): Promise<Supplier[]> {
    return this.suppliers.findAll();
  }

  /**
   * Paginated, search-backed supplier list. Used by the purchase-order supplier
   * picker when the active-supplier list grows beyond a single page.
   */
  findAllPaginated(query: SuppliersListQueryDto) {
    return this.suppliers.findAllPaginated({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 50,
      q: query.q?.trim() || undefined,
      active: query.active,
    });
  }

  /**
   * Fetch a supplier by id, including deactivated ones so admins can still
   * inspect records referenced by historical purchase orders.
   */
  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.suppliers.findById(id);
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return supplier;
  }

  async create(
    dto: CreateSupplierDto,
    userId?: string,
    meta?: RequestMetadata,
  ): Promise<Supplier> {
    const nit = normalizeNit(dto.nit);
    await this.validateUniqueNit(nit);

    const data: Parameters<SuppliersRepository['createTx']>[1] = {
      name: dto.name,
      nit,
      active: dto.active ?? true,
    };
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.contact_person !== undefined)
      data.contact_person = dto.contact_person;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.payment_terms !== undefined) data.payment_terms = dto.payment_terms;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await this.suppliers.createTx(tx, data);

        await this.audit.createInTx(tx, {
          userId: userId ?? null,
          event: 'SUPPLIER_CREATED',
          ip: meta?.ip ?? null,
          userAgent: meta?.userAgent ?? null,
          metadata: { supplierId: created.id, nit: created.nit },
        });

        return created;
      });
    } catch (error) {
      // Pre-check raced with a concurrent insert of the same NIT.
      if (isUniqueViolation(error)) throw new DuplicateNitException(nit);
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateSupplierDto,
    userId?: string,
    meta?: RequestMetadata,
  ): Promise<Supplier> {
    const existing = await this.suppliers.findById(id);
    if (!existing) throw new NotFoundException(`Supplier ${id} not found`);

    const nextNit = dto.nit !== undefined ? normalizeNit(dto.nit) : undefined;
    if (nextNit !== undefined && nextNit !== existing.nit) {
      await this.validateUniqueNit(nextNit, id);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await this.suppliers.updateTx(tx, id, {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(nextNit !== undefined ? { nit: nextNit } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.city !== undefined ? { city: dto.city } : {}),
          ...(dto.contact_person !== undefined
            ? { contact_person: dto.contact_person }
            : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.payment_terms !== undefined
            ? { payment_terms: dto.payment_terms }
            : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        });

        await this.audit.createInTx(tx, {
          userId: userId ?? null,
          event: 'SUPPLIER_UPDATED',
          ip: meta?.ip ?? null,
          userAgent: meta?.userAgent ?? null,
          metadata: {
            supplierId: id,
            changedFields: Object.keys(dto),
          },
        });

        return updated;
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new DuplicateNitException(nextNit ?? '');
      throw error;
    }
  }

  /**
   * Soft-delete a supplier. Historical purchase orders keep their reference;
   * only the `active` flag flips.
   */
  async deactivate(
    id: string,
    userId?: string,
    meta?: RequestMetadata,
  ): Promise<Supplier> {
    const existing = await this.suppliers.findById(id);
    if (!existing) throw new NotFoundException(`Supplier ${id} not found`);

    return this.prisma.$transaction(async (tx) => {
      const deactivated = await this.suppliers.deactivateTx(tx, id);

      await this.audit.createInTx(tx, {
        userId: userId ?? null,
        event: 'SUPPLIER_DEACTIVATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { supplierId: id },
      });

      return deactivated;
    });
  }

  /**
   * Reactivate a previously deactivated supplier.
   */
  async activate(
    id: string,
    userId?: string,
    meta?: RequestMetadata,
  ): Promise<Supplier> {
    const existing = await this.suppliers.findById(id);
    if (!existing) throw new NotFoundException(`Supplier ${id} not found`);

    return this.prisma.$transaction(async (tx) => {
      const activated = await this.suppliers.activateTx(tx, id);

      await this.audit.createInTx(tx, {
        userId: userId ?? null,
        event: 'SUPPLIER_ACTIVATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { supplierId: id },
      });

      return activated;
    });
  }

  private async validateUniqueNit(
    nit: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = excludeId
      ? await this.suppliers.findByNitExcept(nit, excludeId)
      : await this.suppliers.findByNit(nit);
    if (existing) {
      throw new DuplicateNitException(nit);
    }
  }
}
