import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import {
  ListSiatCatalogQuery,
  SyncSiatCatalogsDto,
} from './dto/siat-catalogs.dto';
import { SiatCatalogSyncService } from './siat-catalog-sync.service';
import { SiatCatalogsService } from './siat-catalogs.service';

/**
 * SIN catalogs and clock (SIAT-07). `:catalog` is open to every role for public catalogs; the
 * service checks the rest. Status and sync are ADMIN only.
 */
@ApiTags('siat')
@ApiBearerAuth()
@Controller('siat/catalogs')
export class SiatCatalogsController {
  constructor(
    private readonly catalogs: SiatCatalogsService,
    private readonly sync: SiatCatalogSyncService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Catalog status (counts, last sync, failures) and the SIAT clock',
  })
  status() {
    return this.catalogs.status();
  }

  @Get(':catalog')
  @ApiOperation({
    summary: 'Active codes of a catalog (public catalogs for every role)',
  })
  list(
    @Param('catalog') catalog: string,
    @Query() query: ListSiatCatalogQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogs.list(catalog, query, user.role);
  }

  @Post('sync')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Sync now: one catalog or all, and the clock (audited as SIAT_CATALOGS_SYNCED)',
  })
  syncNow(
    @Body() dto: SyncSiatCatalogsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sync.syncNow({ catalog: dto.catalog, userId: user.id });
  }
}
