import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import {
  ResolveBuyerDto,
  SearchCustomersQuery,
  VerifyNitDto,
} from './dto/siat-buyers.dto';
import { SiatBuyerService } from './siat-buyer.service';
import { SiatCustomersService } from './siat-customers.service';
import { SiatNitVerificationService } from './siat-nit-verification.service';

/** Buyer identification and NIT verification (SIAT-10). */
@ApiTags('siat')
@ApiBearerAuth()
@Controller('siat/buyers')
export class SiatBuyersController {
  constructor(
    private readonly buyers: SiatBuyerService,
    private readonly nits: SiatNitVerificationService,
    private readonly customers: SiatCustomersService,
  ) {}

  @Post('verify-nit')
  @HttpCode(200)
  @Roles(UserRole.CASHIER, UserRole.PHARMACIST)
  @ApiOperation({
    summary:
      'verificarNit for a buyer NIT (valid answers cached 24 h). Needs an open shift',
  })
  verifyNit(@Body() dto: VerifyNitDto, @CurrentUser() user: AuthenticatedUser) {
    return this.nits.verify(dto.nit, user.id);
  }

  @Post('resolve')
  @HttpCode(200)
  @Roles(UserRole.CASHIER, UserRole.PHARMACIST, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Apply the buyer rules (S/N, Bs 1,000, complemento, codigoExcepcion, special codes). No SIAT call',
  })
  resolve(
    @Body() dto: ResolveBuyerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.buyers.resolve(dto, user.role);
  }

  @Get('customers')
  @Roles(UserRole.CASHIER, UserRole.PHARMACIST, UserRole.ADMIN)
  @ApiOperation({ summary: 'Customer autocomplete by document number prefix' })
  searchCustomers(@Query() query: SearchCustomersQuery) {
    return this.customers.search(query.docNumber, query.docType);
  }
}
