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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { CloseShiftDto } from './dto/close-shift.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { ReopenRequestDto } from './dto/reopen-request.dto';
import { ShiftsService } from './shifts.service';

@ApiTags('shifts')
@ApiBearerAuth()
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  @Roles(UserRole.CASHIER, UserRole.PHARMACIST)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Open a cash register shift' })
  open(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateShiftDto) {
    return this.shiftsService.open(user.id, dto);
  }

  @Patch(':id/close')
  @Roles(UserRole.CASHIER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Close a cash register shift' })
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseShiftDto,
  ) {
    return this.shiftsService.close(user.id, id, dto);
  }

  @Post(':id/reopen-request')
  @Roles(UserRole.CASHIER, UserRole.PHARMACIST)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request admin approval to reopen a shift' })
  requestReopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenRequestDto,
  ) {
    return this.shiftsService.requestReopen(user.id, id, dto);
  }

  @Get('reopen-requests')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List pending shift reopen requests' })
  findReopenRequests() {
    return this.shiftsService.findReopenRequests();
  }

  @Patch('reopen-requests/:requestId/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a shift reopen request' })
  approveReopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.shiftsService.approveReopen(user.id, requestId);
  }

  @Patch('reopen-requests/:requestId/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject a shift reopen request' })
  rejectReopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.shiftsService.rejectReopen(user.id, requestId);
  }

  @Patch(':id/reopen')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Directly reopen a closed shift (admin only)' })
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shiftsService.reopen(user.id, id);
  }
}
