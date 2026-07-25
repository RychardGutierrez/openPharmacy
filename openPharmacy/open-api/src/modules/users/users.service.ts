import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { User, UserRole } from '@prisma/client';
import { AuditLogRepository } from '../../common/audit/audit-log.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginatedResponseDto } from './dto/paginated-response.dto';
import { UsersRepository } from './repositories/users.repository';
import { LastAdminDeactivationException } from './exceptions/last-admin-deactivation.exception';

export interface RequestMetadata {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly bcryptSaltRounds: number;
  private readonly accessSecret: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly users: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly audit: AuditLogRepository,
  ) {
    this.bcryptSaltRounds = config.getOrThrow<number>('app.bcryptSaltRounds');
    this.accessSecret = config.getOrThrow<string>('auth.accessSecret');
    this.frontendUrl = config.getOrThrow<string>('mailer.frontendUrl');
  }

  async create(
    dto: CreateUserDto,
    meta?: RequestMetadata,
  ): Promise<UserResponseDto> {
    const existingEmail = await this.users.existsActiveByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException({
        statusCode: 409,
        code: 'EMAIL_EXISTS',
        message: 'Email already registered',
      });
    }

    const existingCi = await this.users.existsActiveByCi(dto.ci);
    if (existingCi) {
      throw new ConflictException({
        statusCode: 409,
        code: 'CI_EXISTS',
        message: 'CI already registered',
      });
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await hash(tempPassword, this.bcryptSaltRounds);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await this.users.createWithHashedPasswordTx(
        tx,
        {
          full_name: dto.fullName,
          ci: dto.ci,
          email: dto.email,
          roleName: dto.role,
          reg_number: dto.regNumber ?? null,
        },
        passwordHash,
      );

      await this.audit.createInTx(tx, {
        userId: created.id,
        event: 'USER_CREATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { role: dto.role, createdByAdmin: true },
      });

      return created;
    });

    const { token, expiresAt } = this.signChangePasswordToken(user.id);

    this.eventEmitter
      .emitAsync('user.created', {
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        tempPassword,
        changePasswordToken: token,
        changePasswordExpiresAt: expiresAt,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to emit user.created event for ${user.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      });

    return this.toResponse(user);
  }

  async findAll(
    query: UserQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const { data, total, page, pageSize, totalPages } =
      await this.users.findAllPaginated({
        page: query.page,
        pageSize: query.pageSize,
        role: query.role,
        active: query.active,
        q: query.q,
      });

    return {
      data: data.map((user) => this.toResponse(user)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.users.findByIdIncludingDeleted(id);
    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: `User ${id} not found`,
      });
    }
    return this.toResponse(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    meta?: RequestMetadata,
  ): Promise<UserResponseDto> {
    const existing = await this.users.findByIdIncludingDeleted(id);
    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: `User ${id} not found`,
      });
    }

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.users.existsActiveByEmailExcept(
        dto.email,
        id,
      );
      if (emailTaken) {
        throw new ConflictException({
          statusCode: 409,
          code: 'EMAIL_EXISTS',
          message: 'Email already registered',
        });
      }
    }

    if (dto.ci && dto.ci !== existing.ci) {
      const ciTaken = await this.users.existsActiveByCiExcept(dto.ci, id);
      if (ciTaken) {
        throw new ConflictException({
          statusCode: 409,
          code: 'CI_EXISTS',
          message: 'CI already registered',
        });
      }
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await this.users.updateTx(tx, id, {
        full_name: dto.fullName,
        ci: dto.ci,
        email: dto.email,
        reg_number: dto.regNumber,
        roleName: dto.role,
      });

      await this.audit.createInTx(tx, {
        userId: id,
        event: 'USER_UPDATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { changedFields: Object.keys(dto) },
      });

      return updated;
    });

    return this.toResponse(user);
  }

  async deactivate(
    id: string,
    meta?: RequestMetadata,
  ): Promise<UserResponseDto> {
    const existing = await this.users.findByIdIncludingDeleted(id);
    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
        message: `User ${id} not found`,
      });
    }

    if (existing.roleName === UserRole.ADMIN) {
      const activeAdmins = await this.users.countActiveByRole(UserRole.ADMIN);
      if (activeAdmins <= 1) {
        throw new LastAdminDeactivationException();
      }
    }

    const now = new Date();
    const user = await this.prisma.$transaction(async (tx) => {
      const deactivated = await this.users.softDeleteTx(tx, id, now);
      await this.audit.createInTx(tx, {
        userId: id,
        event: 'USER_DEACTIVATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
      });
      return deactivated;
    });

    return this.toResponse(user);
  }

  async activate(id: string, meta?: RequestMetadata): Promise<UserResponseDto> {
    const user = await this.prisma.$transaction(async (tx) => {
      const activated = await this.users.restoreTx(tx, id);
      await this.audit.createInTx(tx, {
        userId: id,
        event: 'USER_ACTIVATED',
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
      });
      return activated;
    });

    return this.toResponse(user);
  }

  private generateTempPassword(): string {
    return randomBytes(12).toString('base64url');
  }

  private signChangePasswordToken(userId: string): {
    token: string;
    expiresAt: Date;
  } {
    const expiresInSec = 24 * 60 * 60; // 24 hours
    const token = this.jwt.sign(
      { sub: userId, aud: 'pwd-change' },
      {
        secret: this.accessSecret,
        expiresIn: expiresInSec,
      },
    );
    const expiresAt = new Date(Date.now() + expiresInSec * 1000);
    return { token, expiresAt };
  }

  private toResponse(user: User): UserResponseDto {
    return plainToInstance(UserResponseDto, {
      id: user.id,
      fullName: user.full_name,
      ci: user.ci,
      email: user.email,
      role: user.roleName,
      regNumber: user.reg_number,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deleted_at,
    });
  }
}
