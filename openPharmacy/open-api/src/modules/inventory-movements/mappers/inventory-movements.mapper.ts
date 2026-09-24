import {
  MovementType,
  AdjustmentStatus,
  AdjustmentDirection,
} from '@prisma/client';
import type { MovementResponseDto } from '../dto/movement-response.dto';
import type { AdjustmentResponseDto } from '../dto/adjustment-response.dto';

type ProductInput =
  | { id: string; commercial_name: string }
  | { id: string; commercialName: string }
  | null
  | undefined;

type LotInput =
  | { id: string; lot_number: string }
  | { id: string; lotNumber: string }
  | null
  | undefined;

type UserInput =
  | { id: string; full_name: string }
  | { id: string; fullName: string }
  | null
  | undefined;

function getCommercialName(product: ProductInput): string | undefined {
  if (!product) return undefined;
  return 'commercial_name' in product
    ? product.commercial_name
    : product.commercialName;
}

function getLotNumber(lot: LotInput): string | undefined {
  if (!lot) return undefined;
  return 'lot_number' in lot ? lot.lot_number : lot.lotNumber;
}

function getFullName(user: UserInput): string | undefined {
  if (!user) return undefined;
  return 'full_name' in user ? user.full_name : user.fullName;
}

function mapProduct(
  product: ProductInput,
): MovementResponseDto['product'] {
  const name = getCommercialName(product);
  if (!product || name === undefined) return undefined;
  return { id: product.id, commercialName: name };
}

function mapLot(lot: LotInput): MovementResponseDto['lot'] {
  const number = getLotNumber(lot);
  if (!lot || number === undefined) return undefined;
  return { id: lot.id, lotNumber: number };
}

function mapUser(user: UserInput): MovementResponseDto['user'] {
  const name = getFullName(user);
  if (!user || name === undefined) return undefined;
  return { id: user.id, fullName: name };
}

export interface InventoryMovementInput {
  id: string;
  product_id: string;
  lot_id: string;
  user_id: string;
  movementType: string;
  quantity: number;
  reason: string | null;
  approved_by: string | null;
  created_at: Date;
  product?: ProductInput;
  lot?: LotInput;
  user?: UserInput;
  approver?: UserInput;
}

export function mapMovement(
  movement: InventoryMovementInput,
): MovementResponseDto {
  return {
    id: movement.id,
    product_id: movement.product_id,
    lot_id: movement.lot_id,
    user_id: movement.user_id,
    movementType: movement.movementType as MovementType,
    quantity: movement.quantity,
    reason: movement.reason,
    approved_by: movement.approved_by,
    created_at: movement.created_at,
    product: mapProduct(movement.product),
    lot: mapLot(movement.lot),
    user: mapUser(movement.user),
    approver: mapUser(movement.approver),
  };
}

export interface InventoryAdjustmentInput {
  id: string;
  product_id: string;
  lot_id: string;
  requested_by: string;
  quantity: number;
  direction: string;
  movementType: string;
  reason: string;
  status: string;
  approved_by: string | null;
  approved_at: Date | null;
  created_at: Date;
  product?: ProductInput;
  lot?: LotInput;
  requester?: UserInput;
  approver?: UserInput;
}

export function mapAdjustment(
  adjustment: InventoryAdjustmentInput,
): AdjustmentResponseDto {
  return {
    id: adjustment.id,
    product_id: adjustment.product_id,
    lot_id: adjustment.lot_id,
    requested_by: adjustment.requested_by,
    quantity: adjustment.quantity,
    direction: adjustment.direction as AdjustmentDirection,
    movementType: adjustment.movementType as MovementType,
    reason: adjustment.reason,
    status: adjustment.status as AdjustmentStatus,
    approved_by: adjustment.approved_by,
    approved_at: adjustment.approved_at,
    created_at: adjustment.created_at,
    product: mapProduct(adjustment.product),
    lot: mapLot(adjustment.lot),
    requester: mapUser(adjustment.requester),
    approver: mapUser(adjustment.approver),
  };
}
