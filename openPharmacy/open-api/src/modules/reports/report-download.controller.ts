import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestMetadata } from '../users/users.service';
import { ReportsService } from './reports.service';

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

/**
 * Public, signed download endpoint for emailed report links.
 *
 * Kept in its own controller (no class-level `@Roles`) so the global
 * `RolesGuard` does not try to authorize a header-less browser navigation.
 * Access is granted solely by presenting a valid, unexpired HMAC token that is
 * bound to a single job — see `report-link.util.ts`. This is what makes the link
 * work when a customer opens the email on a different computer.
 */
@ApiTags('reports')
@Controller('reports')
export class ReportDownloadController {
  constructor(private readonly reportsService: ReportsService) {}

  @Public()
  @Throttle({ medium: { limit: 20, ttl: 60000 } })
  @Get('d/:token')
  @ApiOperation({
    summary: 'Download a report via the signed link sent by email',
  })
  @ApiOkResponse({ description: 'Report file (binary)' })
  async download(
    @Param('token') token: string,
    @Req() request: Request,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportsService.downloadByToken(
      token,
      extractMetadata(request),
    );
    res
      .status(200)
      .set({
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.fileName}"`,
        'Content-Length': String(file.sizeBytes),
      })
      .end(file.buffer);
  }
}
