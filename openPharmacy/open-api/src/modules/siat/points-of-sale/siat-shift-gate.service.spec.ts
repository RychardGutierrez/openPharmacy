import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { SiatUnavailableError } from '../client/siat-errors';
import type { SiatCodesService } from '../codes/siat-codes.service';
import { SiatShiftGate } from './siat-shift-gate.service';

function setup(options: {
  enabled: boolean;
  candidates?: string[];
  found?: boolean;
  cuis?: 'valid' | 'renew' | 'expired' | 'missing' | Error;
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
  const gate = new SiatShiftGate(
    prisma as unknown as PrismaService,
    codes as unknown as SiatCodesService,
  );
  return { gate, prisma, codes };
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
