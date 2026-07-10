import { Injectable } from '@nestjs/common';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { UpdateInventoryMovementDto } from './dto/update-inventory-movement.dto';

@Injectable()
export class InventoryMovementsService {
  create(createInventoryMovementDto: CreateInventoryMovementDto) {
    return 'This action adds a new inventoryMovement';
  }

  findAll() {
    return `This action returns all inventoryMovements`;
  }

  findOne(id: number) {
    return `This action returns a #${id} inventoryMovement`;
  }

  update(id: number, updateInventoryMovementDto: UpdateInventoryMovementDto) {
    return `This action updates a #${id} inventoryMovement`;
  }

  remove(id: number) {
    return `This action removes a #${id} inventoryMovement`;
  }
}
