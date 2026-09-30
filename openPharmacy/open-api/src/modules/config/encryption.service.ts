import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService as EnvConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

@Injectable()
export class EncryptionService {
  private readonly rawKey: string;

  constructor(private readonly config: EnvConfigService) {
    this.rawKey = config.get<string>('app.configEncryptionKey', '');
  }

  encrypt(value: string): string {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  decrypt(value: string): string {
    const key = this.getKey();
    const [version, ivText, tagText, ciphertextText] = value.split('.');
    if (version !== VERSION || !ivText || !tagText || !ciphertextText) {
      throw new InternalServerErrorException('Invalid encrypted configuration value');
    }
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getKey(): Buffer {
    if (!this.rawKey) {
      throw new InternalServerErrorException(
        'CONFIG_ENCRYPTION_KEY is required to use encrypted configuration',
      );
    }
    return createHash('sha256').update(this.rawKey).digest();
  }
}
