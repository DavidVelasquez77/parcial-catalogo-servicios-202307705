import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type Kind = 'companies' | 'areas' | 'departments' | 'sections' | 'positions';
type Meta = { table: string; parentTable?: string; parentColumn?: string; parentKey?: string };

const META: Record<Kind, Meta> = {
  companies: { table: 'companies' },
  areas: { table: 'areas', parentTable: 'companies', parentColumn: 'company_id', parentKey: 'companyId' },
  departments: { table: 'departments', parentTable: 'areas', parentColumn: 'area_id', parentKey: 'areaId' },
  sections: { table: 'sections', parentTable: 'departments', parentColumn: 'department_id', parentKey: 'departmentId' },
  positions: { table: 'positions', parentTable: 'sections', parentColumn: 'section_id', parentKey: 'sectionId' },
};

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  private meta(kind: string): Meta {
    const meta = META[kind as Kind];
    if (!meta) throw new BadRequestException('Entidad organizacional inválida.');
    return meta;
  }

  async list(kind: string) {
    const meta = this.meta(kind);
    const parentAlias = meta.parentColumn && meta.parentKey ? `, ${meta.parentColumn} AS "${meta.parentKey}"` : '';
    const result = await this.db.query(`SELECT *${parentAlias} FROM ${meta.table} ORDER BY active DESC, code ASC`);
    return result.rows;
  }

  async create(kind: string, body: Record<string, unknown>) {
    const meta = this.meta(kind);
    const code = String(body.code ?? '').trim();
    const name = String(body.name ?? '').trim();
    if (!code || !name) throw new BadRequestException('Código y nombre son obligatorios.');
    const values: unknown[] = [code, name];
    let columns = 'code, name';
    let placeholders = '$1, $2';
    if (meta.parentColumn && meta.parentKey) {
      const parentId = Number(body[meta.parentKey]);
      if (!Number.isInteger(parentId)) throw new BadRequestException('Debes seleccionar un padre válido.');
      const parent = await this.db.query(`SELECT active FROM ${meta.parentTable} WHERE id = $1`, [parentId]);
      if (!parent.rows[0]) throw new BadRequestException('El padre seleccionado no existe.');
      if (!parent.rows[0].active) throw new BadRequestException('No puedes asociar un registro a un padre inactivo.');
      values.unshift(parentId);
      columns = `${meta.parentColumn}, ${columns}`;
      placeholders = `$1, ${placeholders.replace('$1', '$2').replace('$2', '$3')}`;
    }
    const result = await this.db.query(`INSERT INTO ${meta.table} (${columns}) VALUES (${placeholders}) RETURNING *`, values);
    return result.rows[0];
  }

  async update(kind: string, id: number, body: Record<string, unknown>) {
    const meta = this.meta(kind);
    const current = await this.db.query(`SELECT * FROM ${meta.table} WHERE id = $1`, [id]);
    if (!current.rows[0]) throw new NotFoundException('Registro no encontrado.');
    const code = String(body.code ?? current.rows[0].code).trim();
    const name = String(body.name ?? current.rows[0].name).trim();
    const active = body.active === undefined ? current.rows[0].active : Boolean(body.active);
    const values: unknown[] = [code, name, active];
    let sql = `UPDATE ${meta.table} SET code = $1, name = $2, active = $3, updated_at = NOW()`;
    if (meta.parentColumn && meta.parentKey && body[meta.parentKey] !== undefined) {
      const parentId = Number(body[meta.parentKey]);
      const parent = await this.db.query(`SELECT active FROM ${meta.parentTable} WHERE id = $1`, [parentId]);
      if (!parent.rows[0] || !parent.rows[0].active) throw new BadRequestException('El padre seleccionado no existe o está inactivo.');
      values.push(parentId);
      sql += `, ${meta.parentColumn} = $4`;
    }
    values.push(id);
    const result = await this.db.query(`${sql} WHERE id = $${values.length} RETURNING *`, values);
    return result.rows[0];
  }

  async deactivate(kind: string, id: number) {
    return this.update(kind, id, { active: false });
  }
}
