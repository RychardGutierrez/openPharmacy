import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { AuditModule } from '../../common/audit/audit.module';
import { EncryptionService } from './encryption.service';
import { LogoStorageService } from './logo-storage.service';

@Module({
  imports: [AuditModule],
  controllers: [ConfigController],
  providers: [ConfigService, EncryptionService, LogoStorageService],
  exports: [ConfigService],
})
export class ConfigModule {}
