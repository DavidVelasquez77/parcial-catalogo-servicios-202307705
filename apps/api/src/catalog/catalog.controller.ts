import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CatalogService } from './catalog.service';

@Controller('catalogs')
@UseGuards(AuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly service: CatalogService) {}
  @Get(':kind') list(@Param('kind') kind: string) { return this.service.list(kind); }
  @Post(':kind') @Roles('ADMIN') create(@Param('kind') kind: string, @Body() body: Record<string, unknown>) { return this.service.create(kind, body); }
  @Patch(':kind/:id') @Roles('ADMIN') update(@Param('kind') kind: string, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.service.update(kind, id, body); }
}
