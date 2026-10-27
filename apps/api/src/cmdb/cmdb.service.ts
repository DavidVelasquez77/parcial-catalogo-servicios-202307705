import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const relationTypes = ['DEPENDS_ON', 'CONNECTED_TO', 'HOSTED_ON', 'PARENT_OF'] as const;
const itemStatuses = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED', 'UNKNOWN'] as const;

function positiveId(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new BadRequestException(`${label} debe ser un identificador válido.`);
  return number;
}

function textValue(value: unknown, label: string, max = 240): string {
  const valueText = String(value ?? '').trim();
  if (!valueText || valueText.length > max) throw new BadRequestException(`${label} es obligatorio y admite hasta ${max} caracteres.`);
  return valueText;
}

@Injectable()
export class CmdbService {
  constructor(private readonly db: DatabaseService) {}

  async categories() {
    const result = await this.db.query(`SELECT id, code, name, parent_id AS "parentId",
      source_kind AS "sourceKind", source_reference AS "sourceReference", active
      FROM ci_categories ORDER BY parent_id NULLS FIRST, name`);
    return result.rows;
  }

  async createCategory(body: Record<string, unknown>) {
    const code = textValue(body.code, 'Código', 50);
    const name = textValue(body.name, 'Nombre', 160);
    const parentId = body.parentId == null ? null : positiveId(body.parentId, 'Padre');
    return this.db.transaction(async (client) => {
      if (parentId) {
        const parent = await client.query('SELECT active FROM ci_categories WHERE id=$1', [parentId]);
        if (!parent.rows[0]?.active) throw new BadRequestException('La categoría padre no existe o está inactiva.');
      }
      const duplicate = await client.query('SELECT id FROM ci_categories WHERE code=$1', [code]);
      if (duplicate.rows[0]) throw new ConflictException('El código de categoría ya existe.');
      const inserted = await client.query(`INSERT INTO ci_categories(code,name,parent_id,source_kind,source_reference)
        VALUES($1,$2,$3,'PROJECT','Decisión del proyecto; no proviene de CMDB.xlsx')
        RETURNING id,code,name,parent_id AS "parentId",source_kind AS "sourceKind",source_reference AS "sourceReference",active`,
        [code, name, parentId]);
      return inserted.rows[0];
    });
  }

