import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, RequestMetadata } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { Public } from '../../common/decorators/public.decorator';
import { REFRESH_COOKIE_NAME } from './auth.constants';

const extractMetadata = (request: Request): RequestMetadata => ({
  ip:
    (request.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      ?.trim() ??
    request.ip ??
    request.socket?.remoteAddress ??
    null,
  userAgent: request.headers['user-agent'] ?? null,
});

@Public()
@UseInterceptors(AuditInterceptor)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 5, ttl: 1000 },
    medium: { limit: 15, ttl: 10000 },
    long: { limit: 30, ttl: 60000 },
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const meta = extractMetadata(request);
    const result = await this.auth.login(dto, meta);
    this.setRefreshCookie(response, result.refreshToken);
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    const meta = extractMetadata(request);
    const refreshToken = this.readRefreshCookie(request);
    const result = await this.auth.refresh(refreshToken, meta);
    this.setRefreshCookie(response, result.refreshToken);
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const meta = extractMetadata(request);
    const refreshToken = this.readRefreshCookie(request);
    // logout is reachable with or without a valid access token; user is optional
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const userId: string | undefined = request.user?.id;
    await this.auth.logout(refreshToken, userId, meta);
    const opts = this.auth.getCookieOptions();
    response.clearCookie(REFRESH_COOKIE_NAME, { path: opts.path });
  }

  private readRefreshCookie(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_COOKIE_NAME];
  }

  private setRefreshCookie(response: Response, value: string): void {
    const opts = this.auth.getCookieOptions();
    response.cookie(REFRESH_COOKIE_NAME, value, {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      path: opts.path,
      maxAge: opts.maxAgeMs,
    });
  }
}
