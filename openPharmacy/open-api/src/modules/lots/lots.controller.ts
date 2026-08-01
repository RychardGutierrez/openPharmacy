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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { RequestMetadata } from '../users/users.service';
import type { Request } from 'express';
import { Req } from '@nestjs/common';
import { LotsService } from './lots.service';
import { FefoService } from './fefo.service';
import { CreateLotDto } from './dto/create-lot.dto';
import { UpdateLotDto } from './dto/update-lot.dto';
import { VoidLotDto } from './dto/void-lot.dto';
import { LotsListQueryDto } from './dto/lots-list-query.dto';
import type { LotResponseDto } from './dto/lot-response.dto';
import type { ExpiryDashboardResponseDto } from './dto/expiry-dashboard-response.dto';
import type { LotTraceResponseDto } from './dto/lot-trace-response.dto';
import { DeductStockDto } from './dto/deduct-stock.dto';
import type { DeductResult } from './fefo.service';

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

@ApiTags('lots')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller('lots')
export class LotsController {
  constructor(
    private readonly lotsService: LotsService,
    private readonly fefoService: FefoService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ medium: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new lot' })
  create(
    @Body() dto: CreateLotDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<LotResponseDto> {
    return this.lotsService.create(dto, user.id, extractMetadata(request));
  }

  @Get()
  @ApiOperation({ summary: 'List all lots (paginated, filterable)' })
  findAll(@Query() query: LotsListQueryDto): Promise<{
    data: LotResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    return this.lotsService.findAll(query);
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'List lots by product' })
  findByProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('includeVoided') includeVoided?: string,
  ): Promise<LotResponseDto[]> {
    return this.lotsService.findByProduct(productId, includeVoided === 'true');
  }

  @Get('expiry-dashboard')
  @ApiOperation({ summary: 'Expiry dashboard grouped by RED/ORANGE/GREEN' })
  getExpiryDashboard(): Promise<ExpiryDashboardResponseDto> {
    return this.lotsService.getExpiryDashboard();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lot by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<LotResponseDto> {
    return this.lotsService.findOne(id);
  }

  @Get('traceability/:lotNumber')
  @ApiOperation({ summary: 'Trace a lot through movements and sales' })
  traceability(
    @Param('lotNumber') lotNumber: string,
  ): Promise<LotTraceResponseDto> {
    return this.lotsService.traceByLotNumber(lotNumber);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Correct lot number or expiry date (typo only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLotDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<LotResponseDto> {
    return this.lotsService.update(id, dto, user.id, extractMetadata(request));
  }

  @Patch(':id/void')
  @ApiOperation({ summary: 'Void a mistaken lot (zero stock, no history)' })
  void(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidLotDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<LotResponseDto> {
    return this.lotsService.void(id, dto, user.id, extractMetadata(request));
  }

  @Post('fefo/deduct')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Deduct stock using FEFO (database function)' })
  deductStock(
    @Body() dto: DeductStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DeductResult> {
    return this.fefoService.deductStock(dto.productId, dto.quantity, user.id);
  }
}
