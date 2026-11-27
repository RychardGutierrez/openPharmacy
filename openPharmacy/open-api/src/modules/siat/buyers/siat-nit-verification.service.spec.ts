import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuditLogRepository } from '../../../common/audit/audit-log.repository';
import type { PrismaService } from '../../../prisma/prisma.service';
import { SiatUnavailableError } from '../client/siat-errors';
import { SIAT_OPERATIONS } from '../client/siat-operations';
import type { SiatResult } from '../client/siat-soap-envelope';
import type { SiatSoapClient } from '../client/siat-soap.client';
import { fixedSiatClock } from '../codes/siat-clock';
import type { SiatCodesService } from '../codes/siat-codes.service';
import {
  NIT_INVALID_TTL_MS,
  NIT_VALID_TTL_MS,
  SiatNitVerificationService,
} from './siat-nit-verification.service';

const NOW = new Date('2026-11-27T15:00:00.000Z');
const NIT = '1020304022';

interface Row {
  nit: string;
  valid: boolean;
  codigo_estado: number | null;
  messages: unknown;
  verified_at: Date;
}

function siatAnswer(valid: boolean): SiatResult {
  return valid
    ? {
        transaccion: true,
        codigoEstado: 986,
        mensajes: [{ codigo: 986, descripcion: 'NIT ACTIVO' }],
        payload: {},
      }
    : {
        transaccion: false,
        codigoEstado: 994,
        mensajes: [{ codigo: 994, descripcion: 'NIT INEXISTENTE' }],
        payload: {},
      };
}

function setup(
  options: {
    valid?: boolean;
    shift?: unknown;
    invoke?: jest.Mock;
  } = {},
) {
  const rows = new Map<string, Row>();
  const clock = fixedSiatClock(NOW);
  const prisma = {
    siatNitVerification: {
      findUnique: jest.fn(({ where }: { where: { nit: string } }) =>
        Promise.resolve(rows.get(where.nit) ?? null),
      ),
      upsert: jest.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { nit: string };
          create: Row;
          update: Omit<Row, 'nit'>;
        }) => {
          const existing = rows.get(where.nit);
          const row = existing ? { ...existing, ...update } : create;
          rows.set(where.nit, row);
          return Promise.resolve(row);
        },
      ),
    },
    shift: {
      findFirst: jest.fn(() =>
        Promise.resolve(
          options.shift !== undefined
            ? options.shift
            : {
                point_of_sale: {
                  id: 'pos-1',
                  branch: { codigo_sucursal: 0 },
                },
              },
        ),
      ),
    },
  };
  const client = {
    invoke:
      options.invoke ??
      jest.fn(() => Promise.resolve(siatAnswer(options.valid ?? true))),
  };
  const codes = {
    identity: jest.fn(() =>
      Promise.resolve({
        nit: '1234567',
        codigoSistema: 'SYS',
        codigoModalidad: 2,
      }),
    ),
    cuisCode: jest.fn(() => Promise.resolve('CUIS-1')),
  };
  const audit = { create: jest.fn(() => Promise.resolve()) };
  const service = new SiatNitVerificationService(
    prisma as unknown as PrismaService,
    client as unknown as SiatSoapClient,
    codes as unknown as SiatCodesService,
    audit as unknown as AuditLogRepository,
    clock,
  );
  return { service, prisma, client, codes, audit, clock, rows };
}

