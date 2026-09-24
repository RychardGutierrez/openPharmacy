import { Expose, Type } from 'class-transformer';
import { MovementType } from '@prisma/client';

class MovementProductDto {
  @Expose()
  id!: string;

  @Expose({ name: 'commercial_name' })
  commercialName!: string;
}

class MovementLotDto {
  @Expose()
  id!: string;

  @Expose({ name: 'lot_number' })
  lotNumber!: string;
}

class MovementUserDto {
  @Expose()
  id!: string;

  @Expose({ name: 'full_name' })
  fullName!: string;
}

export class MovementResponseDto {
  @Expose()
  id!: string;

  @Expose()
  product_id!: string;

  @Expose()
  lot_id!: string;

  @Expose()
  user_id!: string;

  @Expose()
  movementType!: MovementType;

  @Expose()
  quantity!: number;

  @Expose()
  reason!: string | null;

  @Expose()
  approved_by!: string | null;

  @Expose()
  created_at!: Date;

  @Expose()
  @Type(() => MovementProductDto)
  product?: MovementProductDto;

  @Expose()
  @Type(() => MovementLotDto)
  lot?: MovementLotDto;

  @Expose()
  @Type(() => MovementUserDto)
  user?: MovementUserDto;

  @Expose()
  @Type(() => MovementUserDto)
  approver?: MovementUserDto | null;
}
