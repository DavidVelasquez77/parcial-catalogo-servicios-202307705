import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OrganizationService } from './organization.service';

@Controller('organization')
@UseGuards(AuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  @Get(':kind') list(@Param('kind') kind: string) { return this.service.list(kind); }

  @Post(':kind')
  @Roles('ADMIN')
  create(@Param('kind') kind: string, @Body() body: Record<string, unknown>) { return this.service.create(kind, body); }

  @Patch(':kind/:id')
  @Roles('ADMIN')
  update(@Param('kind') kind: string, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.service.update(kind, id, body); }

  @Delete(':kind/:id')
  @Roles('ADMIN')
  deactivate(@Param('kind') kind: string, @Param('id', ParseIntPipe) id: number) { return this.service.deactivate(kind, id); }
}
