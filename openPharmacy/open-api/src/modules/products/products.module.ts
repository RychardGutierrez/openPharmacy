import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsRepository } from './repositories/products.repository';
import { ProductRulesService } from './product-rules.service';
import { ProductSinService } from './product-sin.service';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../../common/audit/audit.module';
import { SiatModule } from '../siat/siat.module';

@Module({
  imports: [AuditModule, ConfigModule, SiatModule],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    ProductsRepository,
    ProductRulesService,
    ProductSinService,
  ],
  exports: [ProductsService, ProductRulesService, ProductSinService],
})
export class ProductsModule {}
