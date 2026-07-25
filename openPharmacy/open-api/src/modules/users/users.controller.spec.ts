/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/* eslint-disable @typescript-eslint/unbound-method */

const mockUserResponse = {
  id: 'u-1',
  fullName: 'Test',
  ci: '1234567',
  email: 'test@example.com',
  role: UserRole.ADMIN,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockUserResponse),
      findAll: jest.fn().mockResolvedValue({
        data: [mockUserResponse],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
      findOne: jest.fn().mockResolvedValue(mockUserResponse),
      update: jest.fn().mockResolvedValue(mockUserResponse),
      deactivate: jest.fn().mockResolvedValue(mockUserResponse),
      activate: jest.fn().mockResolvedValue(mockUserResponse),
    } as unknown as jest.Mocked<UsersService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates create to service', async () => {
    const dto = {
      fullName: 'New',
      ci: '1234567',
      email: 'new@example.com',
      role: UserRole.ADMIN,
    };
    await controller.create(dto);
    expect(service.create as jest.Mock).toHaveBeenCalledWith(dto);
  });

  it('delegates findAll to service', async () => {
    const query = { page: 1, pageSize: 20 };
    await controller.findAll(query);
    expect(service.findAll as jest.Mock).toHaveBeenCalledWith(query);
  });
});
