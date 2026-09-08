import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnResponseDto } from './dto/return-response.dto';
import { ReturnsService } from './returns.service';

@ApiTags('returns')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Register a customer return and restore stock to the original sale lot',
  })
  @ApiResponse({ status: 201, type: ReturnResponseDto })
  @ApiResponse({ status: 400, description: 'Validation or business error' })
  @ApiResponse({ status: 403, description: 'Controlled substance rejected' })
  @ApiResponse({ status: 404, description: 'Sale not found' })
  @ApiResponse({ status: 409, description: 'Sale is not eligible for return' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReturnDto,
  ): Promise<ReturnResponseDto> {
    return this.returnsService.create(user.id, dto);
  }
}
