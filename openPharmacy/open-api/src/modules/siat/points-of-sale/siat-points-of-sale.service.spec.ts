import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AuditLogRepository } from '../../../common/audit/audit-log.repository';
import type { PrismaService } from '../../../prisma/prisma.service';
import { SiatRejectedError } from '../client/siat-errors';
import type { SiatSoapClient } from '../client/siat-soap.client';
import { fixedSiatClock } from '../codes/siat-clock';
import type { SiatCodesService } from '../codes/siat-codes.service';
import type { SiatCufdService } from '../codes/siat-cufd.service';
import { SiatPointsOfSaleService } from './siat-points-of-sale.service';

const NOW = new Date('2026-11-17T12:00:00Z');
const BRANCH = { id: 'br-0', codigo_sucursal: 0, active: true };

function setup() {
  const prisma = {
    siatBranch: { findUnique: jest.fn(() => Promise.resolve(BRANCH)) },
    siatPointOfSale: {
      findUnique: jest.fn(),
      findMany: jest.fn(() => Promise.resolve([])),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pos-new', ...data }),
      ),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pos-3', ...data }),
      ),
    },
    siatCuis: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      updateMany: jest.fn(),
    },
    siatCufd: { findFirst: jest.fn(() => Promise.resolve(null)) },
    shift: { count: jest.fn(() => Promise.resolve(0)) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((cb: (tx: typeof prisma) => unknown) =>
    cb(prisma),
  );
  // Point of sale 0 lookup (branch CUIS) vs. the point of sale being acted on.
  prisma.siatPointOfSale.findUnique.mockImplementation(
    ({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(
        'branch_id_codigo_punto_venta' in where
          ? { id: 'pos-0' }
          : {
              id: 'pos-3',
              branch_id: 'br-0',
              codigo_punto_venta: 3,
              active: false,
              closed_at: null,
              branch: { codigo_sucursal: 0 },
            },
      ),
  );

  const client = { invoke: jest.fn() };
  const codes = {
    cuisCode: jest.fn(() => Promise.resolve('BRANCH-CUIS')),
    identity: jest.fn(() =>
      Promise.resolve({
        nit: '1234567',
        codigoSistema: 'SYS',
        codigoModalidad: 2,
      }),
    ),
    ensureCuis: jest.fn(() => Promise.resolve({ state: 'valid' })),
    status: jest.fn(),
  };
  const cufd = {
    status: jest.fn(() =>
      Promise.resolve({ state: 'valid', validUntil: NOW, minutesLeft: 60 }),
    ),
    ensureCufd: jest.fn(() =>
      Promise.resolve({
        pointOfSaleId: 'pos-3',
        codigoSucursal: 0,
        codigoPuntoVenta: 3,
        state: 'valid',
        validUntil: NOW,
        minutesLeft: 1440,
        source: 'siat',
      }),
    ),
  };
  const audit = { create: jest.fn() };
  const service = new SiatPointsOfSaleService(
    prisma as unknown as PrismaService,
    client as unknown as SiatSoapClient,
    codes as unknown as SiatCodesService,
    cufd as unknown as SiatCufdService,
    audit as unknown as AuditLogRepository,
    fixedSiatClock(NOW),
  );
  return { service, prisma, client, codes, cufd, audit };
}

const registerDto = {
  branchId: 'br-0',
  codigoTipoPuntoVenta: 5,
  name: 'Caja 1',
  description: 'Mostrador',
};

describe('SiatPointsOfSaleService.register', () => {
  it('registers with the branch CUIS, stores the SIAT number and requests the PoS CUIS', async () => {
    const { service, client, prisma, codes, audit } = setup();
    client.invoke.mockResolvedValue({
      transaccion: true,
      mensajes: [],
      payload: { codigoPuntoVenta: '3', transaccion: 'true' },
    });

    const result = await service.register(registerDto, 'admin');

    expect(codes.cuisCode).toHaveBeenCalledWith('pos-0', { userId: 'admin' });
    expect((client.invoke.mock.calls[0] as unknown[])[1]).toMatchObject({
      SolicitudRegistroPuntoVenta: {
        cuis: 'BRANCH-CUIS',
        codigoTipoPuntoVenta: 5,
      },
    });
    expect(prisma.siatPointOfSale.create).toHaveBeenCalledWith({
      data: {
        branch_id: 'br-0',
        codigo_punto_venta: 3,
        tipo_punto_venta: 5,
        name: 'Caja 1',
      },
    });
    expect(codes.ensureCuis).toHaveBeenCalledWith('pos-new', {
      userId: 'admin',
    });
    expect(result.cuis).toEqual({ state: 'valid' });
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'SIAT_POS_REGISTERED' }),
    );
  });

  it('keeps the registered PoS when its CUIS request fails', async () => {
    const { service, client, codes } = setup();
    client.invoke.mockResolvedValue({
      transaccion: true,
      mensajes: [],
      payload: { codigoPuntoVenta: '3' },
    });
    codes.ensureCuis.mockRejectedValue(new Error('down'));

    const result = await service.register(registerDto, 'admin');

    expect(result.pointOfSale).toMatchObject({ codigo_punto_venta: 3 });
    expect(result.cuis).toMatchObject({ state: 'missing' });
  });

  it('rejects an unknown point-of-sale type without calling SIAT', async () => {
    const { service, client } = setup();

    await expect(
      service.register({ ...registerDto, codigoTipoPuntoVenta: 1 }, 'admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('surfaces a SIAT rejection', async () => {
    const { service, client, prisma } = setup();
    client.invoke.mockResolvedValue({
      transaccion: false,
      mensajes: [{ codigo: 1, descripcion: 'x' }],
      payload: {},
    });

    await expect(service.register(registerDto, 'admin')).rejects.toBeInstanceOf(
      SiatRejectedError,
    );
    expect(prisma.siatPointOfSale.create).not.toHaveBeenCalled();
  });
});

describe('SiatPointsOfSaleService.close', () => {
  it('refuses while the point of sale still has a valid CUIS', async () => {
    const { service, prisma, client } = setup();
    prisma.siatCuis.findFirst.mockResolvedValue({
      valid_until: new Date('2027-01-01'),
    } as never);

    await expect(service.close('pos-3', 'admin')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(client.invoke).not.toHaveBeenCalled();
  });

  it('refuses while shifts are open on it', async () => {
    const { service, prisma } = setup();
    prisma.shift.count.mockResolvedValue(1);

    await expect(service.close('pos-3', 'admin')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('closes in SIAT, then marks it closed and retires its CUIS rows', async () => {
    const { service, prisma, client, audit } = setup();
    client.invoke.mockResolvedValue({
      transaccion: true,
      mensajes: [],
      payload: {},
    });

    await service.close('pos-3', 'admin');

    expect((client.invoke.mock.calls[0] as unknown[])[1]).toMatchObject({
      SolicitudCierrePuntoVenta: { codigoPuntoVenta: 3, cuis: 'BRANCH-CUIS' },
    });
    expect(prisma.siatCuis.updateMany).toHaveBeenCalled();
    expect(prisma.siatPointOfSale.update).toHaveBeenCalledWith({
      where: { id: 'pos-3' },
      data: { active: false, closed_at: NOW },
    });
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'SIAT_POS_CLOSED' }),
    );
  });

  it('lists each point of sale with its CUFD status (never the codes)', async () => {
    const { service, prisma, codes } = setup();
    prisma.siatPointOfSale.findMany.mockResolvedValue([
      {
        id: 'pos-3',
        branch_id: 'br-0',
        codigo_punto_venta: 3,
        tipo_punto_venta: 5,
        name: 'Caja 3',
        active: true,
        closed_at: null,
        branch: { codigo_sucursal: 0 },
        _count: { shifts: 1 },
      },
    ] as never);
    codes.status.mockResolvedValue({
      state: 'valid',
      validUntil: NOW,
      daysLeft: 300,
    });

    const [row] = await service.list();

    expect(row.cufd).toEqual({
      state: 'valid',
      validUntil: NOW,
      minutesLeft: 60,
    });
  });

  it('audits a CUFD issued on an admin request, without its codes', async () => {
    const { service, cufd, audit } = setup();

    await service.ensureCufd('pos-3', true, 'admin');

    expect(cufd.ensureCufd).toHaveBeenCalledWith('pos-3', {
      source: 'ON_DEMAND',
      force: true,
      userId: 'admin',
    });
    expect(audit.create).toHaveBeenCalledWith({
      userId: 'admin',
      event: 'SIAT_CUFD_REQUESTED',
      metadata: {
        pointOfSaleId: 'pos-3',
        codigoSucursal: 0,
        codigoPuntoVenta: 3,
        forced: true,
        validUntil: NOW.toISOString(),
      },
    });
  });

  it('does not audit when the stored CUFD was returned', async () => {
    const { service, cufd, audit } = setup();
    cufd.ensureCufd.mockResolvedValue({
      ...(await cufd.ensureCufd()),
      source: 'stored',
    });

    await service.ensureCufd('pos-3', false, 'admin');

    expect(audit.create).not.toHaveBeenCalled();
  });

  it('refuses to close an active (not retired) point of sale', async () => {
    const { service, prisma } = setup();
    prisma.siatPointOfSale.findUnique.mockResolvedValue({
      id: 'pos-3',
      codigo_punto_venta: 3,
      active: true,
      closed_at: null,
      branch: { codigo_sucursal: 0 },
    });

    await expect(service.close('pos-3', 'admin')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
