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
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { BulkImportResponseDto } from './dto/bulk-import-response.dto';
import { PaginatedResponseDto } from '../users/dto/paginated-response.dto';

@ApiTags('products')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

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
  @ApiOperation({ summary: 'List products with pagination and filters' })
  findAll(
    @Query() query: ProductQueryDto,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    return this.productsService.findAll(query);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search products by name or barcode for autocomplete',
  })
  search(@Query('q') q: string): Promise<ProductResponseDto[]> {
    return this.productsService.searchAutocomplete(q);
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
  @ApiOperation({ summary: 'Get a product by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponseDto> {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, dto);
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
