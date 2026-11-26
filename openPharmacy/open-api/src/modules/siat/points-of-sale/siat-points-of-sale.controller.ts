import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import {
  CloseSiatPointOfSaleDto,
  CreateSiatBranchDto,
  EnsureSiatCufdDto,
  EnsureSiatCuisDto,
  ReconcileSiatPointsOfSaleQuery,
  RegisterSiatPointOfSaleDto,
  UpdateSiatBranchDto,
  UpdateSiatPointOfSaleDto,
} from './dto/siat-points-of-sale.dto';
import { SiatPointsOfSaleService } from './siat-points-of-sale.service';

/** SIAT branches, points of sale, CUIS (SIAT-05) and CUFD (SIAT-06). ADMIN only. */
@ApiTags('siat')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('siat')
export class SiatPointsOfSaleController {
  constructor(private readonly service: SiatPointsOfSaleService) {}

  @Get('branches')
  @ApiOperation({ summary: 'List SIAT branches' })
  listBranches() {
    return this.service.listBranches();
  }

  @Post('branches')
  @ApiOperation({
    summary: 'Create a branch (as in the Padrón) and its point of sale 0',
  })
  createBranch(
    @Body() dto: CreateSiatBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createBranch(dto, user.id);
  }

  @Patch('branches/:id')
  @ApiOperation({ summary: 'Update a branch. codigoSucursal cannot change' })
  updateBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiatBranchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateBranch(id, dto, user.id);
  }

  @Get('points-of-sale/types')
  @ApiOperation({
    summary: 'Point-of-sale types (provisional list until SIAT-07)',
  })
  types() {
    return this.service.types();
  }

  @Get('points-of-sale/reconcile')
  @ApiOperation({
    summary:
      'consultaPuntoVenta for a branch, compared with the stored points of sale',
  })
  reconcile(@Query() query: ReconcileSiatPointsOfSaleQuery) {
    return this.service.reconcile(query.branchId);
  }

  @Get('points-of-sale')
  @ApiOperation({
    summary:
      'List points of sale with their CUIS and CUFD status (never the codes)',
  })
  list() {
    return this.service.list();
  }

  @Post('points-of-sale')
  @ApiOperation({ summary: 'registroPuntoVenta, then request its CUIS' })
  register(
    @Body() dto: RegisterSiatPointOfSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.register(dto, user.id);
  }

  @Patch('points-of-sale/:id')
  @ApiOperation({
    summary: 'Rename, retire (active=false) or reactivate a point of sale',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSiatPointOfSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user.id);
  }

  @Post('points-of-sale/:id/cuis')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get or renew the CUIS of a point of sale' })
  ensureCuis(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnsureSiatCuisDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.ensureCuis(id, dto.force === true, user.id);
  }

  @Post('points-of-sale/:id/cufd')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Get a CUFD when the stored one needs renewal ({ "force": true } always asks SIAT). Never returns the codes',
  })
  ensureCufd(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnsureSiatCufdDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.ensureCufd(id, dto.force === true, user.id);
  }

  @Post('points-of-sale/:id/close')
  @HttpCode(200)
  @ApiOperation({
    summary: 'cierrePuntoVenta. Final: the number is never reused',
  })
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: CloseSiatPointOfSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.close(id, user.id);
  }
}
