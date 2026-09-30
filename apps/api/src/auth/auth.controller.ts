import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

class LoginDto {
  @IsString() identifier!: string;
  @IsString() @MinLength(8) password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto, @Req() request: Request) {
    const user = await this.auth.login(body.identifier, body.password);
    await new Promise<void>((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()));
    request.session.userId = user.id;
    await new Promise<void>((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()));
    return { user };
  }

  @Post('logout')
  async logout(@Req() request: Request) {
    await new Promise<void>((resolve) => request.session.destroy(() => resolve()));
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: Request & { user?: unknown }) {
    return { user: request.user };
  }
}
