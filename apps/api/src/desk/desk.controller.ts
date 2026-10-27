import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'node:fs';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { DeskService } from './desk.service';
import { incidentLabels, suggestIncidentCategory } from './incident-rules';

type AuthedRequest = Request & { user: AuthenticatedUser };

@Controller('desk')
@UseGuards(AuthGuard)
export class DeskController {
  constructor(private readonly service: DeskService) {}

  @Get('queues') queues(@Req() req: AuthedRequest) { return this.service.queues(req.user); }
  @Get('users') users() { return this.service.activeUsers(); }
  @Post('incident-classification') classify(@Body() body: Record<string,unknown>) {
    const minutes = body.estimatedMinutes === null || body.estimatedMinutes === undefined ? null : Number(body.estimatedMinutes);
    return { ...suggestIncidentCategory({ securityImpact: body.securityImpact === true,
      interruptsOrDegrades: body.interruptsOrDegrades === true, estimatedMinutes: minutes }),labels: incidentLabels };
  }
  @Post('queues') createQueue(@Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.createQueue(body, req.user); }
  @Patch('queues/:id') updateQueue(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.updateQueue(id, body, req.user); }
  @Post('queues/:id/grants') grant(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.grant(id, body, req.user); }
  @Get('queues/:id/grants') grants(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) { return this.service.grants(id, req.user); }
  @Delete('queues/:id/grants/:grantId') revoke(@Param('id', ParseIntPipe) id: number,
    @Param('grantId', ParseIntPipe) grantId: number, @Req() req: AuthedRequest) { return this.service.revoke(id, grantId, req.user); }
  @Get('tickets') tickets(@Query() query: Record<string, string | undefined>, @Req() req: AuthedRequest) { return this.service.tickets(query, req.user); }
  @Post('tickets') createTicket(@Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.createTicket(body, req.user); }
  @Get('tickets/:id') ticket(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) { return this.service.ticket(id, req.user); }
  @Post('tickets/:id/claim') claim(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) { return this.service.claim(id, req.user); }
  @Patch('tickets/:id/process-data') processData(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.updateProcessData(id, body, req.user); }
  @Post('tickets/:id/transition') transition(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.transition(id, body, req.user); }
  @Post('tickets/:id/transfer') transfer(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.transfer(id, body, req.user); }
  @Post('tickets/:id/escalate') escalate(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.escalate(id, body, req.user); }
  @Post('tickets/:id/comments') comment(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.comment(id, body, req.user); }
  @Post('tickets/:id/ci') linkCi(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.linkCi(id, body, req.user); }
  @Post('tickets/:id/links') linkTicket(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.linkTicket(id, body, req.user); }
  @Get('notifications') notifications(@Req() req: AuthedRequest) { return this.service.notifications(req.user); }
  @Get('metrics') metrics(@Req() req: AuthedRequest, @Query('ticketId') ticketId?: string) { return this.service.metrics(req.user, ticketId); }
  @Post('tickets/:id/pause') pause(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.pause(id, body, req.user); }
  @Post('tickets/:id/resume') resume(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.resume(id, body, req.user); }
  @Get('knowledge') knowledge() { return this.service.knowledge(); }
  @Post('knowledge') createArticle(@Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.createArticle(body, req.user); }
  @Patch('knowledge/:id') updateArticle(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) { return this.service.updateArticle(id, body, req.user); }
  @Post('tickets/:id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  upload(@Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    @Req() req: AuthedRequest) { return this.service.uploadAttachment(id, file, req.user); }
  @Get('tickets/:id/attachments/:attachmentId')
  async download(@Param('id', ParseIntPipe) id: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number, @Req() req: AuthedRequest) {
    const item = await this.service.attachment(id, attachmentId, req.user);
    const safeName = encodeURIComponent(item.originalName);
    return new StreamableFile(createReadStream(item.path), {
      type: 'application/octet-stream',
      disposition: `attachment; filename="evidencia"; filename*=UTF-8''${safeName}`,
    });
  }
}
