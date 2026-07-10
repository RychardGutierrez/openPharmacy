import { Injectable } from '@nestjs/common';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';

@Injectable()
export class SedesService {
  create(createSedeDto: CreateSedeDto) {
    return 'This action adds a new sede';
  }

  findAll() {
    return `This action returns all sedes`;
  }

  findOne(id: number) {
    return `This action returns a #${id} sede`;
  }

  update(id: number, updateSedeDto: UpdateSedeDto) {
    return `This action updates a #${id} sede`;
  }

  remove(id: number) {
    return `This action removes a #${id} sede`;
  }
}
