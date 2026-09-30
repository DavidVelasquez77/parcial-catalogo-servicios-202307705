import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ServicesService } from './services.service';

@Controller('services')
@UseGuards(AuthGuard, RolesGuard)
export class ServicesController {
  constructor(private readonly service: ServicesService) {}
  @Get('dashboard') dashboard() { return this.service.dashboard(); }
  @Get('level1') level1List() { return this.service.level1List(); }
  @Get() list(@Query() query: Record<string, string | undefined>) { return this.service.list(query); }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Post() @Roles('ADMIN') create(@Body() body: Record<string, unknown>) { return this.service.create(body); }
  @Patch(':id') @Roles('ADMIN') update(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.service.update(id, body); }
  @Delete(':id') @Roles('ADMIN') deactivate(@Param('id', ParseIntPipe) id: number) { return this.service.deactivate(id); }
}
