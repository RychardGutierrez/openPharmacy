import { ConflictException } from '@nestjs/common';

export class AdjustmentAlreadyProcessedException extends ConflictException {
  constructor(id: string, status: string) {
    super({
      statusCode: 409,
      code: 'ADJUSTMENT_ALREADY_PROCESSED',
      message: `Adjustment ${id} is already ${status}`,
    });
  }
}

export class AdjustmentSelfApprovalException extends ConflictException {
  constructor(id: string) {
    super({
      statusCode: 409,
      code: 'ADJUSTMENT_SELF_APPROVAL',
      message: `Approver cannot approve their own adjustment request ${id}`,
    });
  }
}

export class InsufficientLotStockException extends ConflictException {
  constructor(lotId: string, requested: number, available: number) {
    super({
      statusCode: 409,
      code: 'INSUFFICIENT_LOT_STOCK',
      message: `Lot ${lotId} has ${available} units available; cannot decrease by ${requested}`,
    });
  }
}

export class InvalidAdjustmentDirectionException extends ConflictException {
  constructor() {
    super({
      statusCode: 409,
      code: 'INVALID_ADJUSTMENT_DIRECTION',
      message: 'Manual adjustment must specify a valid direction',
    });
  }
}
