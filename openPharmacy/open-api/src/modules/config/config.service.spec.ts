import { BadRequestException } from '@nestjs/common';
import { ConfigService } from './config.service';

function buildService() {
  const rows = [
    { key: 'PHARMACY_NAME', value: JSON.stringify('Open Pharmacy'), encrypted: false },
    { key: 'SMTP_PASSWORD', value: 'ciphertext', encrypted: true },
  ];
  const tx = {
    config: {
      findMany: jest.fn().mockResolvedValue(rows),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    config: {
      findMany: jest.fn().mockResolvedValue(rows),
      findUnique: jest.fn().mockResolvedValue(rows[0]),
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const audit = { createInTx: jest.fn().mockResolvedValue(undefined) };
  const encryption = {
    encrypt: jest.fn().mockReturnValue('ciphertext'),
    decrypt: jest.fn().mockReturnValue(JSON.stringify('smtp-secret')),
  };
  const service = new ConfigService(prisma as never, audit as never, encryption as never);
  return { service, prisma, tx, audit, encryption };
}

describe('ConfigService', () => {
  it('omits encrypted values from normal reads', async () => {
    const { service } = buildService();

    await expect(service.findAll()).resolves.toEqual({ PHARMACY_NAME: 'Open Pharmacy' });
  });

  it('normalizes legacy numeric values according to the configuration contract', async () => {
    const { service, prisma } = buildService();
    prisma.config.findMany.mockResolvedValueOnce([
      { key: 'PHARMACY_NIT', value: '1023456789012', encrypted: false },
    ]);

    await expect(service.findAll()).resolves.toEqual({ PHARMACY_NIT: '1023456789012' });
  });

  it('builds the safe runtime settings consumed by authenticated users', async () => {
    const { service, prisma } = buildService();
    prisma.config.findMany.mockResolvedValueOnce([
      { key: 'PHARMACY_NAME', value: JSON.stringify('Central Pharmacy'), encrypted: false },
      { key: 'RECEIPT_FOOTER', value: JSON.stringify('Thank you'), encrypted: false },
      { key: 'INVENTORY_LOW_STOCK', value: JSON.stringify(8), encrypted: false },
      { key: 'EXPIRY_WARNING_DAYS', value: JSON.stringify(45), encrypted: false },
    ]);

    await expect(service.getRuntimeSettings()).resolves.toEqual({
      pharmacy: {
        PHARMACY_NAME: 'Central Pharmacy',
        PHARMACY_NIT: '',
        PHARMACY_ADDRESS: '',
        PHARMACY_PHONE: '',
        PHARMACY_PROPRIETOR: '',
      },
      receipt: {
        RECEIPT_FOOTER: 'Thank you',
        RECEIPT_PAPER_WIDTH: '',
        RECEIPT_LOGO_PATH: '',
      },
      inventory: { lowStock: 8, expiryWarningDays: 45 },
    });
  });

  it('updates values and writes one audit row in the same transaction', async () => {
    const { service, prisma, tx, audit, encryption } = buildService();

    await service.updateValues(
      { PHARMACY_NAME: 'New Pharmacy', SMTP_PASSWORD: 'new-secret' },
      { userId: 'admin-1', ip: '127.0.0.1', userAgent: 'test' },
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.config.upsert).toHaveBeenCalledTimes(2);
    expect(encryption.encrypt).toHaveBeenCalledWith(JSON.stringify('new-secret'));
    expect(audit.createInTx).toHaveBeenCalledTimes(1);
    expect(audit.createInTx.mock.calls[0][1].metadata).toMatchObject({
      keys: ['PHARMACY_NAME', 'SMTP_PASSWORD'],
      changes: { SMTP_PASSWORD: { old: '[REDACTED]', new: '[REDACTED]' } },
    });
  });

  it('rejects an empty encrypted value', async () => {
    const { service } = buildService();

    await expect(
      service.update('SMTP_PASSWORD', '', { userId: 'admin-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
