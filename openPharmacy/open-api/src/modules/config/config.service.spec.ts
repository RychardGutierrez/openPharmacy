import { BadRequestException, NotFoundException } from '@nestjs/common';
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
    isConfigured: jest.fn().mockReturnValue(true),
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

  describe('SIAT keys (SIAT-04)', () => {
    const metadata = { userId: 'admin-1' };

    it('hides SIAT keys from the generic reads', async () => {
      const { service, prisma } = buildService();
      prisma.config.findMany.mockResolvedValueOnce([
        { key: 'PHARMACY_NAME', value: JSON.stringify('Open Pharmacy'), encrypted: false },
        { key: 'SIAT_SYSTEM_CODE', value: JSON.stringify('ABC123'), encrypted: false },
        { key: 'SIAT_TOKEN', value: 'ciphertext', encrypted: true },
      ]);

      await expect(service.findAll()).resolves.toEqual({ PHARMACY_NAME: 'Open Pharmacy' });
      await expect(service.findOne('SIAT_SYSTEM_CODE')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects SIAT keys through the generic update, so the SIAT audit event cannot be skipped', async () => {
      const { service, prisma } = buildService();

      await expect(
        service.updateValues({ PHARMACY_NAME: 'X', SIAT_ENABLED: true }, metadata),
      ).rejects.toMatchObject({ response: { code: 'CONFIG_KEY_NOT_IN_GROUP' } });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('writes SIAT keys with SIAT_CONFIG_UPDATED, the token encrypted and redacted in the audit', async () => {
      const { service, tx, audit, encryption } = buildService();
      tx.config.findMany.mockResolvedValueOnce([]);

      await service.writeValues(
        { SIAT_TOKEN: 'tok-SECRET-999', SIAT_SYSTEM_CODE: 'ABC123' },
        metadata,
        'siat',
      );

      expect(encryption.encrypt).toHaveBeenCalledWith(JSON.stringify('tok-SECRET-999'));
      const upserts = tx.config.upsert.mock.calls as Array<
        [{ where: { key: string }; create: { value: string; encrypted: boolean } }]
      >;
      const tokenRow = upserts.find(([arg]) => arg.where.key === 'SIAT_TOKEN')?.[0];
      expect(tokenRow?.create).toMatchObject({ value: 'ciphertext', encrypted: true });
      const [[, record]] = audit.createInTx.mock.calls as Array<
        [unknown, { event: string; metadata: { changes: Record<string, unknown> } }]
      >;
      expect(record.event).toBe('SIAT_CONFIG_UPDATED');
      expect(JSON.stringify(record)).not.toContain('tok-SECRET-999');
      expect(record.metadata.changes.SIAT_TOKEN).toEqual({ old: '[REDACTED]', new: '[REDACTED]' });
    });

    it('reports a missing CONFIG_ENCRYPTION_KEY clearly before writing a secret', async () => {
      const { service, prisma, encryption } = buildService();
      encryption.isConfigured.mockReturnValue(false);

      await expect(
        service.writeValues({ SIAT_TOKEN: 'tok' }, metadata, 'siat'),
      ).rejects.toMatchObject({
        status: 503,
        response: { code: 'CONFIG_ENCRYPTION_KEY_MISSING' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects general keys in the SIAT group', async () => {
      const { service } = buildService();

      await expect(
        service.writeValues({ PHARMACY_NAME: 'X' }, metadata, 'siat'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('validates SIAT values with their own messages', async () => {
      const { service } = buildService();

      await expect(
        service.writeValues({ SIAT_MODALITY: 1 }, metadata, 'siat'),
      ).rejects.toThrow('Computarizada en Línea');
      await expect(
        service.writeValues({ SIAT_TOKEN_EXPIRES_AT: '15/11/2027' }, metadata, 'siat'),
      ).rejects.toThrow('AAAA-MM-DD');
    });

    it('requires a digits-only PHARMACY_NIT, because SIAT sends it as the NIT', async () => {
      const { service } = buildService();

      await expect(
        service.updateValues({ PHARMACY_NIT: '1023-456' }, metadata),
      ).rejects.toThrow('solo dígitos');
    });

    it('refuses to clear PHARMACY_NIT while SIAT invoicing is enabled', async () => {
      const { service, tx } = buildService();
      tx.config.findMany.mockResolvedValueOnce([
        { key: 'SIAT_ENABLED', value: 'true', encrypted: false },
      ]);

      await expect(
        service.updateValues({ PHARMACY_NIT: '' }, metadata),
      ).rejects.toMatchObject({ response: { code: 'CONFIG_NIT_REQUIRED_BY_SIAT' } });
      expect(tx.config.upsert).not.toHaveBeenCalled();
    });

    it('returns stored values with secrets decrypted, for internal use', async () => {
      const { service, prisma } = buildService();
      prisma.config.findMany.mockResolvedValueOnce([
        { key: 'SIAT_TOKEN', value: 'ciphertext', encrypted: true },
        { key: 'PHARMACY_NIT', value: JSON.stringify('1023456789012'), encrypted: false },
      ]);

      await expect(
        service.getStoredValues(['SIAT_TOKEN', 'PHARMACY_NIT']),
      ).resolves.toEqual({ SIAT_TOKEN: 'smtp-secret', PHARMACY_NIT: '1023456789012' });
    });
  });

  it('rejects an empty encrypted value', async () => {
    const { service } = buildService();

    await expect(
      service.update('SMTP_PASSWORD', '', { userId: 'admin-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
