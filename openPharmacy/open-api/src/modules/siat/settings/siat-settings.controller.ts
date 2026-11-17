import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { UpdateSiatSettingsDto } from './dto/update-siat-settings.dto';
import { SiatSettingsService } from './siat-settings.service';

/** SIAT settings (SIAT-04). ADMIN only: reading included, because the view shows token status. */
@ApiTags('siat')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('siat/settings')
export class SiatSettingsController {
  constructor(private readonly service: SiatSettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get the SIAT settings (the token is never returned)',
  })
  get() {
    return this.service.get();
  }

  @Patch()
  @ApiOperation({
    summary: 'Update the SIAT settings (audited as SIAT_CONFIG_UPDATED)',
  })
  update(
    @Body() dto: UpdateSiatSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.service.update(dto, {
      userId: user.id,
      ip: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    });
  }

  @Post('test-connection')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Call verificarComunicacion and report the stored CUIS status',
  })
  testConnection() {
    return this.service.testConnection();
  }
}
