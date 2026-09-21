import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Supplier } from '@prisma/client';
import { CreateSupplierDto, SuppliersListQueryDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersRepository } from './repositories/suppliers.repository';

@Injectable()
export class SuppliersService {
  constructor(private readonly suppliers: SuppliersRepository) {}

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

  async findOne(id: string): Promise<Supplier> {
    const supplier = await this.suppliers.findById(id);
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return supplier;
  }

  create(dto: CreateSupplierDto): Promise<Supplier> {
    const data: Parameters<SuppliersRepository['create']>[0] = {
      name: dto.name,
      nit: dto.nit,
      active: dto.active ?? true,
    };
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.contact_person !== undefined)
      data.contact_person = dto.contact_person;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.payment_terms !== undefined) data.payment_terms = dto.payment_terms;
    return this.suppliers.create(data);
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    await this.findOne(id);
    return this.suppliers.update(id, dto);
  }

  async remove(id: string): Promise<Supplier> {
    await this.findOne(id);
    return this.suppliers.remove(id);
  }
}
