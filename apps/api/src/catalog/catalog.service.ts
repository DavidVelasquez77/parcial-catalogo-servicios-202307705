import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type CatalogKind = 'classes' | 'criticalities' | 'types';
const TABLES: Record<CatalogKind, string> = { classes: 'service_classes', criticalities: 'criticalities', types: 'service_types' };

@Injectable()
export class CatalogService {
  constructor(private readonly db: DatabaseService) {}

  private table(kind: string) {
    const table = TABLES[kind as CatalogKind];
    if (!table) throw new BadRequestException('Catálogo inválido.');
    return table;
  }

  async list(kind: string) {
    const result = await this.db.query(`SELECT id, label, active FROM ${this.table(kind)} ORDER BY active DESC, label ASC`);
    return result.rows;
  }

  async create(kind: string, body: Record<string, unknown>) {
    const label = String(body.label ?? '').trim();
    if (!label) throw new BadRequestException('La etiqueta es obligatoria.');
    const result = await this.db.query(`INSERT INTO ${this.table(kind)}(label) VALUES($1) RETURNING *`, [label]);
    return result.rows[0];
  }

  async update(kind: string, id: number, body: Record<string, unknown>) {
    const result = await this.db.query(`UPDATE ${this.table(kind)} SET label = COALESCE(NULLIF($1, ''), label), active = COALESCE($2, active) WHERE id = $3 RETURNING *`, [String(body.label ?? ''), body.active === undefined ? null : Boolean(body.active), id]);
    if (!result.rows[0]) throw new NotFoundException('Opción no encontrada.');
    return result.rows[0];
  }
}
