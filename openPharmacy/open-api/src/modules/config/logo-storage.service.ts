import { Injectable } from '@nestjs/common';
import { ConfigService as EnvConfigService } from '@nestjs/config';
import { mkdir, writeFile, open } from 'fs/promises';
import { basename, join } from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

@Injectable()
export class LogoStorageService {
  private readonly directory: string;

  constructor(config: EnvConfigService) {
    this.directory = config.get<string>('app.uploadDir', join(process.cwd(), 'uploads'));
  }

  async save(file: Express.Multer.File): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const filename = `${randomUUID()}.png`;
    const output = join(this.directory, filename);
    const normalized = await sharp(file.buffer)
      .resize({ width: 576, height: 300, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .grayscale()
      .png({ compressionLevel: 9 })
      .toBuffer();
    await writeFile(output, normalized, { flag: 'wx' });
    return basename(output);
  }

  async read(filename: string): Promise<Buffer> {
    const safeFilename = basename(filename);
    const handle = await open(join(this.directory, safeFilename), 'r');
    try {
      return handle.readFile();
    } finally {
      await handle.close();
    }
  }
}
