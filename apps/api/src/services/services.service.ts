import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type ServicePayload = Record<string, unknown>;

@Injectable()
export class ServicesService {
  constructor(private readonly db: DatabaseService) {}

  private numberOrNull(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new BadRequestException('Los umbrales deben ser numéricos.');
    return parsed;
  }

  private statusFrom(activeCode: unknown, explicit?: unknown): 'ACTIVE' | 'INACTIVE' | 'REVIEW' {
    if (explicit === 'ACTIVE' || explicit === 'INACTIVE' || explicit === 'REVIEW') return explicit;
    if (activeCode === 'S') return 'ACTIVE';
    if (activeCode === 'N') return 'INACTIVE';
    return 'REVIEW';
  }

  private async validateAssignment(sectionId: number | null, userId: number | null) {
    if (!sectionId && userId) throw new BadRequestException('Un usuario responsable requiere una sección.');
    if (sectionId) {
      const section = await this.db.query(`SELECT active FROM sections WHERE id = $1`, [sectionId]);
      if (!section.rows[0] || !section.rows[0].active) throw new BadRequestException('La sección responsable no existe o está inactiva.');
    }
    if (userId && sectionId) {
      const user = await this.db.query(`SELECT u.id FROM users u JOIN positions p ON p.id = u.position_id WHERE u.id = $1 AND p.section_id = $2 AND u.active`, [userId, sectionId]);
      if (!user.rows[0]) throw new BadRequestException('El responsable no pertenece a la sección seleccionada o está inactivo.');
    }
  }

