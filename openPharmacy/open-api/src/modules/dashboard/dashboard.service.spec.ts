import { Test, TestingModule } from '@nestjs/testing';
import { DashboardEventBus } from './dashboard-event-bus.service';
import { DashboardRepository } from './repositories/dashboard.repository';
import { DashboardService } from './dashboard.service';
import { Subject } from 'rxjs';
import { UserRole } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;
  const repository = {
    getLowStock: jest.fn(),
    getExpiring: jest.fn(),
    getKpis: jest.fn(),
    getRecentSales: jest.fn(),
  };
  const eventBus = { events: new Subject() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DashboardRepository, useValue: repository },
        { provide: DashboardEventBus, useValue: eventBus },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('aggregates KPI dependencies with the 30-day expiry default', async () => {
    repository.getLowStock.mockResolvedValue({ items: [{ productId: 'p1' }] });
    repository.getExpiring.mockResolvedValue({ lots: [{ lotId: 'l1' }] });
    repository.getKpis.mockResolvedValue({ totalSales: 100 });

    await expect(
      service.getKpis(
        {},
        {
          id: 'admin',
          role: UserRole.ADMIN,
          fullName: 'Admin',
          email: 'admin@example.com',
        },
      ),
    ).resolves.toEqual({ totalSales: 100 });
    expect(repository.getExpiring).toHaveBeenCalledWith({
      horizonDays: 30,
    });
    expect(repository.getExpiring).toHaveBeenCalledWith({
      horizonDays: 90,
    });
    expect(repository.getKpis).toHaveBeenCalledWith({}, 1, 1, 1, true);
  });

  it('delegates low-stock reads', async () => {
    const query = { q: 'aspirin' };
    repository.getLowStock.mockResolvedValue({ items: [] });

    await service.getLowStock(query);
    expect(repository.getLowStock).toHaveBeenCalledWith(query);
  });
});
