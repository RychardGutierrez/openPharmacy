import {
  Body,
  Controller,
  forwardRef,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';
import { ReturnsService } from '../returns/returns.service';
import {
  CancelSaleDto,
  ReturnResponseDto,
} from '../returns/dto/return-response.dto';

@ApiTags('sales')
@ApiBearerAuth()
@Roles(UserRole.CASHIER, UserRole.PHARMACIST)
@Controller('sales')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    @Inject(forwardRef(() => ReturnsService))
    private readonly returnsService: ReturnsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a sale and deduct stock using FEFO' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List completed sales' })
  findAll() {
    return this.salesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a sale receipt by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findOne(id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST)
  @ApiOperation({
    summary:
      'Cancel a completed sale and restore every line item to its original lot',
  })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSaleDto,
  ): Promise<ReturnResponseDto> {
    return this.returnsService.cancel(user.id, id, dto);
  }
}