  async updateCategory(id: number, body: Record<string, unknown>) {
    return this.db.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(22026)');
      const current = await client.query('SELECT * FROM ci_categories WHERE id=$1 FOR UPDATE', [id]);
      if (!current.rows[0]) throw new NotFoundException('Categoría no encontrada.');
      const parentId = body.parentId === undefined ? current.rows[0].parent_id
        : body.parentId === null ? null : positiveId(body.parentId, 'Padre');
      if (parentId === id) throw new BadRequestException('Una categoría no puede ser su propio padre.');
      if (parentId) {
        const ancestors = await client.query(`WITH RECURSIVE chain AS (
          SELECT id,parent_id,active FROM ci_categories WHERE id=$1
          UNION ALL SELECT c.id,c.parent_id,c.active FROM ci_categories c JOIN chain p ON c.id=p.parent_id
        ) SELECT id,active FROM chain`, [parentId]);
        if (!ancestors.rows.length || ancestors.rows.some((row) => !row.active)) throw new BadRequestException('El padre no existe o tiene un antecesor inactivo.');
        if (ancestors.rows.some((row) => Number(row.id) === id)) throw new BadRequestException('La jerarquía no puede contener ciclos.');
      }
      const name = body.name === undefined ? current.rows[0].name : textValue(body.name, 'Nombre', 160);
      const active = body.active === undefined ? current.rows[0].active : body.active === true;
      if (!active) {
        const dependencies = await client.query(`SELECT
          (SELECT COUNT(*)::int FROM ci_categories WHERE parent_id=$1 AND active) AS children,
          (SELECT COUNT(*)::int FROM configuration_items WHERE category_id=$1 AND status<>'RETIRED') AS items`, [id]);
        if (dependencies.rows[0].children || dependencies.rows[0].items) throw new ConflictException('Desactiva o reasigna las categorías y CI dependientes antes.');
      }
      const updated = await client.query(`UPDATE ci_categories SET name=$1,parent_id=$2,active=$3
        WHERE id=$4 RETURNING id,code,name,parent_id AS "parentId",active`, [name, parentId, active, id]);
      return updated.rows[0];
    });
  }

  async locations() {
    const result = await this.db.query('SELECT id,code,name,active FROM ci_locations ORDER BY name,id');
    return result.rows;
  }

  async createLocation(body: Record<string, unknown>) {
    const code = textValue(body.code, 'Código', 50);
    const name = textValue(body.name, 'Nombre', 160);
    return this.db.transaction(async (client) => {
      const duplicate = await client.query('SELECT id FROM ci_locations WHERE code=$1', [code]);
      if (duplicate.rows[0]) throw new ConflictException('El código de ubicación ya existe.');
      const result = await client.query('INSERT INTO ci_locations(code,name) VALUES($1,$2) RETURNING id,code,name,active', [code,name]);
      return result.rows[0];
    });
  }

  async updateLocation(id: number, body: Record<string, unknown>, actorId: number) {
    return this.db.transaction(async (client) => {
      const current = await client.query('SELECT id,code,name,active FROM ci_locations WHERE id=$1 FOR UPDATE', [id]);
      if (!current.rows[0]) throw new NotFoundException('Ubicación no encontrada.');
      const previous = current.rows[0];
      const name = body.name === undefined ? previous.name : textValue(body.name, 'Nombre', 160);
      if (body.active !== undefined && typeof body.active !== 'boolean') throw new BadRequestException('El estado de la ubicación debe ser verdadero o falso.');
      const active = body.active === undefined ? previous.active : body.active;
      if (!active) {
        const linked = await client.query(`SELECT 1 FROM configuration_items
          WHERE location_id=$1 AND status<>'RETIRED' LIMIT 1`, [id]);
        if (linked.rows[0]) throw new ConflictException('Reasigna o retira los CI vinculados antes de desactivar la ubicación.');
      }
      if (name !== previous.name) {
        const changed = await client.query(`UPDATE configuration_items SET location=$1,updated_at=NOW()
          WHERE location_id=$2 RETURNING id`, [name,id]);
        if (changed.rowCount) {
          await client.query(`INSERT INTO ci_history(ci_id,actor_id,action,old_values,new_values)
            SELECT id,$1,'LOCATION_RENAME',jsonb_build_object('location',$2::text),
              jsonb_build_object('location',$3::text) FROM configuration_items WHERE location_id=$4`,
          [actorId,previous.name,name,id]);
        }
      }
      const result = await client.query(`UPDATE ci_locations SET name=$1,active=$2 WHERE id=$3
        RETURNING id,code,name,active`, [name,active,id]);
      return result.rows[0];
    });
  }

  async items(query: Record<string, string | undefined>) {
    const page = Math.max(1, Math.min(100000, Number(query.page) || 1));
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 20));
    const search = String(query.search ?? '').trim();
    const categoryId = query.categoryId ? positiveId(query.categoryId, 'Categoría') : null;
    const status = query.status?.trim() || null;
    if (status && !itemStatuses.includes(status as typeof itemStatuses[number])) throw new BadRequestException('Estado no válido.');
    const where = `WHERE ($1='' OR ci.code ILIKE '%'||$1||'%' OR ci.name ILIKE '%'||$1||'%')
      AND ($2::int IS NULL OR ci.category_id=$2)
      AND ($3::text IS NULL OR ci.status=$3)`;
    const values = [search, categoryId, status];
    const [count, rows] = await Promise.all([
      this.db.query(`SELECT COUNT(*)::int AS total FROM configuration_items ci ${where}`, values),
      this.db.query(`SELECT ci.id,ci.code,ci.name,ci.status,ci.location,
        ci.category_id AS "categoryId",cc.name AS "categoryName",
        ci.responsible_user_id AS "responsibleUserId"
        FROM configuration_items ci JOIN ci_categories cc ON cc.id=ci.category_id
        ${where} ORDER BY ci.id LIMIT $4 OFFSET $5`, [...values, pageSize, (page - 1) * pageSize]),
    ]);
    return { data: rows.rows, total: count.rows[0].total, page, pageSize };
  }

  async item(id: number) {
    const result = await this.db.query(`SELECT ci.*,cc.code AS category_code,cc.name AS category_name
      FROM configuration_items ci JOIN ci_categories cc ON cc.id=ci.category_id WHERE ci.id=$1`, [id]);
    if (!result.rows[0]) throw new NotFoundException('CI no encontrado.');
    const [relations, services, tickets, history, classification] = await Promise.all([
      this.db.query('SELECT * FROM ci_relations WHERE from_ci_id=$1 OR to_ci_id=$1 ORDER BY id', [id]),
      this.db.query(`SELECT s.id,s.code,s.name FROM ci_services cs JOIN service_level_2 s ON s.id=cs.service_id WHERE cs.ci_id=$1`, [id]),
      this.db.query(`SELECT t.id,t.number,t.title,t.state FROM ticket_ci tc JOIN tickets t ON t.id=tc.ticket_id WHERE tc.ci_id=$1 ORDER BY t.created_at DESC LIMIT 50`, [id]),
      this.db.query('SELECT * FROM ci_history WHERE ci_id=$1 ORDER BY created_at DESC LIMIT 100', [id]),
      this.db.query(`WITH RECURSIVE chain AS (
        SELECT id,code,name,parent_id,0 AS depth FROM ci_categories WHERE id=$1
        UNION ALL SELECT p.id,p.code,p.name,p.parent_id,c.depth+1
        FROM ci_categories p JOIN chain c ON p.id=c.parent_id WHERE c.depth<20
      ) SELECT id,code,name FROM chain ORDER BY depth DESC`, [result.rows[0].category_id]),
    ]);
    return { ...result.rows[0], classificationPath: classification.rows,
      relations: relations.rows, services: services.rows, tickets: tickets.rows, history: history.rows };
  }

  async createItem(body: Record<string, unknown>, actorId: number) {
    const code = textValue(body.code, 'Código', 80);
    const name = textValue(body.name, 'Nombre');
    const categoryId = positiveId(body.categoryId, 'Categoría');
    const locationId = body.locationId == null ? null : positiveId(body.locationId, 'Ubicación controlada');
    let location: string;
    if (locationId) {
      const controlled = await this.db.query('SELECT name FROM ci_locations WHERE id=$1 AND active', [locationId]);
      if (!controlled.rows[0]) throw new BadRequestException('La ubicación controlada no existe o está inactiva.');
      location = controlled.rows[0].name;
      if (body.location != null && String(body.location).trim() !== location) throw new BadRequestException('La ubicación escrita no coincide con la ubicación controlada.');
    } else {
      location = textValue(body.location, 'Ubicación');
    }
    const status = String(body.status ?? 'ACTIVE');
    if (!itemStatuses.includes(status as typeof itemStatuses[number])) throw new BadRequestException('Estado no válido.');
    const category = await this.db.query('SELECT active FROM ci_categories WHERE id=$1', [categoryId]);
    if (!category.rows[0]?.active) throw new BadRequestException('La categoría no existe o está inactiva.');
    const responsibleUserId = body.responsibleUserId == null ? null : positiveId(body.responsibleUserId,'Responsable');
    const responsibleLabel = body.responsibleLabel == null ? null : String(body.responsibleLabel).trim() || null;
    if (!responsibleUserId && !responsibleLabel) throw new BadRequestException('El CI requiere un usuario o equipo responsable.');
    if (responsibleUserId) {
      const owner = await this.db.query('SELECT active FROM users WHERE id=$1',[responsibleUserId]);
      if (!owner.rows[0]?.active) throw new BadRequestException('El usuario responsable no existe o está inactivo.');
    }
    const duplicate = await this.db.query('SELECT id FROM configuration_items WHERE code=$1', [code]);
    if (duplicate.rows[0]) throw new ConflictException('El código de CI ya existe.');
    const technical = body.technicalAttributes ?? {};
    if (!technical || typeof technical !== 'object' || Array.isArray(technical)) throw new BadRequestException('Los atributos técnicos deben ser un objeto.');
    return this.db.transaction(async (client) => {
      const created = await client.query(`INSERT INTO configuration_items
        (code,name,category_id,is_device,description,serial_number,version,acquired_on,status,location,location_id,
         responsible_user_id,responsible_label,documentation_url,security_level,compliance_status,
         configuration_status,license_number,license_expires_on,technical_attributes,source_reference)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$21,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        RETURNING *`,
        [code,name,categoryId,body.isDevice !== false,body.description ?? null,body.serialNumber ?? null,body.version ?? null,
          body.acquiredOn ?? null,status,location,responsibleUserId,responsibleLabel,
          body.documentationUrl ?? null,body.securityLevel ?? null,body.complianceStatus ?? null,
          body.configurationStatus ?? null,body.licenseNumber ?? null,body.licenseExpiresOn ?? null,
          JSON.stringify(technical),body.sourceReference ?? null,locationId]);
      await client.query(`INSERT INTO ci_history(ci_id,actor_id,action,new_values)
        VALUES($1,$2,'CREATE',$3::jsonb)`, [created.rows[0].id, actorId, JSON.stringify(created.rows[0])]);
      return created.rows[0];
    });
  }

  async updateItem(id: number, body: Record<string, unknown>, actorId: number) {
    return this.db.transaction(async (client) => {
      const current = await client.query('SELECT * FROM configuration_items WHERE id=$1 FOR UPDATE', [id]);
      if (!current.rows[0]) throw new NotFoundException('CI no encontrado.');
      const old = current.rows[0];
      const categoryId = body.categoryId === undefined ? old.category_id : positiveId(body.categoryId, 'Categoría');
      const category = await client.query('SELECT active FROM ci_categories WHERE id=$1', [categoryId]);
      if (!category.rows[0]?.active) throw new BadRequestException('La categoría no existe o está inactiva.');
      const responsibleUserId = body.responsibleUserId === undefined ? old.responsible_user_id :
        body.responsibleUserId === null ? null : positiveId(body.responsibleUserId,'Responsable');
      const responsibleLabel = body.responsibleLabel === undefined ? old.responsible_label :
        body.responsibleLabel === null ? null : String(body.responsibleLabel).trim() || null;
      if (!responsibleUserId && !responsibleLabel) throw new BadRequestException('El CI requiere un usuario o equipo responsable.');
      if (responsibleUserId) {
        const owner = await client.query('SELECT active FROM users WHERE id=$1',[responsibleUserId]);
        if (!owner.rows[0]?.active) throw new BadRequestException('El usuario responsable no existe o está inactivo.');
      }
      const status = String(body.status ?? old.status);
      if (!itemStatuses.includes(status as typeof itemStatuses[number])) throw new BadRequestException('Estado no válido.');
      const technical = body.technicalAttributes ?? old.technical_attributes;
      if (!technical || typeof technical !== 'object' || Array.isArray(technical)) throw new BadRequestException('Los atributos técnicos deben ser un objeto.');
      let locationId: number | null = old.location_id;
      let location: string = old.location;
      if (body.locationId !== undefined) {
        locationId = body.locationId === null ? null : positiveId(body.locationId, 'Ubicación controlada');
        if (locationId) {
          const controlled = await client.query('SELECT name FROM ci_locations WHERE id=$1 AND active', [locationId]);
          if (!controlled.rows[0]) throw new BadRequestException('La ubicación controlada no existe o está inactiva.');
          location = controlled.rows[0].name;
          if (body.location != null && String(body.location).trim() !== location) throw new BadRequestException('La ubicación escrita no coincide con la ubicación controlada.');
        } else {
          location = textValue(body.location, 'Ubicación');
        }
      } else if (body.location !== undefined) {
        const newLocation = textValue(body.location, 'Ubicación');
        if (newLocation !== old.location) { locationId = null; location = newLocation; }
      }
      const updated = await client.query(`UPDATE configuration_items SET
        name=$1,category_id=$2,is_device=$19,description=$3,serial_number=$4,version=$5,acquired_on=$6,
        status=$7,location=$8,location_id=$20,responsible_user_id=$9,responsible_label=$10,documentation_url=$11,
        security_level=$12,compliance_status=$13,configuration_status=$14,license_number=$15,
        license_expires_on=$16,technical_attributes=$17::jsonb,updated_at=NOW()
        WHERE id=$18 RETURNING *`,
        [body.name === undefined ? old.name : textValue(body.name, 'Nombre'),categoryId,
          body.description ?? old.description,body.serialNumber ?? old.serial_number,
          body.version ?? old.version,body.acquiredOn ?? old.acquired_on,status,
          location,
          responsibleUserId,responsibleLabel,
          body.documentationUrl ?? old.documentation_url,body.securityLevel ?? old.security_level,
          body.complianceStatus ?? old.compliance_status,body.configurationStatus ?? old.configuration_status,
          body.licenseNumber ?? old.license_number,body.licenseExpiresOn ?? old.license_expires_on,
          JSON.stringify(technical),id,body.isDevice === undefined ? old.is_device : body.isDevice === true,locationId]);
      await client.query(`INSERT INTO ci_history(ci_id,actor_id,action,old_values,new_values)
        VALUES($1,$2,'UPDATE',$3::jsonb,$4::jsonb)`,
        [id, actorId, JSON.stringify(old), JSON.stringify(updated.rows[0])]);
      return updated.rows[0];
    });
  }

  async createRelation(body: Record<string, unknown>) {
    const fromId = positiveId(body.fromCiId, 'CI origen');
    const toId = positiveId(body.toCiId, 'CI destino');
    const relationType = String(body.relationType ?? '');
    if (fromId === toId) throw new BadRequestException('Un CI no puede relacionarse consigo mismo.');
    if (!relationTypes.includes(relationType as typeof relationTypes[number])) throw new BadRequestException('Tipo de relación no válido.');
    return this.db.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(22027)');
      const found = await client.query('SELECT id FROM configuration_items WHERE id=ANY($1::bigint[])', [[fromId,toId]]);
      if (found.rowCount !== 2) throw new BadRequestException('Ambos CI deben existir.');
      if (relationType === 'PARENT_OF') {
        const assigned = await client.query(`SELECT from_ci_id FROM ci_relations
          WHERE to_ci_id=$1 AND relation_type='PARENT_OF' LIMIT 1`, [toId]);
        if (assigned.rows[0]) throw new ConflictException('El CI componente ya pertenece a un CI padre.');
      }
      if (relationType !== 'CONNECTED_TO') {
        const acyclicTypes = relationType === 'PARENT_OF'
          ? ['PARENT_OF'] : ['DEPENDS_ON','HOSTED_ON'];
        const cycle = await client.query(`WITH RECURSIVE reachable(id) AS (
          SELECT to_ci_id FROM ci_relations WHERE from_ci_id=$1 AND relation_type=ANY($3::text[])
          UNION SELECT r.to_ci_id FROM ci_relations r JOIN reachable x ON r.from_ci_id=x.id
          WHERE r.relation_type=ANY($3::text[])
        ) SELECT 1 FROM reachable WHERE id=$2 LIMIT 1`, [toId,fromId,acyclicTypes]);
        if (cycle.rows[0]) throw new ConflictException('Esta relación crearía un ciclo no permitido.');
      }
      const exists = await client.query('SELECT id FROM ci_relations WHERE from_ci_id=$1 AND to_ci_id=$2 AND relation_type=$3', [fromId,toId,relationType]);
      if (exists.rows[0]) throw new ConflictException('La relación ya existe.');
      const inserted = await client.query(`INSERT INTO ci_relations(from_ci_id,to_ci_id,relation_type,description)
        VALUES($1,$2,$3,$4) RETURNING *`, [fromId,toId,relationType,body.description ?? null]);
      return inserted.rows[0];
    });
  }

  async linkService(body: Record<string, unknown>) {
    const ciId = positiveId(body.ciId, 'CI');
    const serviceId = positiveId(body.serviceId, 'Servicio');
    const result = await this.db.query(`INSERT INTO ci_services(ci_id,service_id)
      VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING *`, [ciId,serviceId]);
    return { linked: result.rowCount === 1 };
  }

  async impact(id: number) {
    const item = await this.db.query('SELECT id FROM configuration_items WHERE id=$1', [id]);
    if (!item.rows[0]) throw new NotFoundException('CI no encontrado.');
    const result = await this.db.query(`WITH RECURSIVE affected(id) AS (
      SELECT $1::bigint
      UNION
      SELECT r.from_ci_id FROM ci_relations r JOIN affected a ON r.to_ci_id=a.id
      WHERE r.relation_type IN ('DEPENDS_ON','HOSTED_ON')
    )
    SELECT DISTINCT ci.id,ci.code,ci.name,s.id AS service_id,s.code AS service_code,s.name AS service_name
    FROM affected a JOIN configuration_items ci ON ci.id=a.id
    LEFT JOIN ci_services cs ON cs.ci_id=ci.id LEFT JOIN service_level_2 s ON s.id=cs.service_id
    ORDER BY ci.id,s.id`, [id]);
    return { sourceCiId: id, potentiallyAffected: result.rows,
      note: 'Dependencia potencial; no confirma una interrupción efectiva.' };
  }
}
