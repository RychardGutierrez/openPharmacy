export class LotUpdatedEvent {
  constructor(
    public readonly lotId: string,
    public readonly productId: string,
    public readonly changedFields: string[],
  ) {}
}
