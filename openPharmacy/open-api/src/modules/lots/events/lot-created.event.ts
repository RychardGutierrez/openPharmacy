export class LotCreatedEvent {
  constructor(
    public readonly lotId: string,
    public readonly productId: string,
    public readonly lotNumber: string,
    public readonly expiryDate: Date,
    public readonly initialQty: number,
  ) {}
}