  async list(query: Record<string, string | undefined>) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(5, Number(query.pageSize ?? 12)));
    const values: unknown[] = [];
    const conditions: string[] = [];
    const add = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (query.search) {
      const param = add(`%${query.search}%`);
      conditions.push(`(s2.code ILIKE ${param} OR s2.name ILIKE ${param} OR s1.code ILIKE ${param} OR s1.name ILIKE ${param})`);
    }
    if (query.level1Id) conditions.push(`s2.level_1_id = ${add(Number(query.level1Id))}`);
    if (query.status) conditions.push(`s2.status = ${add(query.status)}`);
    if (query.classId) conditions.push(`s2.class_id = ${add(Number(query.classId))}`);
    if (query.criticalityId) conditions.push(`s2.criticality_id = ${add(Number(query.criticalityId))}`);
    if (query.typeId) conditions.push(`s2.type_id = ${add(Number(query.typeId))}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = add(pageSize);
    const offset = add((page - 1) * pageSize);
    const result = await this.db.query(`
      SELECT s2.id, s2.code, s2.name, s2.status, s2.active_code AS "activeCode",
        s2.description, s2.metric, s2.minimum, s2.maximum,
        s2.class_id AS "classId", s2.criticality_id AS "criticalityId", s2.type_id AS "typeId",
        s1.id AS "level1Id", s1.code AS "level1Code", s1.name AS "level1Name",
        c.label AS "classLabel", cr.label AS "criticalityLabel", t.label AS "typeLabel",
        s2.responsible_section_id AS "responsibleSectionId", sec.name AS "responsibleSectionName",
        s2.responsible_user_id AS "responsibleUserId", u.name AS "responsibleUserName",
        COUNT(*) OVER()::INTEGER AS total
      FROM service_level_2 s2
      JOIN service_level_1 s1 ON s1.id = s2.level_1_id
      LEFT JOIN service_classes c ON c.id = s2.class_id
      LEFT JOIN criticalities cr ON cr.id = s2.criticality_id
      LEFT JOIN service_types t ON t.id = s2.type_id
      LEFT JOIN sections sec ON sec.id = s2.responsible_section_id
      LEFT JOIN users u ON u.id = s2.responsible_user_id
      ${where} ORDER BY s2.code ASC LIMIT ${limit} OFFSET ${offset}`, values);
    const total = result.rows.length ? Number(result.rows[0].total) : 0;
    return { data: result.rows.map(({ total: _total, ...row }) => row), page, pageSize, total, pages: Math.ceil(total / pageSize) };
  }

  async level1List() {
    const result = await this.db.query(`SELECT id, code, name, active FROM service_level_1 ORDER BY code`);
    return result.rows;
  }

  async findOne(id: number) {
    const result = await this.db.query(`SELECT s2.*, s1.code AS "level1Code", s1.name AS "level1Name",
      c.label AS "classLabel", cr.label AS "criticalityLabel", t.label AS "typeLabel",
      sec.code AS "responsibleSectionCode", sec.name AS "responsibleSectionName", u.name AS "responsibleUserName"
      FROM service_level_2 s2 JOIN service_level_1 s1 ON s1.id = s2.level_1_id
      LEFT JOIN service_classes c ON c.id = s2.class_id LEFT JOIN criticalities cr ON cr.id = s2.criticality_id
      LEFT JOIN service_types t ON t.id = s2.type_id LEFT JOIN sections sec ON sec.id = s2.responsible_section_id
      LEFT JOIN users u ON u.id = s2.responsible_user_id WHERE s2.id = $1`, [id]);
    if (!result.rows[0]) throw new NotFoundException('Servicio no encontrado.');
    return result.rows[0];
  }

  private async validateReferences(body: ServicePayload) {
    const level1Id = Number(body.level1Id);
    if (!Number.isInteger(level1Id)) throw new BadRequestException('El servicio de nivel 1 es obligatorio.');
    const parent = await this.db.query(`SELECT id FROM service_level_1 WHERE id = $1`, [level1Id]);
    if (!parent.rows[0]) throw new BadRequestException('El servicio de nivel 1 no existe.');
    const sectionId = body.responsibleSectionId === null || body.responsibleSectionId === '' || body.responsibleSectionId === undefined ? null : Number(body.responsibleSectionId);
    const userId = body.responsibleUserId === null || body.responsibleUserId === '' || body.responsibleUserId === undefined ? null : Number(body.responsibleUserId);
    if (sectionId !== null && !Number.isInteger(sectionId)) throw new BadRequestException('Sección responsable inválida.');
    if (userId !== null && !Number.isInteger(userId)) throw new BadRequestException('Usuario responsable inválido.');
    await this.validateAssignment(sectionId, userId);
    const minimum = this.numberOrNull(body.minimum);
    const maximum = this.numberOrNull(body.maximum);
    if (minimum !== null && maximum !== null && minimum > maximum) throw new BadRequestException('El mínimo no puede ser mayor que el máximo.');
    return { level1Id, sectionId, userId, minimum, maximum };
  }

  async create(body: ServicePayload) {
    const code = String(body.code ?? '').trim();
    const name = String(body.name ?? '').trim();
    if (!code || !name) throw new BadRequestException('Código y nombre son obligatorios.');
    const refs = await this.validateReferences(body);
    const result = await this.db.query(`INSERT INTO service_level_2(code, name, level_1_id, active_code, status, class_id, criticality_id, type_id, description, metric, minimum, maximum, responsible_section_id, responsible_user_id, source_sheet, source_rows, source_transformations)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Aplicación',NULL,'Registro manual') RETURNING *`,
      [code, name, refs.level1Id, body.activeCode ?? null, this.statusFrom(body.activeCode, body.status), body.classId ?? null, body.criticalityId ?? null, body.typeId ?? null, body.description ?? null, body.metric ?? null, refs.minimum, refs.maximum, refs.sectionId, refs.userId]);
    return result.rows[0];
  }

  async update(id: number, body: ServicePayload) {
    const current = await this.db.query(`SELECT * FROM service_level_2 WHERE id = $1`, [id]);
    if (!current.rows[0]) throw new NotFoundException('Servicio no encontrado.');
    const value: ServicePayload = { ...current.rows[0], ...body, code: body.code ?? current.rows[0].code, name: body.name ?? current.rows[0].name, activeCode: body.activeCode ?? current.rows[0].active_code, status: body.status ?? current.rows[0].status, level1Id: body.level1Id ?? current.rows[0].level_1_id, responsibleSectionId: body.responsibleSectionId ?? current.rows[0].responsible_section_id, responsibleUserId: body.responsibleUserId ?? current.rows[0].responsible_user_id, minimum: body.minimum ?? current.rows[0].minimum, maximum: body.maximum ?? current.rows[0].maximum };
    const refs = await this.validateReferences(value);
    const result = await this.db.query(`UPDATE service_level_2 SET code=$1,name=$2,level_1_id=$3,active_code=$4,status=$5,class_id=$6,criticality_id=$7,type_id=$8,description=$9,metric=$10,minimum=$11,maximum=$12,responsible_section_id=$13,responsible_user_id=$14,updated_at=NOW() WHERE id=$15 RETURNING *`,
      [String(value.code), String(value.name), refs.level1Id, value.activeCode ?? null, this.statusFrom(value.activeCode, value.status), value.classId ?? null, value.criticalityId ?? null, value.typeId ?? null, value.description ?? null, value.metric ?? null, refs.minimum, refs.maximum, refs.sectionId, refs.userId, id]);
    return result.rows[0];
  }

  async deactivate(id: number) {
    const result = await this.db.query(`UPDATE service_level_2 SET status='INACTIVE', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
    if (!result.rows[0]) throw new NotFoundException('Servicio no encontrado.');
    return result.rows[0];
  }

  async dashboard() {
    const result = await this.db.query(`SELECT COUNT(*)::INTEGER AS total,
      COUNT(*) FILTER (WHERE status='ACTIVE')::INTEGER AS active,
      COUNT(*) FILTER (WHERE status='INACTIVE')::INTEGER AS inactive,
      COUNT(*) FILTER (WHERE status='REVIEW')::INTEGER AS review FROM service_level_2`);
    const levels = await this.db.query(`SELECT COUNT(*)::INTEGER AS total FROM service_level_1`);
    const imports = await this.db.query(`SELECT id, file_name AS "fileName", status, created_count AS "createdCount", updated_count AS "updatedCount", skipped_count AS "skippedCount", observed_count AS "observedCount", started_at AS "startedAt", finished_at AS "finishedAt" FROM import_runs ORDER BY id DESC LIMIT 5`);
    return { services: result.rows[0], level1Count: Number(levels.rows[0]?.total ?? 0), recentImports: imports.rows };
  }
}
