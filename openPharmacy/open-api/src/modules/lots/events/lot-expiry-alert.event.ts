export type ExpiryStatus = 'RED' | 'ORANGE' | 'GREEN';

export class LotExpiryAlertEvent {
  constructor(
    public readonly lotId: string,
    public readonly productId: string,
    public readonly lotNumber: string,
    public readonly productName: string,
    public readonly expiryDate: Date,
    public readonly status: ExpiryStatus,
    public readonly daysUntilExpiry: number,
  ) {}
}
