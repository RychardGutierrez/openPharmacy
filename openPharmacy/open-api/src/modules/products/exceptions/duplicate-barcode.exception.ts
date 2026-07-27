import { ConflictException } from '@nestjs/common';

/**
 * Thrown when a product is created or updated with a barcode already in use.
 *
 * Returns HTTP 409 with a stable code so the frontend can highlight the
 * barcode field and show a specific message.
 */
export class DuplicateBarcodeException extends ConflictException {
  constructor(barcode: string) {
    super({
      statusCode: 409,
      code: 'DUPLICATE_BARCODE',
      field: 'barcode',
      message: `Barcode "${barcode}" is already registered`,
    });
  }
}