describe('SiatNitVerificationService (SIAT-10)', () => {
  it('calls verificarNit with the open-shift CUIS and branch, and audits it', async () => {
    const { service, client, codes, audit } = setup();

    const result = await service.verify(` ${NIT} `, 'user-1');

    expect(result).toEqual({
      nit: NIT,
      valid: true,
      cached: false,
      verifiedAt: NOW,
      codigoEstado: 986,
      messages: [{ codigo: 986, descripcion: 'NIT ACTIVO' }],
    });
    expect(codes.cuisCode).toHaveBeenCalledWith('pos-1', { userId: 'user-1' });
    expect(client.invoke).toHaveBeenCalledWith(
      SIAT_OPERATIONS.FacturacionCodigos.verificarNit,
      {
        SolicitudVerificarNit: {
          codigoModalidad: 2,
          codigoSistema: 'SYS',
          codigoSucursal: 0,
          cuis: 'CUIS-1',
          nit: '1234567',
          nitParaVerificacion: NIT,
        },
      },
      { pointOfSaleId: 'pos-1', metadata: { purpose: 'buyer-nit' } },
    );
    expect(audit.create).toHaveBeenCalledWith({
      userId: 'user-1',
      event: 'SIAT_NIT_VERIFIED',
      metadata: {
        nit: NIT,
        valid: true,
        codigoEstado: 986,
        codes: [986],
        pointOfSaleId: 'pos-1',
      },
    });
  });

  it('serves a valid answer from the cache for 24 h, with one SIAT call', async () => {
    const { service, client, clock, audit } = setup();

    await service.verify(NIT, 'user-1');
    clock.set(new Date(NOW.getTime() + NIT_VALID_TTL_MS - 1));
    const second = await service.verify(NIT, 'user-1');

    expect(second).toMatchObject({
      valid: true,
      cached: true,
      verifiedAt: NOW,
    });
    expect(client.invoke).toHaveBeenCalledTimes(1);
    expect(audit.create).toHaveBeenCalledTimes(1);
  });

  it('asks SIAT again once the 24 h have passed', async () => {
    const { service, client, clock } = setup();

    await service.verify(NIT, 'user-1');
    clock.set(new Date(NOW.getTime() + NIT_VALID_TTL_MS));
    const again = await service.verify(NIT, 'user-1');

    expect(again.cached).toBe(false);
    expect(client.invoke).toHaveBeenCalledTimes(2);
  });

  it('never serves an invalid answer from the cache', async () => {
    const { service, client } = setup({ valid: false });

    const first = await service.verify(NIT, 'user-1');
    const second = await service.verify(NIT, 'user-1');

    expect(first).toMatchObject({ valid: false, cached: false });
    expect(second.cached).toBe(false);
    expect(client.invoke).toHaveBeenCalledTimes(2);
  });

  it('does not store anything when SIAT fails', async () => {
    const invoke = jest.fn(() =>
      Promise.reject(new SiatUnavailableError('down', 'not-sent')),
    );
    const { service, prisma, audit } = setup({ invoke });

    await expect(service.verify(NIT, 'user-1')).rejects.toBeInstanceOf(
      SiatUnavailableError,
    );
    expect(prisma.siatNitVerification.upsert).not.toHaveBeenCalled();
    expect(audit.create).not.toHaveBeenCalled();
  });

  it.each(['', 'abc', '12-34', '0', '000', '99003', '1'.repeat(21)])(
    'refuses %p with no SIAT call',
    async (nit) => {
      const { service, client } = setup();
      await expect(service.verify(nit, 'user-1')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(client.invoke).not.toHaveBeenCalled();
    },
  );

  it('requires an open shift with a SIAT point of sale', async () => {
    await expect(
      setup({ shift: null }).service.verify(NIT, 'user-1'),
    ).rejects.toThrow(ConflictException);
    const noPos = setup({ shift: { point_of_sale: null } });
    await expect(noPos.service.verify(NIT, 'user-1')).rejects.toMatchObject({
      response: { code: 'SIAT_SHIFT_WITHOUT_POS' },
    });
    expect(noPos.client.invoke).not.toHaveBeenCalled();
  });

  describe('lastCheck', () => {
    it('returns a failed answer for 30 minutes only', async () => {
      const { service, clock } = setup({ valid: false });
      await service.verify(NIT, 'user-1');

      expect(await service.lastCheck(NIT)).toEqual({ valid: false });
      clock.set(new Date(NOW.getTime() + NIT_INVALID_TTL_MS));
      expect(await service.lastCheck(NIT)).toBeNull();
    });

    it('returns a valid answer for 24 h', async () => {
      const { service, clock } = setup();
      await service.verify(NIT, 'user-1');

      clock.set(new Date(NOW.getTime() + NIT_INVALID_TTL_MS));
      expect(await service.lastCheck(NIT)).toEqual({ valid: true });
      clock.set(new Date(NOW.getTime() + NIT_VALID_TTL_MS));
      expect(await service.lastCheck(NIT)).toBeNull();
    });

    it('returns null for a NIT never checked', async () => {
      expect(await setup().service.lastCheck(NIT)).toBeNull();
    });
  });
});
