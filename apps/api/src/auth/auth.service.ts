import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async login(identifier: string, password: string): Promise<AuthenticatedUser> {
    const result = await this.db.query<AuthenticatedUser & { passwordHash: string }>(
      `SELECT u.id, u.name, u.username, u.email, u.role, u.active,
              u.position_id AS "positionId", p.section_id AS "sectionId",
              u.password_hash AS "passwordHash"
       FROM users u JOIN positions p ON p.id = u.position_id
       WHERE LOWER(u.username) = LOWER($1) OR LOWER(COALESCE(u.email, '')) = LOWER($1)
       LIMIT 1`,
      [identifier.trim()],
    );
    const user = result.rows[0];
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async currentUser(userId: number): Promise<AuthenticatedUser | null> {
    const result = await this.db.query<AuthenticatedUser>(
      `SELECT u.id, u.name, u.username, u.email, u.role, u.active,
              u.position_id AS "positionId", p.section_id AS "sectionId"
       FROM users u JOIN positions p ON p.id = u.position_id WHERE u.id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }
}
