import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { canTransition, DeskProcess, processes, processType } from './process-rules';
import { suggestIncidentCategory } from './incident-rules';

type Permission = 'can_view' | 'can_handle' | 'can_transfer' | 'can_approve' | 'can_admin';

function requiredText(value: unknown, label: string, max = 240) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new BadRequestException(`${label} es obligatorio (máximo ${max} caracteres).`);
  return text;
}
function idOf(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new BadRequestException(`${label} no válido.`);
  return number;
}
function level(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) throw new BadRequestException(`${label} debe estar entre 1 y 5.`);
  return number;
}
function optionalPositiveMinutes(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 525600) {
    throw new BadRequestException(`${label} debe ser un número entero de minutos entre 1 y 525600.`);
  }
  return number;
}
function dateFilter(value: string | undefined, label: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`${label} debe tener formato YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==value) {
    throw new BadRequestException(`${label} no es una fecha válida.`);
  }
  return parsed.toISOString();
}

@Injectable()
export class DeskService {
  constructor(private readonly db: DatabaseService) {}

  private isAdmin(user: AuthenticatedUser) { return user.roles.includes('ADMIN'); }
  private assertAdmin(user: AuthenticatedUser) {
    if (!this.isAdmin(user)) throw new ForbiddenException('Solo ADMIN puede configurar el Service Desk.');
  }
  private assertWriter(user: AuthenticatedUser) {
    if (user.roles.includes('CONSULTA')) throw new ForbiddenException('CONSULTA solo puede leer.');
  }
  private async allowed(queueId: number, user: AuthenticatedUser, permission: Permission, client?: PoolClient) {
    if (this.isAdmin(user)) return true;
    if (user.roles.includes('CONSULTA')) return false;
    const statement = `SELECT 1 FROM queue_grants g
      WHERE g.queue_id=$1 AND g.${permission}=TRUE
      AND g.expires_on >= (NOW() AT TIME ZONE 'America/Guatemala')::date
      AND (g.user_id=$2 OR g.role=ANY($3::text[])) LIMIT 1`;
    const values = [queueId,user.id,user.roles];
    const grants = client ? await client.query(statement,values) : await this.db.query(statement,values);
    return !!grants.rows[0];
  }
  private async assertAllowed(queueId: number, user: AuthenticatedUser, permission: Permission, client?: PoolClient) {
    if (!(await this.allowed(queueId,user,permission,client))) throw new ForbiddenException('No tienes permiso para esta acción en la cola.');
  }

  private sortRule(value: unknown) {
    const rule = String(value);
    if (!['PRIORITY_AGE','AGE_PRIORITY'].includes(rule)) {
      throw new BadRequestException('La regla de orden debe ser prioridad y antigüedad, o antigüedad y prioridad.');
    }
    return rule;
  }

  private validateProcessDataShape(process: DeskProcess, data: Record<string,unknown>) {
    const category = process === 'EVENT' ? data.eventCategory : process === 'INCIDENT' ? data.incidentCategory : undefined;
    if (category !== undefined && category !== null) {
      const allowed = process === 'EVENT' ? ['E0','E1','E2','E3'] : ['I0','I1','I2','I3','I4','I5','I6'];
      if (!allowed.includes(String(category))) throw new BadRequestException(`Categoría no válida para ${process}.`);
    }
    const booleanFields = process === 'INCIDENT' ? ['interruptsOrDegrades','redundancyAvailable'] : [];
    for (const key of booleanFields) {
      if (data[key] !== undefined && data[key] !== null && typeof data[key] !== 'boolean') {
        throw new BadRequestException(`${key} debe ser verdadero o falso.`);
      }
    }
    if (process === 'INCIDENT') {
      for (const key of ['estimatedMinutes','actualMinutes']) {
        const value = data[key];
        if (value !== undefined && value !== null &&
          (!Number.isSafeInteger(Number(value)) || Number(value) < 0)) {
          throw new BadRequestException(`${key} debe ser un número entero de minutos no negativo.`);
        }
      }
    }
    if (process === 'ACCESS' && data.accessAction !== undefined &&
      !['GRANT','REVOKE'].includes(String(data.accessAction))) {
      throw new BadRequestException('La acción de acceso debe ser conceder o revocar.');
    }
  }

  private validateIncidentFacts(data: Record<string,unknown>) {
    const category = String(data.incidentCategory ?? '');
    if (!['I0','I1','I2','I3','I4','I5','I6'].includes(category)) {
      throw new BadRequestException('El incidente requiere categoría I0-I6.');
    }
    if (typeof data.interruptsOrDegrades !== 'boolean') {
      throw new BadRequestException('Indica si el incidente causa interrupción o degradación.');
    }
    if (category === 'I0' && data.interruptsOrDegrades) {
      throw new BadRequestException('La categoría I0 corresponde a un caso sin interrupción ni degradación.');
    }
    if (['I1','I2','I3','I4','I5'].includes(category) && !data.interruptsOrDegrades) {
      throw new BadRequestException('Las categorías I1-I5 requieren interrupción o degradación.');
    }
    if (['I1','I2','I3','I4','I5'].includes(category)) {
      const estimate = data.estimatedMinutes;
      if (estimate === undefined || estimate === null) {
        throw new BadRequestException('Registra la duración estimada para justificar la categoría I1-I5.');
      }
      if (!Number.isSafeInteger(Number(estimate)) || Number(estimate) < 1) {
        throw new BadRequestException('La duración estimada debe ser un número entero de minutos mayor que cero.');
      }
      const suggestion = suggestIncidentCategory({securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:Number(estimate)});
      if (suggestion.category !== category) {
        throw new BadRequestException(`La duración estimada corresponde a ${suggestion.category ?? 'revisión manual'}, no a ${category}.`);
      }
    }
  }

  private requireEvidence(data: Record<string,unknown>, key: string, label: string) {
    return requiredText(data[key],label,5000);
  }

  private async assertResponsibleUser(id: number, client: PoolClient) {
    const result = await client.query(`SELECT 1 FROM users u WHERE u.id=$1 AND u.active
      AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role IN ('ADMIN','AGENTE'))
      AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='CONSULTA')
      FOR UPDATE OF u`, [id]);
    if (!result.rows[0]) throw new BadRequestException('El responsable de la cola debe ser un administrador o agente activo.');
  }

  private async ensureResponsibleAccess(queueId: number, responsibleId: number, client: PoolClient) {
    const existing = await client.query(`SELECT id FROM queue_grants
      WHERE queue_id=$1 AND user_id=$2 AND role IS NULL FOR UPDATE`, [queueId,responsibleId]);
    if (existing.rows[0]) {
      await client.query("UPDATE queue_grants SET can_view=TRUE,can_handle=TRUE,expires_on=GREATEST(expires_on,DATE '2026-12-31') WHERE id=$1", [existing.rows[0].id]);
    } else {
      await client.query(`INSERT INTO queue_grants(queue_id,user_id,can_view,can_handle)
        VALUES($1,$2,TRUE,TRUE)`, [queueId,responsibleId]);
    }
  }

  async activeUsers() {
    const result = await this.db.query(`SELECT u.id,u.name,u.role,
      ARRAY(SELECT ur.role FROM user_roles ur WHERE ur.user_id=u.id ORDER BY ur.role) AS roles
      FROM users u WHERE u.active ORDER BY u.name`);
    return result.rows;
  }

  async queues(user: AuthenticatedUser) {
    const result = await this.db.query(`SELECT q.*,owner.name AS "responsibleName",
      EXISTS(SELECT 1 FROM queue_grants g WHERE g.queue_id=q.id AND g.can_handle AND g.expires_on >= (NOW() AT TIME ZONE 'America/Guatemala')::date
        AND (g.user_id=$1 OR g.role=ANY($2::text[]))) AS "canHandle",
      EXISTS(SELECT 1 FROM queue_grants g WHERE g.queue_id=q.id AND g.can_transfer AND g.expires_on >= (NOW() AT TIME ZONE 'America/Guatemala')::date
        AND (g.user_id=$1 OR g.role=ANY($2::text[]))) AS "canTransfer",
      EXISTS(SELECT 1 FROM queue_grants g WHERE g.queue_id=q.id AND g.can_admin AND g.expires_on >= (NOW() AT TIME ZONE 'America/Guatemala')::date
        AND (g.user_id=$1 OR g.role=ANY($2::text[]))) AS "canAdmin"
      FROM support_queues q JOIN users owner ON owner.id=q.responsible_user_id
      ORDER BY q.process,q.name`, [user.id,user.roles]);
    return result.rows;
  }

  async createQueue(body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertAdmin(user);
    const process = String(body.process ?? '');
    if (!processes.includes(process as DeskProcess)) throw new BadRequestException('Proceso no válido.');
    const code = requiredText(body.code,'Código',50);
    const name = requiredText(body.name,'Nombre',160);
    const responsibleId = idOf(body.responsibleUserId,'Responsable de cola');
    const sortRule = this.sortRule(body.sortRule ?? 'PRIORITY_AGE');
    const supportLevel = body.supportLevel === undefined ? 1 : Number(body.supportLevel);
    if (!Number.isInteger(supportLevel) || supportLevel < 0 || supportLevel > 4) throw new BadRequestException('Nivel de soporte no válido.');
    return this.db.transaction(async (client) => {
      await this.assertResponsibleUser(responsibleId,client);
      const duplicate = await client.query('SELECT id FROM support_queues WHERE code=$1', [code]);
      if (duplicate.rows[0]) throw new ConflictException('El código de cola ya existe.');
      const result = await client.query(`INSERT INTO support_queues
        (code,name,description,process,responsible_user_id,support_level,sort_rule,first_response_minutes,resolution_minutes)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [code,name,body.description ?? null,process,responsibleId,supportLevel,sortRule,
          optionalPositiveMinutes(body.firstResponseMinutes,'Objetivo de primera respuesta'),
          optionalPositiveMinutes(body.resolutionMinutes,'Objetivo de resolución')]);
      await this.ensureResponsibleAccess(result.rows[0].id,responsibleId,client);
      return result.rows[0];
    });
  }

  async updateQueue(id: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    await this.assertAllowed(id,user,'can_admin');
    return this.db.transaction(async (client) => {
      const current = await client.query('SELECT * FROM support_queues WHERE id=$1 FOR UPDATE', [id]);
      if (!current.rows[0]) throw new NotFoundException('Cola no encontrada.');
      const old = current.rows[0];
      const process = body.process === undefined ? old.process : String(body.process);
      if (!processes.includes(process as DeskProcess)) throw new BadRequestException('Proceso no válido.');
      const dependencies = await client.query(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE state NOT IN ('CLOSED','REJECTED'))::int AS open
        FROM tickets WHERE queue_id=$1`, [id]);
      if (process !== old.process && dependencies.rows[0].total) throw new ConflictException('No cambies el proceso de una cola que ya contiene tickets.');
      const active = body.active === undefined ? old.active : body.active === true;
      if (!active && dependencies.rows[0].open) throw new ConflictException('Transfiere o cierra los tickets abiertos antes de desactivar la cola.');
      const levelValue = body.supportLevel === undefined ? old.support_level : Number(body.supportLevel);
      if (!Number.isInteger(levelValue) || levelValue < 0 || levelValue > 4) throw new BadRequestException('Nivel de soporte no válido.');
      const responsibleId = body.responsibleUserId === undefined ? old.responsible_user_id : idOf(body.responsibleUserId,'Responsable de cola');
      const sortRule = body.sortRule === undefined ? old.sort_rule : this.sortRule(body.sortRule);
      await this.assertResponsibleUser(responsibleId,client);
      const updated = await client.query(`UPDATE support_queues SET name=$1,description=$2,process=$3,
        responsible_user_id=$4,support_level=$5,sort_rule=$6,first_response_minutes=$7,
        resolution_minutes=$8,active=$9,updated_at=NOW()
        WHERE id=$10 RETURNING *`,
        [body.name === undefined ? old.name : requiredText(body.name,'Nombre',160),
          body.description ?? old.description,process,responsibleId,levelValue,sortRule,
          body.firstResponseMinutes === undefined ? old.first_response_minutes : optionalPositiveMinutes(body.firstResponseMinutes,'Objetivo de primera respuesta'),
          body.resolutionMinutes === undefined ? old.resolution_minutes : optionalPositiveMinutes(body.resolutionMinutes,'Objetivo de resolución'),active,id]);
      if (active) await this.ensureResponsibleAccess(id,responsibleId,client);
      return updated.rows[0];
    });
  }

  async grant(queueId: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    const queue = await this.db.query('SELECT id FROM support_queues WHERE id=$1', [queueId]);
    if (!queue.rows[0]) throw new NotFoundException('Cola no encontrada.');
    await this.assertAllowed(queueId,user,'can_admin');
    const userId = body.userId == null ? null : idOf(body.userId,'Usuario');
    const role = body.role == null ? null : String(body.role);
    if ((userId === null) === (role === null)) throw new BadRequestException('Indica un usuario o un rol, no ambos.');
    if (role && !['AGENTE','APROBADOR','ADMIN'].includes(role)) throw new BadRequestException('Rol de cola no válido.');
    if (userId) {
      const member = await this.db.query(`SELECT u.active,
        ARRAY(SELECT role FROM user_roles WHERE user_id=u.id) AS roles FROM users u WHERE u.id=$1`, [userId]);
      if (!member.rows[0]?.active || member.rows[0].roles.includes('CONSULTA')) {
        throw new BadRequestException('El usuario no existe, está inactivo o tiene rol CONSULTA.');
      }
    }
    const flags = ['canView','canHandle','canTransfer','canApprove','canAdmin'];
    if (!flags.some((key) => body[key] === true)) throw new BadRequestException('Activa al menos un permiso.');
    const expiresOn = String(body.expiresOn ?? '2026-12-31');
    const expiryDate = new Date(`${expiresOn}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || Number.isNaN(expiryDate.getTime()) || expiryDate.toISOString().slice(0,10) !== expiresOn) throw new BadRequestException('Indica una fecha de caducidad válida.');
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guatemala',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if (expiresOn < today) throw new BadRequestException('La caducidad no puede estar en el pasado.');
    return this.db.transaction(async (client) => {
      const previous = await client.query(`SELECT * FROM queue_grants
        WHERE queue_id=$1 AND user_id IS NOT DISTINCT FROM $2
          AND role IS NOT DISTINCT FROM $3 FOR UPDATE`, [queueId,userId,role]);
      if (userId && previous.rows[0] && body.canHandle !== true) {
        const owner = await client.query('SELECT 1 FROM support_queues WHERE id=$1 AND responsible_user_id=$2 AND active', [queueId,userId]);
        if (owner.rows[0]) throw new ConflictException('Designa otro responsable antes de retirar su permiso de atención.');
      }
      if (previous.rows[0]?.can_handle && body.canHandle !== true) {
        const assigned = await client.query(`SELECT t.id FROM tickets t WHERE t.queue_id=$1
          AND t.state NOT IN ('CLOSED','REJECTED') AND t.assigned_user_id IS NOT NULL
          AND (t.assigned_user_id=$2 OR ($3::text IS NOT NULL AND EXISTS(
            SELECT 1 FROM user_roles ur WHERE ur.user_id=t.assigned_user_id AND ur.role=$3))) LIMIT 1`,
          [queueId,userId,role]);
        if (assigned.rows[0]) throw new ConflictException('Reasigna los tickets abiertos antes de retirar el permiso de atención.');
      }
      await client.query('DELETE FROM queue_grants WHERE queue_id=$1 AND user_id IS NOT DISTINCT FROM $2 AND role IS NOT DISTINCT FROM $3', [queueId,userId,role]);
      const result = await client.query(`INSERT INTO queue_grants
        (queue_id,user_id,role,can_view,can_handle,can_transfer,can_approve,can_admin,expires_on)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [queueId,userId,role,...flags.map((key) => body[key] === true),expiresOn]);
      return result.rows[0];
    });
  }

  async grants(queueId: number, user: AuthenticatedUser) {
    const queue = await this.db.query('SELECT id FROM support_queues WHERE id=$1', [queueId]);
    if (!queue.rows[0]) throw new NotFoundException('Cola no encontrada.');
    await this.assertAllowed(queueId,user,'can_admin');
    const result = await this.db.query(`SELECT g.id,g.role,g.user_id AS "userId",u.name AS "userName",
      g.can_view AS "canView",g.can_handle AS "canHandle",g.can_transfer AS "canTransfer",
      g.can_approve AS "canApprove",g.can_admin AS "canAdmin",g.expires_on::text AS "expiresOn"
      FROM queue_grants g LEFT JOIN users u ON u.id=g.user_id
      WHERE g.queue_id=$1 ORDER BY g.role NULLS LAST,u.name`, [queueId]);
    return result.rows;
  }

  private async eligibleAssignees(queueId: number, client?: PoolClient) {
    const statement = `SELECT u.id,u.name FROM users u WHERE u.active
      AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='CONSULTA')
      AND (EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='ADMIN')
        OR EXISTS (SELECT 1 FROM queue_grants g WHERE g.queue_id=$1 AND g.can_handle AND g.expires_on >= (NOW() AT TIME ZONE 'America/Guatemala')::date
          AND (g.user_id=u.id OR EXISTS (SELECT 1 FROM user_roles ur
            WHERE ur.user_id=u.id AND ur.role=g.role))))
      ORDER BY u.name,u.id`;
    const result = client ? await client.query(statement,[queueId]) : await this.db.query(statement,[queueId]);
    return result.rows as Array<{ id: number; name: string }>;
  }

  async assignees(queueId: number, user: AuthenticatedUser) {
    const queue = await this.db.query('SELECT id FROM support_queues WHERE id=$1', [queueId]);
    if (!queue.rows[0]) throw new NotFoundException('Cola no encontrada.');
    await this.assertAllowed(queueId,user,'can_admin');
    return this.eligibleAssignees(queueId);
  }

  async revoke(queueId: number, grantId: number, user: AuthenticatedUser) {
    await this.assertAllowed(queueId,user,'can_admin');
    return this.db.transaction(async (client) => {
      const grant = await client.query('SELECT * FROM queue_grants WHERE id=$1 AND queue_id=$2 FOR UPDATE', [grantId,queueId]);
      if (!grant.rows[0]) throw new NotFoundException('Permiso de cola no encontrado.');
      const row = grant.rows[0];
      if (row.user_id) {
        const owner = await client.query('SELECT 1 FROM support_queues WHERE id=$1 AND responsible_user_id=$2 AND active', [queueId,row.user_id]);
        if (owner.rows[0]) throw new ConflictException('Designa otro responsable antes de retirar su acceso a la cola.');
      }
      const open = await client.query(`SELECT t.id FROM tickets t WHERE t.queue_id=$1
        AND t.state NOT IN ('CLOSED','REJECTED') AND t.assigned_user_id IS NOT NULL
        AND (t.assigned_user_id=$2 OR ($3::text IS NOT NULL AND EXISTS(
          SELECT 1 FROM user_roles ur WHERE ur.user_id=t.assigned_user_id AND ur.role=$3))) LIMIT 1`,
        [queueId,row.user_id,row.role]);
      if (open.rows[0]) throw new ConflictException('Reasigna los tickets abiertos antes de retirar este permiso.');
      await client.query('DELETE FROM queue_grants WHERE id=$1', [grantId]);
      return {revoked:true};
    });
  }

  async tickets(query: Record<string, string | undefined>, user: AuthenticatedUser) {
    const page = Math.max(1,Math.min(100000,Number(query.page) || 1));
    const pageSize = Math.max(1,Math.min(100,Number(query.pageSize) || 20));
    const from = dateFilter(query.from,'Desde');
    const to = dateFilter(query.to,'Antes de');
    if (from && to && from >= to) throw new BadRequestException('La fecha final debe ser posterior a la inicial.');
    const params: unknown[] = [user.id,user.roles,query.search?.trim() ?? '',
      query.queueId ? idOf(query.queueId,'Cola') : null,
      query.process ?? null,query.state ?? null,
      query.priority ? level(query.priority,'Prioridad') : null];
    const where = `WHERE ($3='' OR t.number ILIKE '%'||$3||'%' OR t.title ILIKE '%'||$3||'%')
      AND ($4::int IS NULL OR t.queue_id=$4)
      AND ($5::text IS NULL OR t.process=$5)
      AND ($6::text IS NULL OR t.state=$6)
      AND ($7::int IS NULL OR t.priority=$7)
      AND ($8::int IS NULL OR t.service_id=$8)
      AND ($9::int IS NULL OR t.assigned_user_id=$9)
      AND ($10::timestamptz IS NULL OR t.created_at >= $10)
      AND ($11::timestamptz IS NULL OR t.created_at < $11)
      AND ($12::boolean OR t.requester_id=$1 OR EXISTS(
        SELECT 1 FROM queue_grants g WHERE g.queue_id=t.queue_id AND g.can_view AND g.expires_on >= (NOW() AT TIME ZONE 'America/Guatemala')::date
        AND (g.user_id=$1 OR g.role=ANY($2::text[]))))`;
    params.push(query.serviceId ? idOf(query.serviceId,'Servicio') : null,
      query.assigneeId ? idOf(query.assigneeId,'Responsable') : null,
      from,to,
      this.isAdmin(user) || user.roles.includes('CONSULTA'));
    const [count,rows] = await Promise.all([
      this.db.query(`SELECT COUNT(*)::int AS total FROM tickets t ${where}`,params),
      this.db.query(`SELECT t.id,t.number,t.title,t.type,t.process,t.state,t.priority,
        t.queue_id AS "queueId",q.name AS "queueName",t.service_id AS "serviceId",
        t.requester_id AS "requesterId",t.assigned_user_id AS "assignedUserId",
        t.created_at AS "createdAt",t.updated_at AS "updatedAt"
        FROM tickets t JOIN support_queues q ON q.id=t.queue_id ${where}
        ORDER BY CASE WHEN $4::int IS NOT NULL AND q.sort_rule='AGE_PRIORITY'
          THEN t.created_at END ASC NULLS LAST,
          t.priority DESC,t.created_at ASC,t.id ASC LIMIT $13 OFFSET $14`,
        [...params,pageSize,(page-1)*pageSize]),
    ]);
    return { data: rows.rows,total: count.rows[0].total,page,pageSize };
  }

  async createTicket(body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    const title = requiredText(body.title,'Título');
    const description = requiredText(body.description,'Descripción',10000);
    const queueId = idOf(body.queueId,'Cola');
    const serviceId = idOf(body.serviceId,'Servicio');
    const priority = level(body.priority ?? 3,'Prioridad');
    const impact = level(body.impact ?? 3,'Impacto');
    const urgency = level(body.urgency ?? 3,'Urgencia');
    const channel = String(body.channel ?? 'PORTAL');
    if (!['PORTAL','PHONE','EMAIL','IN_PERSON','SYSTEM'].includes(channel)) throw new BadRequestException('Canal no válido.');
    const ciIds = body.ciIds === undefined ? [] : body.ciIds;
    if (!Array.isArray(ciIds) || ciIds.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) < 1)) throw new BadRequestException('Lista de CI no válida.');
    const noCiReason = ciIds.length ? null : requiredText(body.noCiReason,'Motivo sin CI',1000);
    const processData = body.processData ?? {};
    if (!processData || typeof processData !== 'object' || Array.isArray(processData)) throw new BadRequestException('Los datos del proceso deben ser un objeto.');
    return this.db.transaction(async (client) => {
      const queue = await client.query('SELECT * FROM support_queues WHERE id=$1 AND active', [queueId]);
      if (!queue.rows[0]) throw new BadRequestException('La cola no existe o está inactiva.');
      const process = queue.rows[0].process as DeskProcess;
      const service = await client.query('SELECT id FROM service_level_2 WHERE id=$1 AND status=$2', [serviceId,'ACTIVE']);
      if (!service.rows[0]) throw new BadRequestException('El servicio debe existir y estar activo.');
      const requesterId = this.isAdmin(user) && body.requesterId ? idOf(body.requesterId,'Solicitante') : user.id;
      const requester = await client.query('SELECT id FROM users WHERE id=$1 AND active', [requesterId]);
      if (!requester.rows[0]) throw new BadRequestException('Solicitante inexistente o inactivo.');
      const data = processData as Record<string,unknown>;
      this.validateProcessDataShape(process,data);
      const beneficiaryId = body.beneficiaryId == null ? null : idOf(body.beneficiaryId,'Beneficiario');
      if (process === 'NEW_SERVICE') {
        this.requireEvidence(data,'need','Necesidad del nuevo servicio');
        this.requireEvidence(data,'feasibility','Evaluación de viabilidad');
        if (data.linkedServiceId) {
          const linkedId = idOf(data.linkedServiceId,'Servicio existente');
          const linked = await client.query(`SELECT id FROM service_level_2 WHERE id=$1 AND status='ACTIVE'`,[linkedId]);
          if (!linked.rows[0]) throw new BadRequestException('El servicio vinculado debe existir y estar activo.');
        } else {
          const proposedCode = requiredText(data.proposedCode,'Código propuesto',50);
          this.requireEvidence(data,'proposedName','Nombre propuesto');
          const duplicate = await client.query('SELECT id FROM service_level_2 WHERE code=$1',[proposedCode]);
          if (duplicate.rows[0]) throw new ConflictException('El código propuesto ya existe; vincula el servicio del catálogo.');
        }
      }
      if (process === 'CHANGE') {
        if (!ciIds.length) throw new BadRequestException('Un cambio debe identificar al menos un CI afectado.');
        this.requireEvidence(data,'riskAssessment','Evaluación de impacto y riesgo');
        this.requireEvidence(data,'testPlan','Plan de pruebas');
        this.requireEvidence(data,'rollbackPlan','Plan de reversión');
      }
      if (process === 'INCIDENT') this.validateIncidentFacts(data);
      if (process === 'EVENT' && !['E0','E1','E2','E3'].includes(String(data.eventCategory))) {
        throw new BadRequestException('El evento requiere categoría E0-E3.');
      }
      if (process === 'ACCESS') {
        if (!beneficiaryId || !data.resource || !data.permission) throw new BadRequestException('El acceso requiere beneficiario, recurso y permiso.');
        if (!['GRANT','REVOKE'].includes(String(data.accessAction))) throw new BadRequestException('Indica si solicitas provisión o revocación del acceso.');
      }
      if (process === 'TECH_SERVICE') this.requireEvidence(data,'request','Prestación solicitada');
      if (beneficiaryId) {
        const beneficiary = await client.query('SELECT id FROM users WHERE id=$1 AND active', [beneficiaryId]);
        if (!beneficiary.rows[0]) throw new BadRequestException('Beneficiario inexistente o inactivo.');
      }
      if (ciIds.length) {
        const found = await client.query('SELECT COUNT(*)::int AS total FROM configuration_items WHERE id=ANY($1::bigint[])', [ciIds.map(Number)]);
        if (found.rows[0].total !== new Set(ciIds.map(Number)).size) throw new BadRequestException('Algún CI no existe.');
      }
      const created = await client.query(`INSERT INTO tickets
        (title,description,requester_id,creator_id,beneficiary_id,service_id,queue_id,type,process,
         state,priority,impact,urgency,channel,process_data,no_ci_reason)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'SUBMITTED',$10,$11,$12,$13,$14::jsonb,$15)
        RETURNING *`,
        [title,description,requesterId,user.id,beneficiaryId,serviceId,queueId,
          processType[process],process,priority,impact,urgency,channel,JSON.stringify(data),noCiReason]);
      const ticketId = created.rows[0].id;
      const numbered = await client.query(`UPDATE tickets SET number='T-'||LPAD(id::text,7,'0')
        WHERE id=$1 RETURNING *`, [ticketId]);
      for (const ciId of new Set(ciIds.map(Number))) {
        await client.query('INSERT INTO ticket_ci(ticket_id,ci_id) VALUES($1,$2)', [ticketId,ciId]);
      }
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,new_values)
        VALUES($1,$2,'CREATE',$3::jsonb)`, [ticketId,user.id,JSON.stringify(numbered.rows[0])]);
      return numbered.rows[0];
    });
  }

  async ticket(id: number, user: AuthenticatedUser) {
    const result = await this.db.query(`SELECT t.*,q.name AS queue_name,s.code AS service_code,
      s.name AS service_name,l1.code AS level_1_code,l1.name AS level_1_name,
      requester.name AS requester_name,creator.name AS creator_name,assignee.name AS assigned_user_name
      FROM tickets t JOIN support_queues q ON q.id=t.queue_id
      JOIN service_level_2 s ON s.id=t.service_id JOIN service_level_1 l1 ON l1.id=s.level_1_id
      LEFT JOIN users requester ON requester.id=t.requester_id
      LEFT JOIN users creator ON creator.id=t.creator_id
      LEFT JOIN users assignee ON assignee.id=t.assigned_user_id
      WHERE t.id=$1`, [id]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Ticket no encontrado.');
    const staff = this.isAdmin(user) || await this.allowed(row.queue_id,user,'can_view');
    if (!staff && !user.roles.includes('CONSULTA') && row.requester_id !== user.id) throw new ForbiddenException('No puedes consultar este ticket.');
    const [history,comments,ci,links,attachments] = await Promise.all([
      this.db.query(`SELECT h.*,u.name AS actor_name FROM ticket_history h
        LEFT JOIN users u ON u.id=h.actor_id WHERE h.ticket_id=$1 ORDER BY h.created_at,h.id`, [id]),
      this.db.query(`SELECT * FROM ticket_comments WHERE ticket_id=$1
        AND ($2::boolean OR visibility='PUBLIC') ORDER BY created_at,id`, [id,staff]),
      this.db.query(`SELECT ci.id,ci.code,ci.name FROM ticket_ci tc
        JOIN configuration_items ci ON ci.id=tc.ci_id WHERE tc.ticket_id=$1`, [id]),
      this.db.query('SELECT * FROM ticket_links WHERE ticket_id=$1 OR related_ticket_id=$1', [id]),
      this.db.query(`SELECT id,original_name AS "originalName",mime_type AS "mimeType",
        size_bytes AS "sizeBytes",created_at AS "createdAt" FROM ticket_attachments
        WHERE ticket_id=$1 ORDER BY created_at DESC`, [id]),
    ]);
    return { ...row,history: history.rows,comments: comments.rows,ci: ci.rows,links: links.rows,attachments: attachments.rows };
  }

  async claim(id: number, user: AuthenticatedUser) {
    this.assertWriter(user);
    return this.db.transaction(async (client) => {
      const ticket = await client.query('SELECT id,queue_id,state,assigned_user_id,first_attended_at FROM tickets WHERE id=$1 FOR UPDATE', [id]);
      if (!ticket.rows[0]) throw new NotFoundException('Ticket no encontrado.');
      await this.assertAllowed(ticket.rows[0].queue_id,user,'can_handle',client);
      if (['CLOSED','REJECTED'].includes(ticket.rows[0].state)) throw new ConflictException('El ticket ya está finalizado.');
      if (ticket.rows[0].assigned_user_id) throw new ConflictException('Otro agente ya tomó este ticket.');
      const updated = await client.query(`UPDATE tickets SET assigned_user_id=$1,
        first_attended_at=COALESCE(first_attended_at,NOW()),updated_at=NOW()
        WHERE id=$2 AND assigned_user_id IS NULL RETURNING *`, [user.id,id]);
      if (!updated.rows[0]) throw new ConflictException('Otro agente ya tomó este ticket.');
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values)
        VALUES($1,$2,'CLAIM',$3::jsonb,$4::jsonb)`,
        [id,user.id,JSON.stringify({ assignedUserId: null, firstAttendedAt: ticket.rows[0].first_attended_at }),
          JSON.stringify({ assignedUserId: user.id, firstAttendedAt: updated.rows[0].first_attended_at })]);
      return updated.rows[0];
    });
  }

  async assign(id: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    const assigneeId = idOf(body.userId,'Agente');
    return this.db.transaction(async (client) => {
      const result = await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [id]);
      const ticket = result.rows[0];
      if (!ticket) throw new NotFoundException('Ticket no encontrado.');
      await this.assertAllowed(ticket.queue_id,user,'can_admin',client);
      if (['CLOSED','REJECTED'].includes(ticket.state)) throw new ConflictException('No se asigna un ticket finalizado.');
      const candidates = await this.eligibleAssignees(ticket.queue_id,client);
      if (!candidates.some((candidate) => candidate.id === assigneeId)) {
        throw new BadRequestException('El agente debe estar activo y autorizado para atender esta cola.');
      }
      if (ticket.assigned_user_id === assigneeId) return ticket;
      const updated = await client.query(`UPDATE tickets SET assigned_user_id=$1,
        first_attended_at=COALESCE(first_attended_at,NOW()),updated_at=NOW()
        WHERE id=$2 RETURNING *`, [assigneeId,id]);
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values,reason)
        VALUES($1,$2,'ASSIGN',$3::jsonb,$4::jsonb,$5)`, [id,user.id,
          JSON.stringify({ assignedUserId: ticket.assigned_user_id, firstAttendedAt: ticket.first_attended_at }),
          JSON.stringify({ assignedUserId: assigneeId, firstAttendedAt: updated.rows[0].first_attended_at }),
          body.reason == null ? null : requiredText(body.reason,'Motivo',1000)]);
      return updated.rows[0];
    });
  }

  async updateProcessData(id: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Datos del proceso no válidos.');
    return this.db.transaction(async (client) => {
      const current = await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [id]);
      const ticket = current.rows[0];
      if (!ticket) throw new NotFoundException('Ticket no encontrado.');
      await this.assertAllowed(ticket.queue_id,user,'can_handle',client);
      if (['CLOSED','REJECTED'].includes(ticket.state)) throw new ConflictException('No se modifica un ticket finalizado.');
      const process = ticket.process as DeskProcess;
      if (process === 'NEW_SERVICE' && Object.prototype.hasOwnProperty.call(body,'approvedServiceId')) {
        throw new BadRequestException('El servicio aprobado se asigna automáticamente y no se puede editar.');
      }
      if (process === 'EVENT') {
        const currentCategory = ticket.process_data?.eventCategory;
        if (Object.prototype.hasOwnProperty.call(body,'eventCategory') && body.eventCategory !== currentCategory) {
          throw new ConflictException('La categoría E0-E3 queda fijada al registrar el evento; crea otro ticket si la clasificación inicial fue incorrecta.');
        }
        if (currentCategory === 'E0' && ['assessment','response'].some((key) => Object.prototype.hasOwnProperty.call(body,key))) {
          throw new BadRequestException('E0 solo requiere el registro; no admite evaluación ni respuesta operativa.');
        }
        if (currentCategory === 'E1' && Object.prototype.hasOwnProperty.call(body,'response')) {
          throw new BadRequestException('E1 conserva su evaluación, pero no requiere respuesta operativa.');
        }
      }
      const approvalBasis: Partial<Record<DeskProcess,{states:string[];fields:string[]}>> = {
        NEW_SERVICE:{states:['APPROVED','IMPLEMENTING','RESOLVED'],fields:['need','feasibility','linkedServiceId','proposedCode','proposedName']},
        CHANGE:{states:['APPROVED','PLANNED','EXECUTING','VALIDATING','RESOLVED'],fields:['riskAssessment','testPlan','rollbackPlan']},
        ACCESS:{states:['APPROVED','PROVISIONING','VALIDATING','RESOLVED'],fields:['resource','permission','accessAction']},
      };
      const locked = approvalBasis[process];
      if (locked?.states.includes(ticket.state) && Object.keys(body).some((key) => locked.fields.includes(key))) {
        throw new ConflictException('No se puede cambiar el alcance aprobado; registra una nueva solicitud para volver a evaluarlo.');
      }
      const merged = { ...ticket.process_data, ...body };
      this.validateProcessDataShape(process,merged);
      const updated = await client.query(`UPDATE tickets SET process_data=$1::jsonb,updated_at=NOW()
        WHERE id=$2 RETURNING *`, [JSON.stringify(merged),id]);
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values)
        VALUES($1,$2,'PROCESS_DATA',$3::jsonb,$4::jsonb)`,
        [id,user.id,JSON.stringify(ticket.process_data),JSON.stringify(merged)]);
      return updated.rows[0];
    });
  }

  async transition(id: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    const to = requiredText(body.to,'Estado destino',40);
    const reason = body.reason == null ? null : requiredText(body.reason,'Motivo',1000);
    return this.db.transaction(async (client) => {
      const result = await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [id]);
      const ticket = result.rows[0];
      if (!ticket) throw new NotFoundException('Ticket no encontrado.');
      if (to === 'ESCALATED') throw new BadRequestException('Escala el incidente a una cola de nivel superior con motivo.');
      if (!canTransition(ticket.process as DeskProcess,ticket.state,to)) throw new BadRequestException('Transición no permitida para este proceso.');
      const approval = ['APPROVED','REJECTED'].includes(to);
      const reopen = ticket.state === 'CLOSED' && to === 'SUBMITTED';
      const data = ticket.process_data as Record<string,unknown>;
      if (ticket.paused_at && ['RESOLVED','CLOSED','REJECTED'].includes(to)) {
        throw new ConflictException('Reanuda el ticket antes de finalizarlo.');
      }
      if (approval) {
        await this.assertAllowed(ticket.queue_id,user,'can_approve',client);
        if (ticket.process === 'ACCESS' && ticket.requester_id === user.id) throw new ForbiddenException('El solicitante no puede autoaprobar su acceso.');
      } else if (reopen) {
        if (ticket.requester_id !== user.id && !this.isAdmin(user)) throw new ForbiddenException('Solo el solicitante o ADMIN puede reabrir.');
        if (!reason) throw new BadRequestException('La reapertura requiere motivo.');
        if (ticket.closed_at && Date.now() - new Date(ticket.closed_at).getTime() > 7 * 86400000) throw new ConflictException('La reapertura solo está disponible durante siete días.');
      } else if (to === 'CLOSED' && ticket.state === 'RESOLVED' && ticket.requester_id === user.id) {
        // El solicitante confirma el cierre.
      } else {
        await this.assertAllowed(ticket.queue_id,user,'can_handle',client);
      }
      if (to === 'RESOLVED' && !reason) throw new BadRequestException('La resolución requiere descripción de la solución.');
      if (to === 'REJECTED' && !reason) throw new BadRequestException('El rechazo requiere motivo.');
      if (ticket.process === 'NEW_SERVICE' && to === 'PENDING_APPROVAL') {
        this.requireEvidence(data,'need','Necesidad del nuevo servicio');
        this.requireEvidence(data,'feasibility','Evaluación de viabilidad');
        if (data.linkedServiceId) {
          const linked = await client.query(`SELECT id FROM service_level_2 WHERE id=$1 AND status='ACTIVE'`,
            [idOf(data.linkedServiceId,'Servicio existente')]);
          if (!linked.rows[0]) throw new BadRequestException('Vincula un servicio existente y activo del catálogo.');
        } else {
          this.requireEvidence(data,'proposedCode','Código propuesto');
          this.requireEvidence(data,'proposedName','Nombre propuesto');
        }
      }
      if (ticket.process === 'NEW_SERVICE' && to === 'IMPLEMENTING' && !data.approvedServiceId) {
        throw new ConflictException('Aprueba y crea o vincula el servicio del catálogo antes de implementarlo.');
      }
      if (ticket.process === 'NEW_SERVICE' && to === 'RESOLVED') {
        this.requireEvidence(data,'implementationResult','Resultado de implementación');
      }
      if (ticket.process === 'CHANGE' && to === 'PENDING_APPROVAL') {
        this.requireEvidence(data,'riskAssessment','Evaluación de impacto y riesgo');
        this.requireEvidence(data,'testPlan','Plan de pruebas');
        this.requireEvidence(data,'rollbackPlan','Plan de reversión');
        const affected = await client.query('SELECT 1 FROM ticket_ci WHERE ticket_id=$1 LIMIT 1',[id]);
        if (!affected.rows[0]) throw new BadRequestException('Registra al menos un CI afectado antes de solicitar aprobación.');
      }
      if (ticket.process === 'CHANGE' && to === 'EXECUTING') {
        const approved = await client.query(`SELECT 1 FROM ticket_history
          WHERE ticket_id=$1 AND action='TRANSITION' AND new_values->>'state'='APPROVED' LIMIT 1`,[id]);
        if (!approved.rows[0] || ticket.state !== 'PLANNED') {
          throw new ConflictException('El cambio debe tener una aprobación registrada antes de ejecutarse.');
        }
        this.requireEvidence(data,'riskAssessment','Evaluación de impacto y riesgo');
        this.requireEvidence(data,'testPlan','Plan de pruebas');
        this.requireEvidence(data,'rollbackPlan','Plan de reversión');
      }
      if (ticket.process === 'CHANGE' && to === 'VALIDATING') {
        this.requireEvidence(data,'executionResult','Resultado de ejecución');
      }
      if (ticket.process === 'CHANGE' && to === 'RESOLVED') {
        this.requireEvidence(data,'executionResult','Resultado de ejecución');
        this.requireEvidence(data,'validationResult','Resultado de validación');
      }
      if (ticket.process === 'INCIDENT' && ['CLASSIFIED','RESOLVED'].includes(to)) this.validateIncidentFacts(data);
      if (ticket.process === 'INCIDENT' && to === 'RESOLVED') {
        this.requireEvidence(data,'solution','Solución aplicada');
        if (data.interruptsOrDegrades &&
          (!Number.isSafeInteger(Number(data.actualMinutes)) || Number(data.actualMinutes) < 1)) {
          throw new BadRequestException('Registra la duración real de la interrupción o degradación antes de resolver.');
        }
      }
      if (ticket.process === 'EVENT' && to === 'EVALUATED') {
        if (!['E0','E1','E2','E3'].includes(String(data.eventCategory))) throw new BadRequestException('Categoría de evento E0-E3 requerida.');
        if (data.eventCategory !== 'E0') this.requireEvidence(data,'assessment','Evaluación del evento');
      }
      if (ticket.process === 'EVENT' && to === 'RESPONDED') this.requireEvidence(data,'response','Respuesta aplicada');
      if (ticket.process === 'PROBLEM' && to === 'INVESTIGATING') {
        const incidents = await client.query(`SELECT 1 FROM ticket_links l JOIN tickets i
          ON i.id=CASE WHEN l.ticket_id=$1 THEN l.related_ticket_id ELSE l.ticket_id END
          WHERE (l.ticket_id=$1 OR l.related_ticket_id=$1) AND i.process='INCIDENT' LIMIT 1`, [id]);
        if (!incidents.rows[0]) throw new BadRequestException('Vincula al menos un incidente antes de investigar el problema.');
      }
      if (ticket.process === 'PROBLEM' && to === 'WORKAROUND') this.requireEvidence(data,'workaround','Solución temporal');
      if (ticket.process === 'PROBLEM' && to === 'KNOWN_ERROR') this.requireEvidence(data,'knownError','Error conocido');
      if (ticket.process === 'PROBLEM' && to === 'DEFINITIVE_SOLUTION') {
        this.requireEvidence(data,'rootCause','Causa raíz');
        this.requireEvidence(data,'definitiveSolution','Solución definitiva');
      }
      if (ticket.process === 'PROBLEM' && to === 'RESOLVED') this.requireEvidence(data,'definitiveSolution','Solución definitiva');
      if (ticket.process === 'ACCESS' && ['PROVISIONING','VALIDATING','RESOLVED'].includes(to) &&
        !['GRANT','REVOKE'].includes(String(data.accessAction))) {
        throw new BadRequestException('La solicitud debe indicar si concede o revoca el acceso.');
      }
      if (ticket.process === 'ACCESS' && to === 'VALIDATING') this.requireEvidence(data,'provisioningResult','Resultado de provisión o revocación');
      if (ticket.process === 'ACCESS' && to === 'RESOLVED') this.requireEvidence(data,'validation','Resultado de validación');
      if (ticket.process === 'TECH_SERVICE' && to === 'ASSIGNED') {
        this.requireEvidence(data,'validation','Validación de la solicitud');
        if (!ticket.assigned_user_id) throw new BadRequestException('Asigna un agente antes de pasar la solicitud a asignada.');
      }
      if (ticket.process === 'EVENT' && ticket.state === 'EVALUATED') {
        const critical = ['E2','E3'].includes(String(data.eventCategory));
        if (critical && to === 'CLOSED') throw new BadRequestException('E2/E3 requiere respuesta e incidente antes del cierre.');
        if (!critical && to === 'RESPONDED') throw new BadRequestException('E0/E1 solo requieren registro y evaluación.');
      }
      if (ticket.process === 'EVENT' && ticket.state === 'SUBMITTED' && to === 'CLOSED' && data.eventCategory !== 'E0') {
        throw new BadRequestException('Solo E0 puede cerrarse directamente después del registro; E1-E3 requieren evaluación.');
      }
      if (ticket.process === 'EVENT' && ticket.state === 'SUBMITTED' && data.eventCategory === 'E0' && to !== 'CLOSED') {
        throw new BadRequestException('E0 solo requiere registro; ciérralo directamente sin clasificación, evaluación ni respuesta operativa.');
      }
      if (ticket.process === 'TECH_SERVICE' && to === 'FULFILLING' && !ticket.assigned_user_id) {
        throw new BadRequestException('Asigna un agente antes de cumplir la solicitud.');
      }
      if (ticket.process === 'TECH_SERVICE' && to === 'CONFIRMING') this.requireEvidence(data,'delivery','Resultado del cumplimiento');
      if (ticket.process === 'TECH_SERVICE' && to === 'RESOLVED') this.requireEvidence(data,'confirmation','Confirmación del solicitante');
      if (ticket.process === 'NEW_SERVICE' && to === 'APPROVED') {
        await this.approveNewService(client,ticket,user);
      }
      if (ticket.process === 'EVENT' && to === 'EVALUATED') {
        const category = ticket.process_data?.eventCategory;
        if (category === 'E2' || category === 'E3') await this.ensureEventIncident(client,ticket,user);
      }
      const updated = await client.query(`UPDATE tickets SET state=$1::text,updated_at=NOW(),
        resolved_at=CASE WHEN $1::text='RESOLVED' THEN NOW() WHEN $1::text='SUBMITTED' THEN NULL ELSE resolved_at END,
        closed_at=CASE WHEN $1::text='CLOSED' THEN NOW() WHEN $1::text='SUBMITTED' THEN NULL ELSE closed_at END,
        reopen_count=reopen_count+CASE WHEN $1::text='SUBMITTED' AND state='CLOSED' THEN 1 ELSE 0 END
        WHERE id=$2 RETURNING *`, [to,id]);
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values,reason)
        VALUES($1,$2,'TRANSITION',$3::jsonb,$4::jsonb,$5)`,
        [id,user.id,
          JSON.stringify({ state: ticket.state, resolvedAt: ticket.resolved_at, closedAt: ticket.closed_at, reopenCount: ticket.reopen_count }),
          JSON.stringify({ state: updated.rows[0].state, resolvedAt: updated.rows[0].resolved_at,
            closedAt: updated.rows[0].closed_at, reopenCount: updated.rows[0].reopen_count }),reason]);
      return updated.rows[0];
    });
  }

  private async approveNewService(client: PoolClient, ticket: Record<string,any>, actor: AuthenticatedUser) {
    const data = ticket.process_data as Record<string,unknown>;
    let serviceId: number;
    if (data.linkedServiceId) {
      serviceId = idOf(data.linkedServiceId,'Servicio a vincular');
      const linked = await client.query(`SELECT id FROM service_level_2 WHERE id=$1 AND status='ACTIVE'`, [serviceId]);
      if (!linked.rows[0]) throw new BadRequestException('El servicio a vincular no existe o está inactivo.');
    } else {
      const code = requiredText(data.proposedCode,'Código propuesto',50);
      const name = requiredText(data.proposedName,'Nombre propuesto');
      const parent = await client.query(`SELECT level_1_id FROM service_level_2 WHERE id=$1`, [ticket.service_id]);
      const inserted = await client.query(`INSERT INTO service_level_2(code,name,level_1_id,status,description)
        VALUES($1,$2,$3,'REVIEW',$4) ON CONFLICT(code) DO NOTHING RETURNING id`,
        [code,name,parent.rows[0].level_1_id,`Propuesto por ticket ${ticket.number}; pendiente de completar clasificación.`]);
      if (!inserted.rows[0]) throw new ConflictException('El servicio propuesto ya existe: vincúlalo por ID.');
      serviceId = inserted.rows[0].id;
    }
    const changed = { ...data, approvedServiceId: serviceId };
    await client.query('UPDATE tickets SET process_data=$1::jsonb WHERE id=$2', [JSON.stringify(changed),ticket.id]);
    await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values)
      VALUES($1,$2,'SERVICE_APPROVED',$3::jsonb,$4::jsonb)`,
      [ticket.id,actor.id,JSON.stringify(data),JSON.stringify(changed)]);
  }

  private async ensureEventIncident(client: PoolClient, event: Record<string,any>, actor: AuthenticatedUser) {
    const existing = await client.query(`SELECT 1 FROM ticket_links
      WHERE ticket_id=$1 AND link_type='GENERATED_INCIDENT' LIMIT 1`, [event.id]);
    if (existing.rows[0]) return;
    const incidentQueue = await client.query(`SELECT id FROM support_queues
      WHERE process='INCIDENT' AND active ORDER BY id LIMIT 1`);
    if (!incidentQueue.rows[0]) throw new BadRequestException('Configura una cola de incidentes antes de evaluar E2/E3.');
    const created = await client.query(`INSERT INTO tickets
      (title,description,requester_id,creator_id,service_id,queue_id,type,process,state,
       priority,impact,urgency,channel,process_data,no_ci_reason)
      VALUES($1,$2,$3,$4,$5,$6,'INCIDENT','INCIDENT','SUBMITTED',$7,$8,$9,'SYSTEM',$10::jsonb,$11)
      RETURNING id`,
      [`Incidente por evento ${event.number}`,event.description,event.requester_id,actor.id,
        event.service_id,incidentQueue.rows[0].id,event.priority,event.impact,event.urgency,
        JSON.stringify({ sourceEventId: event.id, securityEvent: event.process_data?.eventCategory === 'E3',
          incidentCategory: event.process_data?.eventCategory === 'E3' ? 'I6' : null,
          interruptsOrDegrades: event.process_data?.eventCategory === 'E2' ? true : null,
          estimatedMinutes: null }),
        event.no_ci_reason]);
    const incidentId = created.rows[0].id;
    await client.query(`UPDATE tickets SET number='T-'||LPAD(id::text,7,'0') WHERE id=$1`, [incidentId]);
    await client.query(`INSERT INTO ticket_ci(ticket_id,ci_id)
      SELECT $1,ci_id FROM ticket_ci WHERE ticket_id=$2`, [incidentId,event.id]);
    await client.query(`INSERT INTO ticket_links(ticket_id,related_ticket_id,link_type)
      VALUES($1,$2,'GENERATED_INCIDENT')`, [event.id,incidentId]);
    await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,new_values)
      VALUES($1,$2,'GENERATED_FROM_EVENT',$3::jsonb)`,
      [incidentId,actor.id,JSON.stringify({ eventId: event.id })]);
    await client.query(`INSERT INTO ticket_notifications(ticket_id,user_id,message)
      VALUES($1,$2,$3)`, [event.id,event.requester_id,`El evento ${event.number} generó un incidente para atención.`]);
  }

  async transfer(id: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    const destinationId = idOf(body.queueId,'Cola destino');
    const reason = requiredText(body.reason,'Motivo',1000);
    return this.db.transaction(async (client) => {
      const result = await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [id]);
      const ticket = result.rows[0];
      if (!ticket) throw new NotFoundException('Ticket no encontrado.');
      await this.assertAllowed(ticket.queue_id,user,'can_transfer',client);
      if (['CLOSED','REJECTED'].includes(ticket.state)) throw new ConflictException('No se transfiere un ticket finalizado.');
      const destination = await client.query('SELECT id,process FROM support_queues WHERE id=$1 AND active', [destinationId]);
      if (!destination.rows[0]) throw new BadRequestException('Cola destino inexistente o inactiva.');
      if (destination.rows[0].process !== ticket.process) throw new BadRequestException('La cola destino debe pertenecer al mismo proceso.');
      if (destinationId === ticket.queue_id) throw new BadRequestException('El ticket ya está en esa cola.');
      const updated = await client.query(`UPDATE tickets SET queue_id=$1,assigned_user_id=NULL,updated_at=NOW()
        WHERE id=$2 RETURNING *`, [destinationId,id]);
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values,reason)
        VALUES($1,$2,'TRANSFER',$3::jsonb,$4::jsonb,$5)`,
        [id,user.id,JSON.stringify({ queueId: ticket.queue_id,assignedUserId: ticket.assigned_user_id }),
          JSON.stringify({ queueId: destinationId,assignedUserId: null }),reason]);
      return updated.rows[0];
    });
  }

  async escalate(id: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    const destinationId = idOf(body.queueId,'Cola destino');
    const reason = requiredText(body.reason,'Motivo del escalamiento',1000);
    return this.db.transaction(async (client) => {
      const result = await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [id]);
      const ticket = result.rows[0];
      if (!ticket) throw new NotFoundException('Ticket no encontrado.');
      await this.assertAllowed(ticket.queue_id,user,'can_transfer',client);
      if (ticket.process !== 'INCIDENT' || !['DIAGNOSING','IN_PROGRESS','ESCALATED'].includes(ticket.state)) {
        throw new ConflictException('Solo se escala un incidente en diagnóstico, atención o escalamiento.');
      }
      const queues = await client.query(`SELECT id,process,support_level,active FROM support_queues
        WHERE id=ANY($1::int[])`, [[ticket.queue_id,destinationId]]);
      const source = queues.rows.find((queue) => queue.id === ticket.queue_id);
      const destination = queues.rows.find((queue) => queue.id === destinationId);
      if (!source || !destination?.active || destination.process !== ticket.process) {
        throw new BadRequestException('Selecciona una cola activa del mismo proceso.');
      }
      if (destination.support_level <= source.support_level) {
        throw new BadRequestException('El escalamiento requiere una cola con nivel de soporte superior.');
      }
      const updated = await client.query(`UPDATE tickets SET queue_id=$1,assigned_user_id=NULL,
        state='ESCALATED',updated_at=NOW() WHERE id=$2 RETURNING *`, [destinationId,id]);
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values,reason)
        VALUES($1,$2,'ESCALATE',$3::jsonb,$4::jsonb,$5)`, [id,user.id,
          JSON.stringify({ queueId: ticket.queue_id, supportLevel: source.support_level,
            assignedUserId: ticket.assigned_user_id, state: ticket.state }),
          JSON.stringify({ queueId: destinationId, supportLevel: destination.support_level,
            assignedUserId: null, state: 'ESCALATED' }),reason]);
      return updated.rows[0];
    });
  }

  async comment(id: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    const ticket = await this.db.query('SELECT queue_id,requester_id FROM tickets WHERE id=$1', [id]);
    if (!ticket.rows[0]) throw new NotFoundException('Ticket no encontrado.');
    const visibility = String(body.visibility ?? 'PUBLIC');
    if (!['PUBLIC','INTERNAL'].includes(visibility)) throw new BadRequestException('Visibilidad no válida.');
    if (visibility === 'INTERNAL') await this.assertAllowed(ticket.rows[0].queue_id,user,'can_handle');
    else if (ticket.rows[0].requester_id !== user.id) await this.assertAllowed(ticket.rows[0].queue_id,user,'can_view');
    const text = requiredText(body.body,'Comentario',5000);
    return this.db.transaction(async (client) => {
      const inserted = await client.query(`INSERT INTO ticket_comments(ticket_id,author_id,body,visibility)
        VALUES($1,$2,$3,$4) RETURNING *`, [id,user.id,text,visibility]);
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,new_values)
        VALUES($1,$2,'COMMENT',$3::jsonb)`,
        [id,user.id,JSON.stringify({ commentId: inserted.rows[0].id,visibility })]);
      return inserted.rows[0];
    });
  }

  async linkCi(id: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    const ciId = idOf(body.ciId,'CI');
    return this.db.transaction(async (client) => {
      const current = await client.query('SELECT queue_id,process,state,no_ci_reason FROM tickets WHERE id=$1 FOR UPDATE', [id]);
      if (!current.rows[0]) throw new NotFoundException('Ticket no encontrado.');
      await this.assertAllowed(current.rows[0].queue_id,user,'can_handle',client);
      if (['CLOSED','REJECTED'].includes(current.rows[0].state)) throw new ConflictException('No se asocian CI a un ticket finalizado.');
      if (current.rows[0].process === 'CHANGE' &&
        ['APPROVED','PLANNED','EXECUTING','VALIDATING','RESOLVED'].includes(current.rows[0].state)) {
        throw new ConflictException('El cambio ya fue aprobado; los CI afectados no se pueden cambiar sin una nueva evaluación.');
      }
      const ci = await client.query('SELECT id FROM configuration_items WHERE id=$1', [ciId]);
      if (!ci.rows[0]) throw new BadRequestException('CI inexistente.');
      const inserted = await client.query('INSERT INTO ticket_ci(ticket_id,ci_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING *', [id,ciId]);
      if (inserted.rows[0]) await client.query('UPDATE tickets SET no_ci_reason=NULL,updated_at=NOW() WHERE id=$1', [id]);
      if (inserted.rows[0]) await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values)
        VALUES($1,$2,'LINK_CI',$3::jsonb,$4::jsonb)`, [id,user.id,
          JSON.stringify({ noCiReason: current.rows[0].no_ci_reason }),
          JSON.stringify({ ciId, noCiReason: null })]);
      return { linked: !!inserted.rows[0] };
    });
  }

  async linkTicket(id: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    const relatedId = idOf(body.relatedTicketId,'Ticket relacionado');
    const linkType = String(body.linkType ?? 'RELATED');
    if (!['RELATED','CAUSED_BY','DUPLICATE_OF','IMPLEMENTS'].includes(linkType)) throw new BadRequestException('Tipo de vínculo no válido.');
    if (id === relatedId) throw new BadRequestException('No puedes vincular un ticket consigo mismo.');
    const ticket = await this.db.query('SELECT queue_id,process FROM tickets WHERE id=$1', [id]);
    if (!ticket.rows[0]) throw new NotFoundException('Ticket no encontrado.');
    await this.assertAllowed(ticket.rows[0].queue_id,user,'can_handle');
    return this.db.transaction(async (client) => {
      const related = await client.query('SELECT id,process FROM tickets WHERE id=$1', [relatedId]);
      if (!related.rows[0]) throw new BadRequestException('Ticket relacionado inexistente.');
      if (linkType === 'IMPLEMENTS' && !(
        (ticket.rows[0].process === 'PROBLEM' && related.rows[0].process === 'CHANGE') ||
        (ticket.rows[0].process === 'CHANGE' && related.rows[0].process === 'PROBLEM')
      )) throw new BadRequestException('El vínculo “Implementa” solo relaciona un problema con un cambio.');
      const inserted = await client.query(`INSERT INTO ticket_links(ticket_id,related_ticket_id,link_type)
        VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *`, [id,relatedId,linkType]);
      if (inserted.rows[0]) await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,new_values)
        VALUES($1,$2,'LINK_TICKET',$3::jsonb)`,
        [id,user.id,JSON.stringify({ relatedTicketId: relatedId,linkType })]);
      return { linked: !!inserted.rows[0] };
    });
  }

  async notifications(user: AuthenticatedUser) {
    const result = await this.db.query(`SELECT id,ticket_id AS "ticketId",message,read_at AS "readAt",
      created_at AS "createdAt" FROM ticket_notifications WHERE user_id=$1
      ORDER BY created_at DESC LIMIT 100`, [user.id]);
    return result.rows;
  }

  async metrics(user: AuthenticatedUser, ticketId?: string) {
    const all = this.isAdmin(user) || user.roles.includes('CONSULTA');
    const selectedId = ticketId ? idOf(ticketId,'Ticket') : null;
    const result = await this.db.query(`SELECT t.id,t.process,t.state,t.priority,t.queue_id,
      t.created_at,t.first_attended_at,t.resolved_at,t.closed_at,t.paused_at,t.paused_seconds,
      q.name AS queue_name,q.first_response_minutes,q.resolution_minutes
      FROM tickets t JOIN support_queues q ON q.id=t.queue_id
      WHERE ($4::bigint IS NULL OR t.id=$4) AND ($3::boolean OR t.requester_id=$1 OR EXISTS(
        SELECT 1 FROM queue_grants g WHERE g.queue_id=t.queue_id AND g.can_view AND g.expires_on >= (NOW() AT TIME ZONE 'America/Guatemala')::date
        AND (g.user_id=$1 OR g.role=ANY($2::text[]))))`, [user.id,user.roles,all,selectedId]);
    const now = Date.now();
    const byQueue: Record<string,number> = {};
    const byProcess: Record<string,number> = {};
    const byPriority: Record<string,number> = {};
    const byState: Record<string,number> = {};
    let open = 0;
    let totalOpenAgeMinutes = 0;
    let firstResponseSum = 0;
    let firstResponseCount = 0;
    let resolutionSum = 0;
    let resolutionCount = 0;
    let firstResponseMet = 0;
    let firstResponseEvaluated = 0;
    let resolutionMet = 0;
    let resolutionEvaluated = 0;
    for (const row of result.rows) {
      byQueue[row.queue_name] = (byQueue[row.queue_name] ?? 0) + 1;
      byProcess[row.process] = (byProcess[row.process] ?? 0) + 1;
      byPriority[String(row.priority)] = (byPriority[String(row.priority)] ?? 0) + 1;
      byState[row.state] = (byState[row.state] ?? 0) + 1;
      const start = new Date(row.created_at).getTime();
      const paused = Number(row.paused_seconds) / 60 + (row.paused_at ? Math.max(0, now - new Date(row.paused_at).getTime()) / 60000 : 0);
      if (!['CLOSED','REJECTED'].includes(row.state)) {
        open++;
        totalOpenAgeMinutes += Math.max(0,(now - start) / 60000);
      }
      if (row.first_attended_at) {
        const minutes = Math.max(0,(new Date(row.first_attended_at).getTime() - start) / 60000);
        firstResponseSum += minutes; firstResponseCount++;
        if (row.first_response_minutes) { firstResponseEvaluated++; if (minutes <= row.first_response_minutes) firstResponseMet++; }
      }
      if (row.resolved_at) {
        const minutes = Math.max(0,(new Date(row.resolved_at).getTime() - start) / 60000 - paused);
        resolutionSum += minutes; resolutionCount++;
        if (row.resolution_minutes) { resolutionEvaluated++; if (minutes <= row.resolution_minutes) resolutionMet++; }
      }
    }
    const average = (sum: number,count: number) => count ? Math.round(sum / count * 10) / 10 : null;
    return {
      total: result.rows.length,open,byQueue,byProcess,byPriority,byState,
      averageOpenAgeMinutes: average(totalOpenAgeMinutes,open),
      averageFirstResponseMinutes: average(firstResponseSum,firstResponseCount),
      averageResolutionMinutes: average(resolutionSum,resolutionCount),
      firstResponseObjective: { met: firstResponseMet,evaluated: firstResponseEvaluated },
      resolutionObjective: { met: resolutionMet,evaluated: resolutionEvaluated },
      basis: 'Minutos calendario. Antigüedad abierta incluye pausas; primera atención usa el primer hito y no descuenta pausas; resolución vigente se mide desde la creación y resta las pausas acumuladas. Los objetivos solo cuentan tickets con el hito alcanzado y un objetivo configurado. Al reabrir se conserva la primera atención y se reinicia el hito de resolución.',
    };
  }

  async pause(id: number, body: Record<string,unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    const reason = requiredText(body.reason,'Motivo de pausa',1000);
    return this.db.transaction(async (client) => {
      const current = await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [id]);
      const ticket = current.rows[0];
      if (!ticket) throw new NotFoundException('Ticket no encontrado.');
      await this.assertAllowed(ticket.queue_id,user,'can_handle',client);
      if (ticket.paused_at || ['CLOSED','REJECTED','RESOLVED'].includes(ticket.state)) throw new ConflictException('El ticket no puede pausarse en este estado.');
      const updated = await client.query('UPDATE tickets SET paused_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING *', [id]);
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values,reason)
        VALUES($1,$2,'PAUSE',$3::jsonb,$4::jsonb,$5)`, [id,user.id,
          JSON.stringify({ pausedAt: ticket.paused_at, pausedSeconds: ticket.paused_seconds }),
          JSON.stringify({ pausedAt: updated.rows[0].paused_at, pausedSeconds: updated.rows[0].paused_seconds }),reason]);
      return updated.rows[0];
    });
  }

  async resume(id: number, body: Record<string,unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    const reason = requiredText(body.reason,'Motivo de reanudación',1000);
    return this.db.transaction(async (client) => {
      const current = await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [id]);
      const ticket = current.rows[0];
      if (!ticket) throw new NotFoundException('Ticket no encontrado.');
      await this.assertAllowed(ticket.queue_id,user,'can_handle',client);
      if (!ticket.paused_at) throw new ConflictException('El ticket no está pausado.');
      const updated = await client.query(`UPDATE tickets SET paused_seconds=paused_seconds+
        GREATEST(0,EXTRACT(EPOCH FROM (NOW()-paused_at))::bigint),paused_at=NULL,updated_at=NOW()
        WHERE id=$1 RETURNING *`, [id]);
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values,reason)
        VALUES($1,$2,'RESUME',$3::jsonb,$4::jsonb,$5)`, [id,user.id,
          JSON.stringify({ pausedAt: ticket.paused_at, pausedSeconds: ticket.paused_seconds }),
          JSON.stringify({ pausedAt: updated.rows[0].paused_at, pausedSeconds: updated.rows[0].paused_seconds }),reason]);
      return updated.rows[0];
    });
  }

  async knowledge() {
    const result = await this.db.query(`SELECT k.id,k.title,k.body,k.service_id AS "serviceId",
      s.code AS "serviceCode",k.updated_at AS "updatedAt"
      FROM knowledge_articles k LEFT JOIN service_level_2 s ON s.id=k.service_id
      WHERE k.active ORDER BY k.updated_at DESC,k.id DESC`);
    return result.rows;
  }

  async createArticle(body: Record<string,unknown>, user: AuthenticatedUser) {
    this.assertAdmin(user);
    const title = requiredText(body.title,'Título');
    const content = requiredText(body.body,'Contenido',20000);
    const serviceId = body.serviceId == null ? null : idOf(body.serviceId,'Servicio');
    const result = await this.db.query(`INSERT INTO knowledge_articles(title,body,service_id,created_by)
      VALUES($1,$2,$3,$4) RETURNING *`, [title,content,serviceId,user.id]);
    return result.rows[0];
  }

  async updateArticle(id: number, body: Record<string,unknown>, user: AuthenticatedUser) {
    this.assertAdmin(user);
    const current = await this.db.query('SELECT * FROM knowledge_articles WHERE id=$1', [id]);
    if (!current.rows[0]) throw new NotFoundException('Artículo no encontrado.');
    const old = current.rows[0];
    const result = await this.db.query(`UPDATE knowledge_articles SET title=$1,body=$2,
      service_id=$3,active=$4,updated_at=NOW() WHERE id=$5 RETURNING *`,
      [body.title === undefined ? old.title : requiredText(body.title,'Título'),
        body.body === undefined ? old.body : requiredText(body.body,'Contenido',20000),
        body.serviceId === undefined ? old.service_id : body.serviceId === null ? null : idOf(body.serviceId,'Servicio'),
        body.active === undefined ? old.active : body.active === true,id]);
    return result.rows[0];
  }

  private async assertTicketVisible(id: number, user: AuthenticatedUser) {
    const result = await this.db.query('SELECT id,queue_id,requester_id FROM tickets WHERE id=$1', [id]);
    const ticket = result.rows[0];
    if (!ticket) throw new NotFoundException('Ticket no encontrado.');
    if (this.isAdmin(user) || user.roles.includes('CONSULTA') || ticket.requester_id === user.id ||
      await this.allowed(ticket.queue_id,user,'can_view')) return ticket;
    throw new ForbiddenException('No puedes consultar este ticket.');
  }

  async uploadAttachment(id: number,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    user: AuthenticatedUser) {
    this.assertWriter(user);
    const ticket = await this.assertTicketVisible(id,user);
    if (ticket.requester_id !== user.id) await this.assertAllowed(ticket.queue_id,user,'can_handle');
    if (!file || !file.buffer || file.size < 1 || file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Adjunta un archivo de 1 byte a 5 MB.');
    }
    const allowedMime = ['application/pdf','image/png','image/jpeg','text/plain'];
    if (!allowedMime.includes(file.mimetype)) throw new BadRequestException('Solo se admiten PDF, PNG, JPEG o texto plano.');
    const bytes = file.buffer;
    const signatureOk = file.mimetype === 'application/pdf' ? bytes.subarray(0,5).toString() === '%PDF-' :
      file.mimetype === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
      file.mimetype === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff :
      !bytes.includes(0);
    if (!signatureOk) throw new BadRequestException('El contenido no corresponde al tipo de archivo declarado.');
    const originalName = requiredText(file.originalname,'Nombre de archivo',255).replace(/[\\/]/g,'_');
    const storedName = randomUUID();
    const directory = process.env.UPLOAD_DIR ?? '/app/uploads';
    await mkdir(directory,{ recursive: true });
    const path = join(directory,storedName);
    await writeFile(path,bytes,{ flag: 'wx' });
    try {
      return await this.db.transaction(async (client) => {
        const inserted = await client.query(`INSERT INTO ticket_attachments
          (ticket_id,uploader_id,original_name,stored_name,mime_type,size_bytes)
          VALUES($1,$2,$3,$4,$5,$6) RETURNING id,original_name AS "originalName",
          mime_type AS "mimeType",size_bytes AS "sizeBytes",created_at AS "createdAt"`,
          [id,user.id,originalName,storedName,file.mimetype,file.size]);
        await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,new_values)
          VALUES($1,$2,'ATTACHMENT',$3::jsonb)`,
          [id,user.id,JSON.stringify({ attachmentId: inserted.rows[0].id,originalName })]);
        return inserted.rows[0];
      });
    } catch (error) {
      await unlink(path).catch(() => undefined);
      throw error;
    }
  }

  async attachment(id: number, attachmentId: number, user: AuthenticatedUser) {
    await this.assertTicketVisible(id,user);
    const result = await this.db.query(`SELECT original_name AS "originalName",stored_name AS "storedName"
      FROM ticket_attachments WHERE id=$1 AND ticket_id=$2`, [attachmentId,id]);
    if (!result.rows[0]) throw new NotFoundException('Adjunto no encontrado.');
    return { originalName: result.rows[0].originalName,
      path: join(process.env.UPLOAD_DIR ?? '/app/uploads',result.rows[0].storedName) };
  }
}
