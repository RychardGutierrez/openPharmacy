import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProductCategory, UserRole } from '@prisma/client';
import { ProductSinService } from './product-sin.service';
import {
  BulkAssignSinDto,
  SetCategoryDefaultDto,
} from './dto/bulk-assign-sin.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { Request } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductPriceDto } from './dto/update-product-price.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { BulkImportResponseDto } from './dto/bulk-import-response.dto';
import { PriceHistoryEntryDto } from './dto/price-history-response.dto';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
import { PaginatedResponseDto } from '../users/dto/paginated-response.dto';

const extractMetadata = (request: Request) => ({
  ip:
    (request.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() ??
    request.ip ??
    request.socket?.remoteAddress ??
    null,
  userAgent: request.headers['user-agent'] ?? null,
});

@ApiTags('products')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productSin: ProductSinService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({
    medium: { limit: 30, ttl: 60000 },
  })
  @ApiOperation({ summary: 'Create a new product' })
  create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.productsService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST, UserRole.CASHIER)
  @ApiOperation({ summary: 'List products with pagination and filters' })
  findAll(
    @Query() query: ProductQueryDto,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    return this.productsService.findAll(query);
  }

  @Get('search')
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST, UserRole.CASHIER)
  @ApiOperation({
    summary: 'Search products by name or barcode for autocomplete',
  })
  search(
    @Query('q') q: string,
    @Query('includeStock') includeStock?: string,
  ): Promise<ProductResponseDto[]> {
    return this.productsService.searchAutocomplete(
      q,
      10,
      includeStock === 'true',
    );
  }

  @Post('bulk-import')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 5, ttl: 60000 },
  })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Import products from a CSV file',
    description: 'Returns a per-row success/failure report.',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  bulkImport(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BulkImportResponseDto> {
    return this.productsService.bulkImport(file);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST, UserRole.CASHIER)
  @ApiOperation({ summary: 'Get a product by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponseDto> {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Req() request: Request,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(
      id,
      dto,
      extractMetadata(request),
      user.id,
    );
  }

  @Get('sin/summary')
  @ApiOperation({ summary: 'Count products with and without SIN codes (SIAT-08)' })
  sinSummary(): Promise<{ total: number; homologated: number; pending: number }> {
    return this.productSin.summary();
  }

  @Post('sin/bulk-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign SIN codes to selected products or a category (SIAT-08)' })
  bulkAssignSin(
    @Body() dto: BulkAssignSinDto,
    @Req() request: Request,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    return this.productSin.bulkAssign(
      {
        codes: {
          activityCode: dto.sinActivityCode,
          productCode: dto.sinProductCode,
          unitCode: dto.sinUnitCode,
        },
        productIds: dto.productIds,
        category: dto.category,
        overwrite: dto.overwrite,
      },
      user.id,
      extractMetadata(request),
    );
  }

  @Get('sin/defaults')
  @ApiOperation({ summary: 'List the default SIN codes per category (SIAT-08)' })
  listSinDefaults() {
    return this.productSin.listDefaults();
  }

  @Put('sin/defaults/:category')
  @ApiOperation({ summary: 'Set the default SIN codes of a category (SIAT-08)' })
  setSinDefault(
    @Param('category', new ParseEnumPipe(ProductCategory)) category: ProductCategory,
    @Body() dto: SetCategoryDefaultDto,
    @Req() request: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productSin.upsertDefault(
      category,
      {
        activityCode: dto.sinActivityCode,
        productCode: dto.sinProductCode,
        unitCode: dto.sinUnitCode,
      },
      user.id,
      extractMetadata(request),
    );
  }

  @Post('sin/defaults/:category/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a category default to its products that lack codes (SIAT-08)' })
  applySinDefault(
    @Param('category', new ParseEnumPipe(ProductCategory)) category: ProductCategory,
    @Req() request: Request,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    return this.productSin.applyDefault(category, user.id, extractMetadata(request));
  }

  @Patch(':id/price')
  @ApiOperation({ summary: 'Update the sale price of a product' })
  updatePrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductPriceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ProductResponseDto> {
    return this.productsService.updatePrice(
      id,
      dto,
      user.id,
      extractMetadata(request),
    );
  }

  @Get(':id/price-history')
  @ApiOperation({ summary: 'List the price history of a product' })
  getPriceHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PriceHistoryQueryDto,
  ): Promise<PaginatedResponseDto<PriceHistoryEntryDto>> {
    return this.productsService.getPriceHistory(id, query);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Soft-delete / deactivate a product' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.deactivate(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Restore / activate a deactivated product' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return this.productsService.activate(id);
  }
}
