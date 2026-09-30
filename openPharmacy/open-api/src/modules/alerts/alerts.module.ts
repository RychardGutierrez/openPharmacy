import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { LotsModule } from '../lots/lots.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [LotsModule, ConfigModule],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
