import { Injectable } from '@nestjs/common';
import { ShiftsService } from '../shifts/shifts.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Injectable()
export class SalesService {
  constructor(private readonly shiftsService: ShiftsService) {}

  async create(userId: string, createSaleDto: CreateSaleDto) {
    void createSaleDto;
    await this.shiftsService.validateActiveShift(userId);
    return 'This action adds a new sale';
  }

  findAll() {
    return `This action returns all sales`;
  }

  findOne(id: number) {
    return `This action returns a #${id} sale`;
  }

  update(id: number, updateSaleDto: UpdateSaleDto) {
    void updateSaleDto;
    return `This action updates a #${id} sale`;
  }

  remove(id: number) {
    return `This action removes a #${id} sale`;
  }
}
