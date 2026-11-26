import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { SiatUnavailableError } from '../client/siat-errors';
import type { SiatCodesService } from '../codes/siat-codes.service';
import type { SiatCufdService } from '../codes/siat-cufd.service';
import { SiatShiftGate } from './siat-shift-gate.service';

function setup(options: {
  enabled: boolean;
  candidates?: string[];
  found?: boolean;
  cuis?: 'valid' | 'renew' | 'expired' | 'missing' | Error;
  cufd?: 'valid' | 'rotate' | 'stale' | 'expired' | 'missing' | Error;
}) {
  const prisma = {
    siatPointOfSale: {
      findFirst: jest.fn(() =>
        Promise.resolve(options.found === false ? null : { id: 'pos-chosen' }),
      ),
      findMany: jest.fn(() =>
        Promise.resolve(
          (options.candidates ?? ['pos-1']).map((id) => ({ id })),
        ),
      ),
    },
  };
  const codes = {
    siatEnabled: jest.fn(() => Promise.resolve(options.enabled)),
    ensureCuis: jest.fn(() =>
      options.cuis instanceof Error
        ? Promise.reject(options.cuis)
        : Promise.resolve({ state: options.cuis ?? 'valid' }),
    ),
  };
  const cufd = {
    ensureCufd: jest.fn(() =>
      options.cufd instanceof Error
        ? Promise.reject(options.cufd)
        : Promise.resolve({ state: options.cufd ?? 'valid' }),
    ),
  };
  const gate = new SiatShiftGate(
    prisma as unknown as PrismaService,
    codes as unknown as SiatCodesService,
    cufd as unknown as SiatCufdService,
  );
  return { gate, prisma, codes, cufd };
}

describe('SiatShiftGate (SIAT-05 acceptance: a shift opens only on a PoS with a valid CUIS)', () => {
  it('SIAT disabled: uses the single active PoS and never asks for a CUIS', async () => {
    const { gate, codes } = setup({ enabled: false });

    await expect(gate.resolvePointOfSale(undefined, 'u1')).resolves.toBe(
      'pos-1',
    );
    expect(codes.ensureCuis).not.toHaveBeenCalled();
  });

  it('SIAT disabled: opens without a PoS when none or several exist', async () => {
    await expect(
      setup({ enabled: false, candidates: [] }).gate.resolvePointOfSale(
        undefined,
        'u1',
      ),
    ).resolves.toBeNull();
    await expect(
      setup({ enabled: false, candidates: ['a', 'b'] }).gate.resolvePointOfSale(
        undefined,
        'u1',
      ),
    ).resolves.toBeNull();
  });

  it('SIAT enabled: requires a choice among several PoS', async () => {
    const { gate } = setup({ enabled: true, candidates: ['a', 'b'] });

    await expect(
      gate.resolvePointOfSale(undefined, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('SIAT enabled: refuses when no PoS exists', async () => {
    const { gate } = setup({ enabled: true, candidates: [] });

    await expect(
      gate.resolvePointOfSale(undefined, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an unknown or inactive PoS', async () => {
    const { gate } = setup({ enabled: false, found: false });

    await expect(gate.resolvePointOfSale('bad', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('SIAT enabled: accepts the chosen PoS when its CUIS is usable (even in the renewal window)', async () => {
    const { gate, codes } = setup({ enabled: true, cuis: 'renew' });

    await expect(gate.resolvePointOfSale('pos-chosen', 'u1')).resolves.toBe(
      'pos-chosen',
    );
    expect(codes.ensureCuis).toHaveBeenCalledWith('pos-chosen', {
      userId: 'u1',
    });
  });

  it.each([['expired'], ['missing']] as const)(
    'SIAT enabled: refuses a PoS whose CUIS is %s',
    async (cuis) => {
      const { gate } = setup({ enabled: true, cuis });

      await expect(
        gate.resolvePointOfSale('pos-chosen', 'u1'),
      ).rejects.toBeInstanceOf(ConflictException);
    },
  );

  it('SIAT enabled: refuses when no CUIS exists and SIAT is unreachable', async () => {
    const { gate } = setup({
      enabled: true,
      cuis: new SiatUnavailableError('down', 'not-sent'),
    });

    await expect(
      gate.resolvePointOfSale(undefined, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('SiatShiftGate (SIAT-06: a shift opens only with a usable CUFD)', () => {
  it('SIAT enabled: asks for a CUFD on demand once the CUIS is usable', async () => {
    const { gate, cufd } = setup({ enabled: true });

    await expect(gate.resolvePointOfSale('pos-chosen', 'u1')).resolves.toBe(
      'pos-chosen',
    );
    expect(cufd.ensureCufd).toHaveBeenCalledWith('pos-chosen', {
      source: 'ON_DEMAND',
      userId: 'u1',
    });
  });

  it.each([['rotate'], ['stale']] as const)(
    'SIAT enabled: accepts a stored CUFD that is still valid (%s) when SIAT could not renew it',
    async (state) => {
      const { gate } = setup({ enabled: true, cufd: state });

      await expect(gate.resolvePointOfSale('pos-chosen', 'u1')).resolves.toBe(
        'pos-chosen',
      );
    },
  );

  it.each([['expired'], ['missing']] as const)(
    'SIAT enabled: refuses when the CUFD is %s',
    async (state) => {
      const { gate } = setup({ enabled: true, cufd: state });

      await expect(
        gate.resolvePointOfSale('pos-chosen', 'u1'),
      ).rejects.toMatchObject({
        response: { code: 'SIAT_POS_NOT_READY' },
      });
    },
  );

  it('SIAT enabled: refuses when no CUFD exists and SIAT is unreachable', async () => {
    const { gate } = setup({
      enabled: true,
      cufd: new SiatUnavailableError('down', 'not-sent'),
    });

    await expect(
      gate.resolvePointOfSale('pos-chosen', 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('never asks for a CUFD when the CUIS is not usable or SIAT is disabled', async () => {
    const blocked = setup({ enabled: true, cuis: 'expired' });
    await expect(
      blocked.gate.resolvePointOfSale('pos-chosen', 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(blocked.cufd.ensureCufd).not.toHaveBeenCalled();

    const disabled = setup({ enabled: false });
    await disabled.gate.resolvePointOfSale(undefined, 'u1');
    expect(disabled.cufd.ensureCufd).not.toHaveBeenCalled();
  });
});
