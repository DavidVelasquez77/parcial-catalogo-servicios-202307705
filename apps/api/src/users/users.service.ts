import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  private async assertActivePositionHierarchy(positionId: number) {
    const result = await this.db.query(`SELECT p.id,
      p.active AS "positionActive", s.active AS "sectionActive",
      d.active AS "departmentActive", a.active AS "areaActive",
      c.active AS "companyActive"
      FROM positions p
      JOIN sections s ON s.id = p.section_id
      JOIN departments d ON d.id = s.department_id
      JOIN areas a ON a.id = d.area_id
      JOIN companies c ON c.id = a.company_id
      WHERE p.id = $1`, [positionId]);
    const row = result.rows[0] as {
      positionActive: boolean;
      sectionActive: boolean;
      departmentActive: boolean;
      areaActive: boolean;
      companyActive: boolean;
    } | undefined;
    if (!row || !row.positionActive || !row.sectionActive || !row.departmentActive || !row.areaActive || !row.companyActive) {
      throw new BadRequestException('El puesto o algún antecesor de su jerarquía no está activo.');
    }
  }

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
    const duplicate = await this.db.query(`SELECT id FROM users WHERE username = $1 OR email = NULLIF($2, '')`, [username, String(body.email ?? '').trim()]);
    if (duplicate.rows[0]) throw new ConflictException('El usuario o correo ya está registrado.');
    await this.assertActivePositionHierarchy(positionId);
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
    const email = String(body.email ?? current.rows[0].email ?? '').trim();
    const positionId = body.positionId === undefined ? Number(current.rows[0].position_id) : Number(body.positionId);
    if (!Number.isInteger(positionId)) throw new BadRequestException('Debes seleccionar un puesto válido.');
    const duplicate = await this.db.query(`SELECT id FROM users WHERE email = NULLIF($1, '') AND id <> $2`, [email, id]);
    if (duplicate.rows[0]) throw new ConflictException('El correo ya está registrado.');
    await this.assertActivePositionHierarchy(positionId);
    let passwordHash = current.rows[0].password_hash;
    if (body.password) passwordHash = await bcrypt.hash(String(body.password), 12);
    const result = await this.db.query(`UPDATE users SET name = $1, email = NULLIF($2, ''), role = $3, position_id = $4, active = $5, password_hash = $6, updated_at = NOW()
      WHERE id = $7 RETURNING id, name, username, email, role, active, position_id AS "positionId"`,
      [name, email, role, positionId, active, passwordHash, id]);
    return result.rows[0];
  }
}
