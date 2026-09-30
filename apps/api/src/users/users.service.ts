import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const result = await this.db.query(`SELECT u.id, u.name, u.username, u.email, u.role, u.active,
      u.position_id AS "positionId", p.code AS "positionCode", p.name AS "positionName",
      s.id AS "sectionId", s.name AS "sectionName"
      FROM users u JOIN positions p ON p.id = u.position_id JOIN sections s ON s.id = p.section_id
      ORDER BY u.active DESC, u.name ASC`);
    return result.rows;
  }

  async create(body: Record<string, unknown>) {
    const name = String(body.name ?? '').trim();
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const role = body.role === 'ADMIN' ? 'ADMIN' : 'CONSULTA';
    const positionId = Number(body.positionId);
    if (!name || !username || password.length < 8 || !Number.isInteger(positionId)) {
      throw new BadRequestException('Nombre, usuario, contraseña de 8 caracteres y puesto son obligatorios.');
    }
    const position = await this.db.query(`SELECT p.id, p.active, s.active AS section_active FROM positions p JOIN sections s ON s.id = p.section_id WHERE p.id = $1`, [positionId]);
    if (!position.rows[0] || !position.rows[0].active || !position.rows[0].section_active) throw new BadRequestException('El puesto o su sección no están activos.');
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await this.db.query(`INSERT INTO users(name, username, email, password_hash, role, position_id)
      VALUES($1, $2, NULLIF($3, ''), $4, $5, $6)
      RETURNING id, name, username, email, role, active, position_id AS "positionId"`,
      [name, username, String(body.email ?? '').trim(), passwordHash, role, positionId]);
    return result.rows[0];
  }

  async update(id: number, body: Record<string, unknown>) {
    const current = await this.db.query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (!current.rows[0]) throw new NotFoundException('Usuario no encontrado.');
    const name = String(body.name ?? current.rows[0].name).trim();
    const role = body.role === 'ADMIN' || body.role === 'CONSULTA' ? body.role : current.rows[0].role;
    const active = body.active === undefined ? current.rows[0].active : Boolean(body.active);
    let passwordHash = current.rows[0].password_hash;
    if (body.password) passwordHash = await bcrypt.hash(String(body.password), 12);
    const result = await this.db.query(`UPDATE users SET name = $1, role = $2, active = $3, password_hash = $4, updated_at = NOW()
      WHERE id = $5 RETURNING id, name, username, email, role, active, position_id AS "positionId"`,
      [name, role, active, passwordHash, id]);
    return result.rows[0];
  }
}
