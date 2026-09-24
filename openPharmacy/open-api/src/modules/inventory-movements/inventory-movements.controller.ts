import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { RequestMetadata } from '../users/users.service';
import { InventoryMovementsService } from './inventory-movements.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { MovementsListQueryDto } from './dto/movements-list-query.dto';
import { AdjustmentsListQueryDto } from './dto/adjustments-list-query.dto';
import { AdjustmentResponseDto } from './dto/adjustment-response.dto';
import { MovementResponseDto } from './dto/movement-response.dto';

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

@ApiTags('inventory-movements')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller('inventory-movements')
export class InventoryMovementsController {
  constructor(
    private readonly inventoryMovementsService: InventoryMovementsService,
  ) {}

  @Post('adjustments')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ medium: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a manual inventory adjustment' })
  @ApiResponse({ status: 201, type: AdjustmentResponseDto })
  createAdjustment(
    @Body() dto: CreateAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdjustmentResponseDto> {
    return this.inventoryMovementsService.createAdjustment(user.id, dto);
  }

  @Get('adjustments')
  @ApiOperation({ summary: 'List adjustment requests' })
  @ApiResponse({ status: 200, type: AdjustmentResponseDto })
  findAllAdjustments(@Query() query: AdjustmentsListQueryDto): Promise<{
    data: AdjustmentResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    return this.inventoryMovementsService.findAllAdjustments({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      productId: query.productId,
      lotId: query.lotId,
      status: query.status,
      requestedBy: query.requestedBy,
    });
  }

  @Get('adjustments/:id')
  @ApiOperation({ summary: 'Get an adjustment request by id' })
  @ApiResponse({ status: 200, type: AdjustmentResponseDto })
  @ApiResponse({ status: 404, description: 'Adjustment not found' })
  findOneAdjustment(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdjustmentResponseDto | null> {
    return this.inventoryMovementsService.findAdjustmentById(id);
  }

  @Post('adjustments/:id/approve')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Approve and apply a pending adjustment (admin only)',
  })
  @ApiResponse({ status: 200, type: AdjustmentResponseDto })
  approveAdjustment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{
    adjustment: AdjustmentResponseDto;
    movement: MovementResponseDto;
  }> {
    void extractMetadata(request);
    return this.inventoryMovementsService.approveAdjustment(user.id, id);
  }

  @Post('adjustments/:id/reject')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Reject a pending adjustment (admin only)' })
  @ApiResponse({ status: 200, type: AdjustmentResponseDto })
  rejectAdjustment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<AdjustmentResponseDto> {
    void extractMetadata(request);
    return this.inventoryMovementsService.rejectAdjustment(user.id, id);
  }

  @Get()
  @ApiOperation({ summary: 'List immutable inventory movements' })
  @ApiResponse({ status: 200, type: MovementResponseDto })
  findAll(@Query() query: MovementsListQueryDto): Promise<{
    data: MovementResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    return this.inventoryMovementsService.findAll({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      productId: query.productId,
      lotId: query.lotId,
      movementType: query.movementType,
      userId: query.userId,
      from: query.from,
      to: query.to,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an inventory movement by id' })
  @ApiResponse({ status: 200, type: MovementResponseDto })
  @ApiResponse({ status: 404, description: 'Movement not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MovementResponseDto | null> {
    return this.inventoryMovementsService.findOne(id);
  }
}
