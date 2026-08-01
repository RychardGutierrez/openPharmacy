/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AlertsService } from './alerts.service';
import { LotsService } from '../lots/lots.service';

describe('AlertsService', () => {
  let service: AlertsService;
  let lotsService: jest.Mocked<LotsService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    lotsService = {
      getExpiryDashboard: jest.fn(),
    } as unknown as jest.Mocked<LotsService>;

    eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EventEmitter2>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: LotsService, useValue: lotsService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns current alerts (RED + ORANGE lots)', async () => {
    lotsService.getExpiryDashboard.mockResolvedValue({
      generatedAt: new Date(),
      red: {
        status: 'RED',
        count: 1,
        lots: [
          {
            id: 'lot-1',
            productId: 'product-1',
            productName: 'Tylenol',
            lotNumber: 'LOT-001',
            expiryDate: new Date('2026-08-01'),
            currentQty: 10,
            status: 'RED',
            daysUntilExpiry: 5,
          },
        ],
      },
      orange: {
        status: 'ORANGE',
        count: 0,
        lots: [],
      },
      green: {
        status: 'GREEN',
        count: 1,
        lots: [
          {
            id: 'lot-2',
            productId: 'product-1',
            productName: 'Tylenol',
            lotNumber: 'LOT-002',
            expiryDate: new Date('2027-12-31'),
            currentQty: 50,
            status: 'GREEN',
            daysUntilExpiry: 500,
          },
        ],
      },
    } as never);

    const result = await service.getCurrentAlerts();

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('RED');
  });

  it('emits newly-crossed alerts once per lot/status', async () => {
    jest.useFakeTimers();
    // 03:00 UTC -> start of today (00:00 UTC) is within the last 6 hours.
    jest.setSystemTime(new Date('2026-07-27T03:00:00.000Z'));

    // Lot crossed the RED threshold (30 days) at the start of today.
    const expiryDate = new Date('2026-08-26T00:00:00.000Z');

    lotsService.getExpiryDashboard.mockResolvedValue({
      generatedAt: new Date(),
      red: {
        status: 'RED',
        count: 1,
        lots: [
          {
            id: 'lot-1',
            productId: 'product-1',
            productName: 'Tylenol',
            lotNumber: 'LOT-001',
            expiryDate,
            currentQty: 10,
            status: 'RED',
            daysUntilExpiry: 29,
          },
        ],
      },
      orange: { status: 'ORANGE', count: 0, lots: [] },
      green: { status: 'GREEN', count: 0, lots: [] },
    } as never);

    const alerts = await service.forceCheck();

    expect(alerts).toHaveLength(1);
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'lot.expiry-alert',
      expect.objectContaining({ lotId: 'lot-1', status: 'RED' }),
    );

    jest.useRealTimers();
  });
});
