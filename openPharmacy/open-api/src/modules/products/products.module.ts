import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsRepository } from './repositories/products.repository';
import { ProductRulesService } from './product-rules.service';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository, ProductRulesService],
  exports: [ProductsService, ProductRulesService],
})
export class ProductsModule {}
