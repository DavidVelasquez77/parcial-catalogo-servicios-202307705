import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from './auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>('roles', [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: { role: UserRole; roles?: UserRole[] } }>();
    if (!request.user || !required.some((role) => (request.user?.roles ?? [request.user?.role]).includes(role))) {
      throw new ForbiddenException('No tienes permisos para esta operación.');
    }
    return true;
  }
}
