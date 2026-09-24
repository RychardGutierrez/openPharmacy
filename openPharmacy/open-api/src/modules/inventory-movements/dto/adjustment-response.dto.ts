import { Expose, Type } from 'class-transformer';
import {
  AdjustmentStatus,
  AdjustmentDirection,
  MovementType,
} from '@prisma/client';

class AdjustmentProductDto {
  @Expose()
  id!: string;

  @Expose({ name: 'commercial_name' })
  commercialName!: string;
}

class AdjustmentLotDto {
  @Expose()
  id!: string;

  @Expose({ name: 'lot_number' })
  lotNumber!: string;
}

class AdjustmentUserDto {
  @Expose()
  id!: string;

  @Expose({ name: 'full_name' })
  fullName!: string;
}

export class AdjustmentResponseDto {
  @Expose()
  id!: string;

  @Expose()
  product_id!: string;

  @Expose()
  lot_id!: string;

  @Expose()
  requested_by!: string;

  @Expose()
  quantity!: number;

  @Expose()
  direction!: AdjustmentDirection;

  @Expose()
  movementType!: MovementType;

  @Expose()
  reason!: string;

  @Expose()
  status!: AdjustmentStatus;

  @Expose()
  approved_by!: string | null;

  @Expose()
  approved_at!: Date | null;

  @Expose()
  created_at!: Date;

  @Expose()
  @Type(() => AdjustmentProductDto)
  product?: AdjustmentProductDto;

  @Expose()
  @Type(() => AdjustmentLotDto)
  lot?: AdjustmentLotDto;

  @Expose()
  @Type(() => AdjustmentUserDto)
  requester?: AdjustmentUserDto;

  @Expose()
  @Type(() => AdjustmentUserDto)
  approver?: AdjustmentUserDto | null;
}
