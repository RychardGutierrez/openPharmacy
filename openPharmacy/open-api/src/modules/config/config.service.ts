import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CONFIG_KEYS,
  PHARMACY_INFO_KEYS,
  RECEIPT_SETTING_KEYS,
} from './config.keys';
import { EncryptionService } from './encryption.service';

export interface ConfigRequestMetadata {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  from: string;
}

export interface RuntimeSettings {
  pharmacy: Record<string, string>;
  receipt: Record<string, string>;
  inventory: {
    lowStock: number;
    expiryWarningDays: number;
  };
}

@Injectable()
export class ConfigService {
  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly audit?: AuditLogRepository,
    @Optional() private readonly encryption?: EncryptionService,
  ) {}

  async findAll(): Promise<Record<string, unknown>> {
    const rows = await this.getPrisma().config.findMany();
    return Object.fromEntries(
      rows
        .filter((row) => !row.encrypted)
        .map((row) => [row.key, this.publicValue(row.key, this.decode(row.value))]),
    );
  }

  async findOne(key: string): Promise<unknown> {
    const definition = CONFIG_KEYS[key];
    if (!definition) throw new NotFoundException(`Unknown configuration key: ${key}`);
    const row = await this.getPrisma().config.findUnique({ where: { key } });
    if (!row) throw new NotFoundException(`Configuration key not found: ${key}`);
    if (row.encrypted) return undefined;
    return this.publicValue(key, this.decode(row.value));
  }

  async update(
    key: string,
    value: unknown,
    metadata: ConfigRequestMetadata,
  ): Promise<Record<string, unknown>> {
    return this.updateValues({ [key]: value }, metadata);
  }

  async updateValues(
    values: Record<string, unknown>,
    metadata: ConfigRequestMetadata,
  ): Promise<Record<string, unknown>> {
    const entries = Object.entries(values);
    if (entries.length === 0) {
      throw new BadRequestException('Debes ingresar al menos un valor de configuración');
    }
    for (const [key, value] of entries) this.validateValue(key, value);

    const prisma = this.getPrisma();
    const audit = this.getAudit();
    const changedKeys = entries.map(([key]) => key);

    await prisma.$transaction(async (tx) => {
      const previous = await tx.config.findMany({
        where: { key: { in: changedKeys } },
      });
      const previousByKey = new Map(previous.map((row) => [row.key, row]));

      for (const [key, value] of entries) {
        const definition = CONFIG_KEYS[key];
        const serialized = this.encode(value, definition.encrypted === true);
        await tx.config.upsert({
          where: { key },
          create: {
            key,
            value: serialized,
            encrypted: definition.encrypted === true,
            updated_by: metadata.userId,
          },
          update: {
            value: serialized,
            encrypted: definition.encrypted === true,
            updated_by: metadata.userId,
          },
        });
      }

      await audit.createInTx(tx, {
        userId: metadata.userId,
        event: 'CONFIG_UPDATED',
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        metadata: {
          keys: changedKeys,
          changes: Object.fromEntries(
            entries.map(([key, value]) => {
              const definition = CONFIG_KEYS[key];
              return [
                key,
                {
                  old: definition.encrypted
                    ? '[REDACTED]'
                    : this.decode(previousByKey.get(key)?.value ?? null),
                  new: definition.encrypted ? '[REDACTED]' : value,
                },
              ];
            }),
          ),
        } as Prisma.InputJsonValue,
      });
    });

    return this.findAll();
  }

  async getPharmacyInfo(): Promise<Record<string, string>> {
    return this.getSafeStringSettings(PHARMACY_INFO_KEYS);
  }

  async getReceiptSettings(): Promise<Record<string, string>> {
    return this.getSafeStringSettings(RECEIPT_SETTING_KEYS);
  }

  async getRuntimeSettings(): Promise<RuntimeSettings> {
    const rows = await this.getPrisma().config.findMany({
      where: {
        key: {
          in: [
            ...PHARMACY_INFO_KEYS,
            ...RECEIPT_SETTING_KEYS,
            'INVENTORY_LOW_STOCK',
            'EXPIRY_WARNING_DAYS',
          ],
        },
      },
    });
    const values = new Map(
      rows
        .filter((row) => !row.encrypted)
        .map((row) => [row.key, this.publicValue(row.key, this.decode(row.value))]),
    );
    return {
      pharmacy: Object.fromEntries(
        PHARMACY_INFO_KEYS.map((key) => [key, String(values.get(key) ?? '')]),
      ),
      receipt: Object.fromEntries(
        RECEIPT_SETTING_KEYS.map((key) => [key, String(values.get(key) ?? '')]),
      ),
      inventory: {
        lowStock: Number(values.get('INVENTORY_LOW_STOCK') ?? 0),
        expiryWarningDays: Number(values.get('EXPIRY_WARNING_DAYS') ?? 60),
      },
    };
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const row = await this.getPrisma().config.findUnique({ where: { key } });
    if (!row || row.encrypted) return fallback;
    const value = this.publicValue(key, this.decode(row.value));
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  async getSmtpSettings(): Promise<SmtpSettings | null> {
    const rows = await this.getPrisma().config.findMany({
      where: { key: { in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_SECURE', 'SMTP_FROM'] } },
    });
    const values = new Map(rows.map((row) => [row.key, this.decodeStored(row.value, row.encrypted)]));
    const host = values.get('SMTP_HOST');
    const pass = values.get('SMTP_PASSWORD');
    if (typeof host !== 'string' || host.length === 0 || typeof pass !== 'string' || pass.length === 0) {
      return null;
    }
    return {
      host,
      port: Number(values.get('SMTP_PORT') ?? 587),
      user: String(values.get('SMTP_USER') ?? ''),
      pass,
      secure: values.get('SMTP_SECURE') === true || values.get('SMTP_SECURE') === 'true',
      from: String(values.get('SMTP_FROM') ?? 'noreply@openpharmacy.com'),
    };
  }

  private async getSafeStringSettings(keys: readonly string[]): Promise<Record<string, string>> {
    const rows = await this.getPrisma().config.findMany({ where: { key: { in: [...keys] } } });
    return Object.fromEntries(
      rows
        .filter((row) => !row.encrypted)
        .map((row) => [row.key, String(this.decode(row.value))]),
    );
  }

  private validateValue(key: string, value: unknown): void {
    const definition = CONFIG_KEYS[key];
    if (!definition) throw new BadRequestException(`Unknown configuration key: ${key}`);
    if (definition.encrypted && value === '') {
      throw new BadRequestException({ code: 'CONFIG_SECRET_REQUIRED', message: 'La contraseña SMTP es obligatoria' });
    }
    if (definition.required && (typeof value !== 'string' || value.trim().length === 0)) {
      throw new BadRequestException('El nombre de la farmacia es obligatorio');
    }
    if (definition.type === 'string' && typeof value !== 'string') {
      throw new BadRequestException('El valor ingresado no es válido');
    }
    if (definition.type === 'integer' && (!Number.isInteger(value) || (definition.min !== undefined && (value as number) < definition.min) || (definition.max !== undefined && (value as number) > definition.max))) {
      throw new BadRequestException('Debes ingresar un número entero válido');
    }
    if (definition.type === 'boolean' && typeof value !== 'boolean') {
      throw new BadRequestException('El valor booleano no es válido');
    }
  }

  private encode(value: unknown, encrypted: boolean): string {
    const plain = JSON.stringify(value);
    if (plain === undefined) throw new BadRequestException('Configuration value cannot be undefined');
    if (!encrypted) return plain;
    if (!this.encryption) throw new BadRequestException('Configuration encryption is unavailable');
    return this.encryption.encrypt(plain);
  }

  private decodeStored(value: string, encrypted: boolean): unknown {
    if (!encrypted) return this.decode(value);
    if (!this.encryption) throw new BadRequestException('Configuration encryption is unavailable');
    return this.decode(this.encryption.decrypt(value));
  }

  private decode(value: string | null): unknown {
    if (value === null) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private publicValue(key: string, value: unknown): unknown {
    const definition = CONFIG_KEYS[key];
    if (!definition) return value;
    if (definition.type === 'string') return value === null || value === undefined ? '' : String(value);
    if (definition.type === 'integer') return Number(value);
    if (definition.type === 'boolean') return value === true || value === 'true';
    return value;
  }

  private getPrisma(): PrismaService {
    if (!this.prisma) throw new Error('PrismaService is not configured');
    return this.prisma;
  }

  private getAudit(): AuditLogRepository {
    if (!this.audit) throw new Error('AuditLogRepository is not configured');
    return this.audit;
  }
}
