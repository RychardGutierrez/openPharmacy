import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

describe('AlertsController', () => {
  let controller: AlertsController;
  let alertsService: jest.Mocked<AlertsService>;

  beforeEach(async () => {
    alertsService = {
      getCurrentAlerts: jest.fn(),
      checkNewlyCrossed: jest.fn(),
    } as unknown as jest.Mocked<AlertsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [{ provide: AlertsService, useValue: alertsService }],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns current alerts snapshot', async () => {
    alertsService.getCurrentAlerts.mockResolvedValue([]);
    alertsService.checkNewlyCrossed.mockResolvedValue([]);

    const result = await controller.findAll();

    expect(result).toEqual({ current: [], newlyCrossed: [] });
  });
});
