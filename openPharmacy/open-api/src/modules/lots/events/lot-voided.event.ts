export class LotVoidedEvent {
  constructor(
    public readonly lotId: string,
    public readonly productId: string,
    public readonly reason: string,
  ) {}
}
