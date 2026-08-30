import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Subject } from 'rxjs';
import { DASHBOARD_EVENTS } from './dashboard-events.token';

@Injectable()
export class DashboardSaleListener {
  constructor(
    @Inject(DASHBOARD_EVENTS) private readonly events: Subject<MessageEvent>,
  ) {}

  @OnEvent('sale.created')
  onSaleCreated(payload: Record<string, unknown>): void {
    this.events.next({
      type: 'sale.created',
      data: payload,
    } as unknown as MessageEvent);
  }
}
