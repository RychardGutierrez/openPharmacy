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
  Req,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserLookupQueryDto } from './dto/user-lookup-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserLookupResponseDto } from './dto/user-lookup-response.dto';
import { PaginatedResponseDto } from './dto/paginated-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { Request } from 'express';

const extractMetadata = (request: Request) => ({
  ip: (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? request.ip ?? null,
  userAgent: request.headers['user-agent'] ?? null,
});

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  @Throttle({
    long: { limit: 10, ttl: 60000 },
  })
  @ApiOperation({ summary: 'Create a new user (admin only)' })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List users with pagination and filters' })
  findAll(
    @Query() query: UserQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.usersService.findAll(query);
  }

  @Get('lookup')
  @Roles(UserRole.ADMIN, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Lightweight user lookup for filters/dropdowns' })
  lookup(@Query() query: UserLookupQueryDto): Promise<UserLookupResponseDto[]> {
    return this.usersService.lookup(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return this.usersService.findOne(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @Req() request: Request,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(user.id, dto, extractMetadata(request));
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ long: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Change the authenticated user password' })
  async changeMyPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.usersService.changePassword(user.id, dto, extractMetadata(request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID (including soft-deleted)' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a user' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete / deactivate a user' })
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.deactivate(id);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Restore / activate a deactivated user' })
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.activate(id);
  }
}
