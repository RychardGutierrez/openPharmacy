import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  Sse,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { RequestMetadata } from '../users/users.service';
import { CreateReportDto } from './dto/create-report.dto';
import { PreviewReportDto } from './dto/preview-report.dto';
import { ReportListQueryDto } from './dto/report-list-query.dto';
import { ReportJobResponseDto } from './dto/report-job-response.dto';
import { ReportNotificationService } from './report-notification.service';
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

@ApiTags('reports')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly notifications: ReportNotificationService,
  ) {}

  @Post()
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request a sales / inventory / purchasing export (Excel or PDF)',
    description:
      'Small reports are generated synchronously and returned as a file (200). ' +
      'Large reports are queued (202) and delivered via SSE/email, then downloaded from /reports/:id/download.',
  })
  @ApiResponse({ status: 200, description: 'Synchronous report file (binary)' })
  @ApiResponse({
    status: 202,
    type: ReportJobResponseDto,
    description: 'Report queued',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto,
    @Req() request: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.reportsService.create(
      user,
      dto,
      extractMetadata(request),
    );

    if (result.mode === 'sync') {
      res
        .status(200)
        .set({
          'Content-Type': result.file.contentType,
          'Content-Disposition': `attachment; filename="${result.file.fileName}"`,
          'Content-Length': String(result.file.sizeBytes),
          'X-Report-Job-Id': result.job.id,
        })
        .end(result.file.buffer);
      return;
    }

    res.status(202).json({
      ...ReportJobResponseDto.fromJob(result.job),
      message:
        'Report is queued. You will be notified via SSE and email when it is ready.',
    });
  }

  @Post('preview')
  @Throttle({ medium: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Preview a report with paginated rows' })
  @ApiResponse({ status: 200, description: 'Paginated report preview' })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PreviewReportDto,
  ) {
    return this.reportsService.preview(user, dto);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream of your report job completions' })
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    return this.notifications.forUser(user);
  }

  @Get()
  @ApiOperation({
    summary: 'List report jobs (admins see all, others see their own)',
  })
  @ApiResponse({ status: 200, type: ReportJobResponseDto, isArray: true })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportListQueryDto,
  ) {
    return this.reportsService.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get the status of a report job' })
  @ApiResponse({ status: 200, type: ReportJobResponseDto })
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReportJobResponseDto> {
    return this.reportsService.getStatus(user, id);
  }

  @Get(':id/download')
  @ApiProduces('application/octet-stream')
  @ApiOperation({ summary: 'Download a completed report file' })
  @ApiResponse({ status: 200, description: 'Report file (binary)' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.reportsService.download(
      user,
      id,
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
