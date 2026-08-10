import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { ShiftsService } from '../shifts/shifts.service';

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: ShiftsService,
          useValue: { validateActiveShift: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
