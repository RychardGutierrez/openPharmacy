import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as Auth from '../auth/interfaces/jwt-payload.interface';
import type { RequestMetadata } from '../users/users.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import * as CreateDto from './dto/create-purchase-order.dto';
import { LastSupplierCostQueryDto } from './dto/last-supplier-cost-query.dto';
import * as ReceiveDto from './dto/receive-purchase-order.dto';
import { PurchaseOrderListQueryDto } from './dto/purchase-order-list-query.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';

const extractMetadata = (request: Request): RequestMetadata => ({
  ip:
    (request.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() ??
    request.ip ??
    request.socket?.remoteAddress ??
    null,
  userAgent: request.headers['user-agent'] ?? null,
});

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ medium: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a purchase order draft' })
  create(
    @Body() dto: CreateDto.CreatePurchaseOrderDto,
    @CurrentUser() user: Auth.AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.purchaseOrdersService.create(
      user.id,
      dto,
      extractMetadata(request),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List purchase orders' })
  findAll(@Query() query: PurchaseOrderListQueryDto) {
    return this.purchaseOrdersService.findAll({
      status: query.status,
      supplierId: query.supplierId,
      q: query.q?.trim() || undefined,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Get('last-cost')
  @ApiOperation({
    summary: 'Last unit cost paid to a supplier for a product',
  })
  lastCost(@Query() query: LastSupplierCostQueryDto) {
    return this.purchaseOrdersService.findLastSupplierCost(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a purchase order by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a PENDING purchase order' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: Auth.AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.purchaseOrdersService.update(
      user.id,
      id,
      dto,
      extractMetadata(request),
    );
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Submit a purchase order (PENDING -> ORDERED)' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Auth.AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.purchaseOrdersService.submit(
      user.id,
      id,
      extractMetadata(request),
    );
  }

  @Patch(':id/receive')
  @ApiOperation({ summary: 'Receive goods against a purchase order' })
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveDto.ReceivePurchaseOrderDto,
    @CurrentUser() user: Auth.AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.purchaseOrdersService.receive(
      user.id,
      id,
      dto,
      extractMetadata(request),
    );
  }
}
