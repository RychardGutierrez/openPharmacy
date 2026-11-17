import { Module } from '@nestjs/common';
import { ConfigModule as PharmacyConfigModule } from '../config/config.module';
import { SIAT_CONFIG, readSiatConfig } from './config/siat.config';
import { SIAT_CREDENTIALS } from './config/siat-credentials';
import { ConfigSiatCredentialsSource } from './config/config-siat-credentials.source';
import { SiatSoapClient } from './client/siat-soap.client';
import {
  SIAT_TRANSPORT,
  SiatHttpTransport,
} from './client/siat-http-transport';
import { SIAT_REQUEST_LOG } from './client/siat-request-log';
import { SiatHealthService } from './client/siat-health.service';
import { PrismaSiatRequestLogSink } from './persistence/prisma-siat-request-log.sink';
import { PrismaSiatCuisStatusReader } from './persistence/prisma-siat-cuis-status.reader';
import { SiatSettingsController } from './settings/siat-settings.controller';
import { SiatSettingsService } from './settings/siat-settings.service';

/**
 * `PrismaService` comes from the global `PrismaModule`. Safe to import with no token configured:
 * SIAT calls then fail with `SiatConfigError` and the health check reports `not-configured`.
 */
@Module({
  imports: [PharmacyConfigModule],
  controllers: [SiatSettingsController],
  providers: [
    { provide: SIAT_CONFIG, useFactory: () => readSiatConfig() },
    { provide: SIAT_TRANSPORT, useClass: SiatHttpTransport },
    { provide: SIAT_REQUEST_LOG, useClass: PrismaSiatRequestLogSink },
    { provide: SIAT_CREDENTIALS, useClass: ConfigSiatCredentialsSource },
    SiatSoapClient,
    SiatHealthService,
    PrismaSiatCuisStatusReader,
    SiatSettingsService,
  ],
  exports: [SiatSoapClient, SiatHealthService, SIAT_CREDENTIALS],
})
export class SiatModule {}
