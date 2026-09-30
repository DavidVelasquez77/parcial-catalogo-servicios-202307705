import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ImportService } from './import.service';

@Controller('imports')
@UseGuards(AuthGuard, RolesGuard)
export class ImportController {
  constructor(private readonly service: ImportService) {}
  @Get() @Roles('ADMIN') list() { return this.service.listRuns(); }
  @Get(':id/observations') @Roles('ADMIN') observations(@Param('id', ParseIntPipe) id: number) { return this.service.observations(id); }
  @Post('validate') @Roles('ADMIN') validate() { return this.service.validateFile(); }
  @Post('run') @Roles('ADMIN') run() { return this.service.run(); }
}
