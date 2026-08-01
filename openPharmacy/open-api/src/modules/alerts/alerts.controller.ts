import { Controller, Get, MessageEvent, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable, Subject } from 'rxjs';
import { OnEvent } from '@nestjs/event-emitter';
import { map } from 'rxjs/operators';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AlertsService } from './alerts.service';
import { LotExpiryAlertEvent } from '../lots/events/lot-expiry-alert.event';

@ApiTags('alerts')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller('alerts')
export class AlertsController {
  private readonly alerts$ = new Subject<MessageEvent>();

  constructor(private readonly alertsService: AlertsService) {}

  @Sse('stream')
  @ApiOperation({ summary: 'Server-Sent Events stream for expiry alerts' })
  async stream(): Promise<Observable<MessageEvent>> {
    const current = await this.alertsService.getCurrentAlerts();
    const newlyCrossed = await this.alertsService.checkNewlyCrossed();

    // Emit current snapshot immediately, then any newly-crossed alerts.
    const initial: MessageEvent[] = [
      {
        type: 'snapshot',
        data: { current, newlyCrossed },
      },
    ];

    return new Observable<MessageEvent>((subscriber) => {
      for (const event of initial) {
        subscriber.next(event);
      }

      const subscription = this.alerts$
        .pipe(
          map((event) => ({
            ...event,
            data:
              typeof event.data === 'string'
                ? event.data
                : JSON.stringify(event.data),
          })),
        )
        .subscribe(subscriber);

      return () => subscription.unsubscribe();
    });
  }

  @Get()
  @ApiOperation({ summary: 'Current expiry alerts snapshot' })
  async findAll() {
    const current = await this.alertsService.getCurrentAlerts();
    const newlyCrossed = await this.alertsService.checkNewlyCrossed();
    return { current, newlyCrossed };
  }

  @OnEvent('lot.expiry-alert')
  handleExpiryAlert(event: LotExpiryAlertEvent): void {
    this.alerts$.next({
      type: 'alert',
      data: event,
    });
  }
}
