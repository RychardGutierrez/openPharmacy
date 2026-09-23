import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import * as Auth from '../auth/interfaces/jwt-payload.interface';
import type { RequestMetadata } from '../users/users.service';
import {
  CreateSupplierDto,
  SuppliersListQueryDto,
} from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

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

@ApiTags('suppliers')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a supplier' })
  create(
    @Body() dto: CreateSupplierDto,
    @CurrentUser() user: Auth.AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.suppliersService.create(dto, user.id, extractMetadata(request));
  }

  @Get()
  @ApiOperation({
    summary: 'List active suppliers (used by purchase-order dropdowns)',
  })
  findAll() {
    return this.suppliersService.findAll();
  }

  @Get('search')
  @ApiOperation({
    summary: 'Paginated, search-backed supplier list',
  })
  search(@Query() query: SuppliersListQueryDto) {
    return this.suppliersService.findAllPaginated(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a supplier by id (including deactivated suppliers)',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a supplier' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: Auth.AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.suppliersService.update(
      id,
      dto,
      user.id,
      extractMetadata(request),
    );
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Soft-delete / deactivate a supplier' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Auth.AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.suppliersService.deactivate(
      id,
      user.id,
      extractMetadata(request),
    );
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Restore / activate a deactivated supplier' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: Auth.AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.suppliersService.activate(
      id,
      user.id,
      extractMetadata(request),
    );
  }
}
