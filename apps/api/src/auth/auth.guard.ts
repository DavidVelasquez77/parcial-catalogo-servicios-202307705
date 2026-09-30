import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from './auth.types';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.session?.userId;
    if (!userId) throw new UnauthorizedException('Debes iniciar sesión.');

    const result = await this.db.query<AuthenticatedUser>(
      `SELECT u.id, u.name, u.username, u.email, u.role, u.active,
              u.position_id AS "positionId", p.section_id AS "sectionId"
       FROM users u JOIN positions p ON p.id = u.position_id
       WHERE u.id = $1`,
      [userId],
    );
    const user = result.rows[0];
    if (!user || !user.active) {
      request.session.destroy(() => undefined);
      throw new UnauthorizedException('La cuenta está inactiva o no existe.');
    }
    request.user = user;
    return true;
  }
}
