import { Module } from '@nestjs/common';
import { SIAT_CONFIG, readSiatConfig } from './config/siat.config';
import { SiatSoapClient } from './client/siat-soap.client';
import {
  SIAT_TRANSPORT,
  SiatHttpTransport,
} from './client/siat-http-transport';
import { SIAT_REQUEST_LOG } from './client/siat-request-log';
import { SiatHealthService } from './client/siat-health.service';
import { PrismaSiatRequestLogSink } from './persistence/prisma-siat-request-log.sink';

/** `PrismaService` comes from the global `PrismaModule`. */
@Module({
  providers: [
    { provide: SIAT_CONFIG, useFactory: () => readSiatConfig() },
    { provide: SIAT_TRANSPORT, useClass: SiatHttpTransport },
    { provide: SIAT_REQUEST_LOG, useClass: PrismaSiatRequestLogSink },
    SiatSoapClient,
    SiatHealthService,
  ],
  exports: [SiatSoapClient, SiatHealthService],
})
export class SiatModule {}
