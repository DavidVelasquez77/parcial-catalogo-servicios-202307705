import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';

const deskRoles = ['ADMIN','CONSULTA','SOLICITANTE','AGENTE','APROBADOR'] as const;

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
    const role = body.role === undefined ? 'CONSULTA' : String(body.role);
    if (!deskRoles.includes(role as typeof deskRoles[number])) throw new BadRequestException('Rol no válido.');
    const positionId = Number(body.positionId);
    if (!name || !username || password.length < 8 || !Number.isInteger(positionId)) {
      throw new BadRequestException('Nombre, usuario, contraseña de 8 caracteres y puesto son obligatorios.');
    }
    const duplicate = await this.db.query(`SELECT id FROM users WHERE username = $1 OR email = NULLIF($2, '')`, [username, String(body.email ?? '').trim()]);
    if (duplicate.rows[0]) throw new ConflictException('El usuario o correo ya está registrado.');
    await this.assertActivePositionHierarchy(positionId);
    const passwordHash = await bcrypt.hash(password, 12);
    return this.db.transaction(async (client) => {
      const result = await client.query(`INSERT INTO users(name, username, email, password_hash, role, position_id)
        VALUES($1, $2, NULLIF($3, ''), $4, $5, $6)
        RETURNING id, name, username, email, role, active, position_id AS "positionId"`,
        [name, username, String(body.email ?? '').trim(), passwordHash, role, positionId]);
      await client.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)', [result.rows[0].id,role]);
      return result.rows[0];
    });
  }

  async update(id: number, body: Record<string, unknown>) {
    const current = await this.db.query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (!current.rows[0]) throw new NotFoundException('Usuario no encontrado.');
    const name = String(body.name ?? current.rows[0].name).trim();
    const role = body.role === undefined ? current.rows[0].role : String(body.role);
    if (!deskRoles.includes(role as typeof deskRoles[number])) throw new BadRequestException('Rol no válido.');
    const active = body.active === undefined ? current.rows[0].active : Boolean(body.active);
    const email = String(body.email ?? current.rows[0].email ?? '').trim();
    const positionId = body.positionId === undefined ? Number(current.rows[0].position_id) : Number(body.positionId);
    if (!Number.isInteger(positionId)) throw new BadRequestException('Debes seleccionar un puesto válido.');
    const duplicate = await this.db.query(`SELECT id FROM users WHERE email = NULLIF($1, '') AND id <> $2`, [email, id]);
    if (duplicate.rows[0]) throw new ConflictException('El correo ya está registrado.');
    await this.assertActivePositionHierarchy(positionId);
    if (!active || (current.rows[0].role === 'AGENTE' && role !== 'AGENTE')) {
      const open = await this.db.query(`SELECT id FROM tickets
        WHERE assigned_user_id=$1 AND state NOT IN ('CLOSED','REJECTED') LIMIT 1`, [id]);
      if (open.rows[0]) throw new ConflictException('Reasigna los tickets abiertos antes de desactivar o retirar al agente.');
    }
    let passwordHash = current.rows[0].password_hash;
    if (body.password) passwordHash = await bcrypt.hash(String(body.password), 12);
    return this.db.transaction(async (client) => {
      const result = await client.query(`UPDATE users SET name = $1, email = NULLIF($2, ''), role = $3, position_id = $4, active = $5, password_hash = $6, updated_at = NOW()
        WHERE id = $7 RETURNING id, name, username, email, role, active, position_id AS "positionId"`,
        [name, email, role, positionId, active, passwordHash, id]);
      if (body.role !== undefined && role !== current.rows[0].role) {
        await client.query('DELETE FROM user_roles WHERE user_id=$1', [id]);
        await client.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)', [id,role]);
      }
      return result.rows[0];
    });
  }

  async setRoles(id: number, body: Record<string, unknown>) {
    if (!Array.isArray(body.roles) || !body.roles.length ||
      body.roles.some((role) => !deskRoles.includes(role as typeof deskRoles[number]))) {
      throw new BadRequestException('Indica al menos un rol válido.');
    }
    const roles = [...new Set(body.roles as string[])];
    if (roles.includes('CONSULTA') && roles.length > 1) throw new BadRequestException('El rol CONSULTA debe permanecer de solo lectura.');
    return this.db.transaction(async (client) => {
      const user = await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [id]);
      if (!user.rows[0]) throw new NotFoundException('Usuario no encontrado.');
      if (!roles.includes('AGENTE') && !roles.includes('ADMIN')) {
        const open = await client.query(`SELECT id FROM tickets
          WHERE assigned_user_id=$1 AND state NOT IN ('CLOSED','REJECTED') LIMIT 1`, [id]);
        if (open.rows[0]) throw new ConflictException('Reasigna los tickets abiertos antes de retirar el permiso de agente.');
      }
      await client.query('DELETE FROM user_roles WHERE user_id=$1', [id]);
      for (const role of roles) await client.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)', [id,role]);
      await client.query('UPDATE users SET role=$1,updated_at=NOW() WHERE id=$2', [roles.includes('ADMIN') ? 'ADMIN' : roles[0],id]);
      return { id, roles };
    });
  }
}
