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
import { SiatInvoiceSequenceRepository } from './persistence/siat-invoice-sequence.repository';
import { SiatSettingsController } from './settings/siat-settings.controller';
import { SiatSettingsService } from './settings/siat-settings.service';
import { AuditModule } from '../../common/audit/audit.module';
import { SIAT_CLOCK } from './codes/siat-clock';
import { OffsetSiatClock } from './codes/siat-offset-clock';
import { SiatTimeSyncService } from './codes/siat-time-sync.service';
import { SiatCatalogSyncService } from './catalogs/siat-catalog-sync.service';
import { SiatCatalogsService } from './catalogs/siat-catalogs.service';
import { SiatCatalogsController } from './catalogs/siat-catalogs.controller';
import { SiatSyncJob } from './catalogs/siat-sync.job';
import { SiatCodesService } from './codes/siat-codes.service';
import { SiatCuisRenewalJob } from './codes/siat-cuis-renewal.job';
import { SiatCufdService } from './codes/siat-cufd.service';
import { SiatCufdJob } from './codes/siat-cufd.job';
import { SiatPointsOfSaleController } from './points-of-sale/siat-points-of-sale.controller';
import { SiatPointsOfSaleService } from './points-of-sale/siat-points-of-sale.service';
import { SiatShiftGate } from './points-of-sale/siat-shift-gate.service';
import { SiatBuyersController } from './buyers/siat-buyers.controller';
import { SiatBuyerService } from './buyers/siat-buyer.service';
import { SiatCustomersService } from './buyers/siat-customers.service';
import { SiatNitVerificationService } from './buyers/siat-nit-verification.service';

/**
 * `PrismaService` comes from the global `PrismaModule`. Safe to import with no token configured:
 * SIAT calls then fail with `SiatConfigError` and the health check reports `not-configured`.
 */
@Module({
  imports: [PharmacyConfigModule, AuditModule],
  controllers: [
    SiatSettingsController,
    SiatPointsOfSaleController,
    SiatCatalogsController,
    SiatBuyersController,
  ],
  providers: [
    OffsetSiatClock,
    { provide: SIAT_CLOCK, useExisting: OffsetSiatClock },
    SiatTimeSyncService,
    SiatCatalogSyncService,
    SiatCatalogsService,
    SiatSyncJob,
    SiatCodesService,
    SiatCuisRenewalJob,
    SiatCufdService,
    SiatCufdJob,
    SiatPointsOfSaleService,
    SiatShiftGate,
    SiatNitVerificationService,
    SiatBuyerService,
    SiatCustomersService,
    { provide: SIAT_CONFIG, useFactory: () => readSiatConfig() },
    { provide: SIAT_TRANSPORT, useClass: SiatHttpTransport },
    { provide: SIAT_REQUEST_LOG, useClass: PrismaSiatRequestLogSink },
    { provide: SIAT_CREDENTIALS, useClass: ConfigSiatCredentialsSource },
    SiatSoapClient,
    SiatHealthService,
    PrismaSiatCuisStatusReader,
    SiatInvoiceSequenceRepository,
    SiatSettingsService,
  ],
  exports: [
    SiatSoapClient,
    SiatHealthService,
    SIAT_CREDENTIALS,
    SiatCodesService,
    SiatCufdService,
    SiatShiftGate,
    SiatCatalogsService,
    SiatCatalogSyncService,
    SiatTimeSyncService,
    OffsetSiatClock,
    SiatInvoiceSequenceRepository,
    SiatBuyerService,
    SiatCustomersService,
    SiatNitVerificationService,
  ],
})
export class SiatModule {}
