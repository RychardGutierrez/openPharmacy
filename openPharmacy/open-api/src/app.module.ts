import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { BillingModule } from './modules/billing/billing.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { SedesModule } from './modules/sedes/sedes.module';
import { ConfigModule as PharmacyConfigModule } from './modules/config/config.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { SalesModule } from './modules/sales/sales.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { InventoryMovementsModule } from './modules/inventory-movements/inventory-movements.module';
import { LotsModule } from './modules/lots/lots.module';
import { ProductsModule } from './modules/products/products.module';
import {
  appConfig,
  authConfig,
  throttleConfig,
} from './common/config/configuration';
import { validationSchema } from './common/config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, authConfig, throttleConfig],
      validationSchema,
      validationOptions: { abortEarly: true, allowUnknown: true },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    LotsModule,
    InventoryMovementsModule,
    ShiftsModule,
    SalesModule,
    PrescriptionsModule,
    ReturnsModule,
    SuppliersModule,
    PurchaseOrdersModule,
    DashboardModule,
    ReportsModule,
    PharmacyConfigModule,
    SedesModule,
    AlertsModule,
    BillingModule,
    DoctorsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
