/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { UserRole } from '@prisma/client';

describe('PurchaseOrdersController', () => {
  let controller: PurchaseOrdersController;
  let service: jest.Mocked<PurchaseOrdersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrdersController],
      providers: [
        {
          provide: PurchaseOrdersService,
          useValue: {
            create: jest.fn(),
            submit: jest.fn(),
            receive: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PurchaseOrdersController>(PurchaseOrdersController);
    service = module.get(PurchaseOrdersService);
  });

  const user = {
    id: 'user-1',
    role: UserRole.PHARMACIST,
    fullName: 'Test User',
    email: 'test@example.com',
  };

  const request = {
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as import('express').Request;

  it('routes POST /purchase-orders to create', async () => {
    const dto = {
      supplierId: 'supplier-1',
      orderDate: '2026-09-11',
      items: [],
    };
    await controller.create(dto, user, request);
    expect(service.create).toHaveBeenCalledWith(
      user.id,
      dto,
      expect.any(Object),
    );
  });

  it('routes PATCH /purchase-orders/:id/submit to submit', async () => {
    await controller.submit('order-1', user, request);
    expect(service.submit).toHaveBeenCalledWith(
      user.id,
      'order-1',
      expect.any(Object),
    );
  });

  it('routes PATCH /purchase-orders/:id/receive to receive', async () => {
    const dto = {
      invoiceNumber: 'INV-001',
      invoiceDate: '2026-09-11',
      items: [],
    };
    await controller.receive('order-1', dto, user, request);
    expect(service.receive).toHaveBeenCalledWith(
      user.id,
      'order-1',
      dto,
      expect.any(Object),
    );
  });
});
