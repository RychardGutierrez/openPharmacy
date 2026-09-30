import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { of } from 'rxjs';
import { UserRole } from '@prisma/client';

describe('DashboardController', () => {
  let controller: DashboardController;
  const service = {
    getKpis: jest.fn(),
    getLowStock: jest.fn(),
    getExpiring: jest.fn(),
    getRecentSales: jest.fn(),
    getInitialStreamEvent: jest.fn(),
    getSalesTrend: jest.fn(),
    events: of(),
    eventsFor: jest.fn(() => of()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates KPI queries to the service', async () => {
    const query = { groupByCashier: true };
    service.getKpis.mockResolvedValue({
      totalSales: 10,
    });

    await expect(
      controller.getKpis(query, {
        id: 'admin',
        role: UserRole.ADMIN,
        fullName: 'Admin',
        email: 'admin@example.com',
      }),
    ).resolves.toEqual({
      totalSales: 10,
    });
    expect(service.getKpis).toHaveBeenCalledWith(
      query,
      expect.objectContaining({ role: UserRole.ADMIN }),
    );
  });

  it('creates an SSE stream with an initial snapshot', async () => {
    const snapshot = { type: 'alert.triggered', data: { kind: 'snapshot' } };
    service.getInitialStreamEvent.mockResolvedValue(snapshot);

    const stream = controller.stream({
      id: 'admin',
      role: UserRole.ADMIN,
      fullName: 'Admin',
      email: 'admin@example.com',
    });
    await new Promise<void>((resolve) => {
      stream.subscribe((event) => {
        expect(event).toEqual({
          type: snapshot.type,
          data: JSON.stringify(snapshot.data),
        });
        resolve();
      });
    });
  });
});
