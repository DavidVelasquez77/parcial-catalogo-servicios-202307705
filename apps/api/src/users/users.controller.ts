import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/auth.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Get() list() { return this.service.list(); }
  @Post() create(@Body() body: Record<string, unknown>) { return this.service.create(body); }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) { return this.service.update(id, body); }
}
