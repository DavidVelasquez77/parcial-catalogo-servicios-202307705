import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CmdbService } from './cmdb.service';

@Controller('cmdb')
@UseGuards(AuthGuard, RolesGuard)
export class CmdbController {
  constructor(private readonly service: CmdbService) {}

  @Get('categories') categories() { return this.service.categories(); }
  @Post('categories') @Roles('ADMIN') createCategory(@Body() body: Record<string, unknown>) { return this.service.createCategory(body); }
  @Patch('categories/:id') @Roles('ADMIN') updateCategory(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.service.updateCategory(id, body); }
  @Get('locations') locations() { return this.service.locations(); }
  @Post('locations') @Roles('ADMIN') createLocation(@Body() body: Record<string, unknown>) { return this.service.createLocation(body); }
  @Patch('locations/:id') @Roles('ADMIN') updateLocation(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: Request & { user: AuthenticatedUser }) { return this.service.updateLocation(id, body, req.user.id); }
  @Get('items') items(@Query() query: Record<string, string | undefined>) { return this.service.items(query); }
  @Get('items/:id') item(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: AuthenticatedUser }) { return this.service.item(id, req.user); }
  @Post('items') @Roles('ADMIN') createItem(@Body() body: Record<string, unknown>, @Req() req: Request & { user: AuthenticatedUser }) { return this.service.createItem(body, req.user.id); }
  @Patch('items/:id') @Roles('ADMIN') updateItem(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>, @Req() req: Request & { user: AuthenticatedUser }) { return this.service.updateItem(id, body, req.user.id); }
  @Post('relations') @Roles('ADMIN') createRelation(@Body() body: Record<string, unknown>) { return this.service.createRelation(body); }
  @Post('services') @Roles('ADMIN') linkService(@Body() body: Record<string, unknown>) { return this.service.linkService(body); }
  @Get('items/:id/impact') impact(@Param('id', ParseIntPipe) id: number) { return this.service.impact(id); }
}
