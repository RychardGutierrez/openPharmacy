import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { BulkUpdateConfigDto } from './dto/bulk-update-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { ConfigService } from './config.service';
import { LogoStorageService } from './logo-storage.service';

@ApiTags('config')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('config')
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private readonly logoStorage: LogoStorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get safe system configuration values' })
  findAll() {
    return this.configService.findAll();
  }

  @Get('runtime')
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST, UserRole.CASHIER)
  @ApiOperation({ summary: 'Get safe settings used by the application runtime' })
  runtime() {
    return this.configService.getRuntimeSettings();
  }

  @Get('logo/:filename')
  @Public()
  @Roles()
  @ApiOperation({ summary: 'Serve the configured receipt logo' })
  async logo(@Param('filename') filename: string) {
    try {
      const data = await this.logoStorage.read(filename);
      return new StreamableFile(data, { type: 'image/png', disposition: 'inline' });
    } catch {
      throw new NotFoundException('No se encontró el logo del recibo');
    }
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get one safe configuration value' })
  findOne(@Param('key') key: string) {
    return this.configService.findOne(key);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update one configuration value' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.configService.update(key, dto.value, this.metadata(user, request));
  }

  @Patch()
  @ApiOperation({ summary: 'Update configuration values atomically' })
  updateMany(
    @Body() dto: BulkUpdateConfigDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.configService.updateValues(dto.values, this.metadata(user, request));
  }

  @Post('logo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload the receipt logo' })
  async uploadLogo(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^image\/(png|jpeg|webp)$/ })
        .addMaxSizeValidator({ maxSize: 2 * 1024 * 1024 })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    const path = await this.logoStorage.save(file);
    return { path };
  }

  private metadata(user: AuthenticatedUser, request: Request) {
    return {
      userId: user.id,
      ip: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    };
  }
}
