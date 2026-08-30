import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';

@Injectable()
export class ConfigService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async getPharmacyInfo(): Promise<Record<string, string>> {
    if (!this.prisma) return {};
    const rows = await this.prisma.config.findMany({
      where: {
        key: {
          in: [
            'PHARMACY_NAME',
            'PHARMACY_NIT',
            'PHARMACY_ADDRESS',
            'PHARMACY_PHONE',
            'RECEIPT_FOOTER',
          ],
        },
      },
      select: { key: true, value: true },
    });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }
  create(createConfigDto: CreateConfigDto) {
    void createConfigDto;
    return 'This action adds a new config';
  }

  findAll() {
    return `This action returns all config`;
  }

  findOne(id: number) {
    return `This action returns a #${id} config`;
  }

  update(id: number, updateConfigDto: UpdateConfigDto) {
    void updateConfigDto;
    return `This action updates a #${id} config`;
  }

  remove(id: number) {
    return `This action removes a #${id} config`;
  }
}
