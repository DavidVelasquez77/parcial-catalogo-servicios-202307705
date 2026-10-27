import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { canTransition, DeskProcess, processes, processType } from './process-rules';

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
      AND (g.user_id=$2 OR g.role=ANY($3::text[])) LIMIT 1`;
    const values = [queueId,user.id,user.roles];
    const grants = client ? await client.query(statement,values) : await this.db.query(statement,values);
    return !!grants.rows[0];
  }
  private async assertAllowed(queueId: number, user: AuthenticatedUser, permission: Permission, client?: PoolClient) {
    if (!(await this.allowed(queueId,user,permission,client))) throw new ForbiddenException('No tienes permiso para esta acción en la cola.');
  }

  async activeUsers() {
    const result = await this.db.query('SELECT id,name FROM users WHERE active ORDER BY name');
    return result.rows;
  }

  async queues(user: AuthenticatedUser) {
    const result = await this.db.query(`SELECT q.*,
      EXISTS(SELECT 1 FROM queue_grants g WHERE g.queue_id=q.id AND g.can_handle
        AND (g.user_id=$1 OR g.role=ANY($2::text[]))) AS "canHandle"
      FROM support_queues q ORDER BY q.process,q.name`, [user.id,user.roles]);
    return result.rows;
  }

  async createQueue(body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertAdmin(user);
    const process = String(body.process ?? '');
    if (!processes.includes(process as DeskProcess)) throw new BadRequestException('Proceso no válido.');
    const code = requiredText(body.code,'Código',50);
    const name = requiredText(body.name,'Nombre',160);
    const supportLevel = body.supportLevel === undefined ? 1 : Number(body.supportLevel);
    if (!Number.isInteger(supportLevel) || supportLevel < 0 || supportLevel > 4) throw new BadRequestException('Nivel de soporte no válido.');
    const duplicate = await this.db.query('SELECT id FROM support_queues WHERE code=$1', [code]);
    if (duplicate.rows[0]) throw new ConflictException('El código de cola ya existe.');
    const result = await this.db.query(`INSERT INTO support_queues
      (code,name,description,process,support_level,first_response_minutes,resolution_minutes)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [code,name,body.description ?? null,process,supportLevel,
        body.firstResponseMinutes ?? null,body.resolutionMinutes ?? null]);
    return result.rows[0];
  }

  async updateQueue(id: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertAdmin(user);
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
      const updated = await client.query(`UPDATE support_queues SET name=$1,description=$2,process=$3,
        support_level=$4,first_response_minutes=$5,resolution_minutes=$6,active=$7,updated_at=NOW()
        WHERE id=$8 RETURNING *`,
        [body.name === undefined ? old.name : requiredText(body.name,'Nombre',160),
          body.description ?? old.description,process,levelValue,
          body.firstResponseMinutes ?? old.first_response_minutes,
          body.resolutionMinutes ?? old.resolution_minutes,active,id]);
      return updated.rows[0];
    });
  }

  async grant(queueId: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertAdmin(user);
    const queue = await this.db.query('SELECT id FROM support_queues WHERE id=$1', [queueId]);
    if (!queue.rows[0]) throw new NotFoundException('Cola no encontrada.');
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
    return this.db.transaction(async (client) => {
      await client.query('DELETE FROM queue_grants WHERE queue_id=$1 AND user_id IS NOT DISTINCT FROM $2 AND role IS NOT DISTINCT FROM $3', [queueId,userId,role]);
      const result = await client.query(`INSERT INTO queue_grants
        (queue_id,user_id,role,can_view,can_handle,can_transfer,can_approve,can_admin)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [queueId,userId,role,...flags.map((key) => body[key] === true)]);
      return result.rows[0];
    });
  }

  async tickets(query: Record<string, string | undefined>, user: AuthenticatedUser) {
    const page = Math.max(1,Math.min(100000,Number(query.page) || 1));
    const pageSize = Math.max(1,Math.min(100,Number(query.pageSize) || 20));
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
        SELECT 1 FROM queue_grants g WHERE g.queue_id=t.queue_id AND g.can_view
        AND (g.user_id=$1 OR g.role=ANY($2::text[]))))`;
    params.push(query.serviceId ? idOf(query.serviceId,'Servicio') : null,
      query.assigneeId ? idOf(query.assigneeId,'Responsable') : null,
      query.from ?? null,query.to ?? null,
      this.isAdmin(user) || user.roles.includes('CONSULTA'));
    const [count,rows] = await Promise.all([
      this.db.query(`SELECT COUNT(*)::int AS total FROM tickets t ${where}`,params),
      this.db.query(`SELECT t.id,t.number,t.title,t.type,t.process,t.state,t.priority,
        t.queue_id AS "queueId",q.name AS "queueName",t.service_id AS "serviceId",
        t.requester_id AS "requesterId",t.assigned_user_id AS "assignedUserId",
        t.created_at AS "createdAt",t.updated_at AS "updatedAt"
        FROM tickets t JOIN support_queues q ON q.id=t.queue_id ${where}
        ORDER BY t.priority DESC,t.created_at ASC,t.id ASC LIMIT $13 OFFSET $14`,
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
      if (process === 'EVENT' && !['E0','E1','E2','E3'].includes(String(data.eventCategory))) throw new BadRequestException('El evento requiere categoría E0-E3.');
      if (process === 'INCIDENT' && !['I0','I1','I2','I3','I4','I5','I6'].includes(String(data.incidentCategory))) throw new BadRequestException('El incidente requiere categoría I0-I6.');
      if (process === 'ACCESS' && (!body.beneficiaryId || !data.resource || !data.permission)) throw new BadRequestException('El acceso requiere beneficiario, recurso y permiso.');
      if (process === 'CHANGE' && !ciIds.length) throw new BadRequestException('Un cambio debe identificar al menos un CI afectado.');
      if (body.beneficiaryId) {
        const beneficiaryId = idOf(body.beneficiaryId,'Beneficiario');
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
        [title,description,requesterId,user.id,body.beneficiaryId ?? null,serviceId,queueId,
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
      s.name AS service_name,l1.code AS level_1_code,l1.name AS level_1_name
      FROM tickets t JOIN support_queues q ON q.id=t.queue_id
      JOIN service_level_2 s ON s.id=t.service_id JOIN service_level_1 l1 ON l1.id=s.level_1_id
      WHERE t.id=$1`, [id]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Ticket no encontrado.');
    const staff = this.isAdmin(user) || await this.allowed(row.queue_id,user,'can_view');
    if (!staff && !user.roles.includes('CONSULTA') && row.requester_id !== user.id) throw new ForbiddenException('No puedes consultar este ticket.');
    const [history,comments,ci,links,attachments] = await Promise.all([
      this.db.query('SELECT * FROM ticket_history WHERE ticket_id=$1 ORDER BY created_at,id', [id]),
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
      const ticket = await client.query('SELECT id,queue_id,state,assigned_user_id FROM tickets WHERE id=$1 FOR UPDATE', [id]);
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
        [id,user.id,JSON.stringify({ assignedUserId: null }),JSON.stringify({ assignedUserId: user.id })]);
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
      const merged = { ...ticket.process_data, ...body };
      if (ticket.process === 'EVENT' && !['E0','E1','E2','E3'].includes(String(merged.eventCategory))) {
        throw new BadRequestException('Categoría de evento E0-E3 requerida.');
      }
      if (ticket.process === 'INCIDENT' && !['I0','I1','I2','I3','I4','I5','I6'].includes(String(merged.incidentCategory))) {
        throw new BadRequestException('Categoría de incidente I0-I6 requerida.');
      }
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
      if (ticket.process === 'NEW_SERVICE' && to === 'PENDING_APPROVAL' &&
        (!data.need || !data.feasibility || (!data.linkedServiceId && (!data.proposedCode || !data.proposedName)))) {
        throw new BadRequestException('Documenta necesidad, viabilidad y servicio propuesto o existente antes de aprobar.');
      }
      if (ticket.process === 'CHANGE' && to === 'PENDING_APPROVAL' &&
        (!data.riskAssessment || !data.testPlan || !data.rollbackPlan)) {
        throw new BadRequestException('Documenta impacto y riesgo, plan de pruebas y reversión.');
      }
      if (ticket.process === 'CHANGE' && to === 'EXECUTING') {
        if (!data.testPlan || !data.rollbackPlan || !data.riskAssessment || ticket.state !== 'PLANNED') {
          throw new BadRequestException('El cambio requiere aprobación, riesgo, plan de pruebas y reversión.');
        }
      }
      if (ticket.process === 'PROBLEM' && to === 'INVESTIGATING') {
        const incidents = await client.query(`SELECT 1 FROM ticket_links l JOIN tickets i
          ON i.id=CASE WHEN l.ticket_id=$1 THEN l.related_ticket_id ELSE l.ticket_id END
          WHERE (l.ticket_id=$1 OR l.related_ticket_id=$1) AND i.process='INCIDENT' LIMIT 1`, [id]);
        if (!incidents.rows[0]) throw new BadRequestException('Vincula al menos un incidente antes de investigar el problema.');
      }
      if (ticket.process === 'PROBLEM' && to === 'DEFINITIVE_SOLUTION' && !data.rootCause) {
        throw new BadRequestException('Documenta la causa raíz antes de la solución definitiva.');
      }
      if (ticket.process === 'EVENT' && ticket.state === 'EVALUATED') {
        const critical = ['E2','E3'].includes(String(data.eventCategory));
        if (critical && to === 'CLOSED') throw new BadRequestException('E2/E3 requiere respuesta e incidente antes del cierre.');
        if (!critical && to === 'RESPONDED') throw new BadRequestException('E0/E1 solo requieren registro y evaluación.');
      }
      if (ticket.process === 'TECH_SERVICE' && to === 'FULFILLING' && !ticket.assigned_user_id) {
        throw new BadRequestException('Asigna un agente antes de cumplir la solicitud.');
      }
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
        [id,user.id,JSON.stringify({ state: ticket.state }),JSON.stringify({ state: to }),reason]);
      return updated.rows[0];
    });
  }

  private async approveNewService(client: PoolClient, ticket: Record<string,any>, actor: AuthenticatedUser) {
    const data = ticket.process_data as Record<string,unknown>;
    let serviceId: number;
    if (data.linkedServiceId) {
      serviceId = idOf(data.linkedServiceId,'Servicio a vincular');
      const linked = await client.query('SELECT id FROM service_level_2 WHERE id=$1', [serviceId]);
      if (!linked.rows[0]) throw new BadRequestException('El servicio a vincular no existe.');
    } else {
      const code = requiredText(data.proposedCode,'Código propuesto',50);
      const name = requiredText(data.proposedName,'Nombre propuesto');
      const duplicate = await client.query('SELECT id FROM service_level_2 WHERE code=$1', [code]);
      if (duplicate.rows[0]) throw new ConflictException('El servicio propuesto ya existe: vincúlalo por ID.');
      const parent = await client.query(`SELECT level_1_id FROM service_level_2 WHERE id=$1`, [ticket.service_id]);
      const inserted = await client.query(`INSERT INTO service_level_2(code,name,level_1_id,status,description)
        VALUES($1,$2,$3,'REVIEW',$4) RETURNING id`,
        [code,name,parent.rows[0].level_1_id,`Propuesto por ticket ${ticket.number}; pendiente de completar clasificación.`]);
      serviceId = inserted.rows[0].id;
    }
    const changed = { ...data, approvedServiceId: serviceId };
    await client.query('UPDATE tickets SET process_data=$1::jsonb WHERE id=$2', [JSON.stringify(changed),ticket.id]);
    await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,new_values)
      VALUES($1,$2,'SERVICE_APPROVED',$3::jsonb)`,
      [ticket.id,actor.id,JSON.stringify({ approvedServiceId: serviceId })]);
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
        JSON.stringify({ sourceEventId: event.id, securityEvent: event.process_data?.eventCategory === 'E3' }),
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
    const ticket = await this.db.query('SELECT queue_id FROM tickets WHERE id=$1', [id]);
    if (!ticket.rows[0]) throw new NotFoundException('Ticket no encontrado.');
    await this.assertAllowed(ticket.rows[0].queue_id,user,'can_handle');
    return this.db.transaction(async (client) => {
      const ci = await client.query('SELECT id FROM configuration_items WHERE id=$1', [ciId]);
      if (!ci.rows[0]) throw new BadRequestException('CI inexistente.');
      const inserted = await client.query('INSERT INTO ticket_ci(ticket_id,ci_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING *', [id,ciId]);
      if (inserted.rows[0]) await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,new_values)
        VALUES($1,$2,'LINK_CI',$3::jsonb)`, [id,user.id,JSON.stringify({ ciId })]);
      return { linked: !!inserted.rows[0] };
    });
  }

  async linkTicket(id: number, body: Record<string, unknown>, user: AuthenticatedUser) {
    this.assertWriter(user);
    const relatedId = idOf(body.relatedTicketId,'Ticket relacionado');
    const linkType = String(body.linkType ?? 'RELATED');
    if (!['RELATED','CAUSED_BY','DUPLICATE_OF','IMPLEMENTS'].includes(linkType)) throw new BadRequestException('Tipo de vínculo no válido.');
    if (id === relatedId) throw new BadRequestException('No puedes vincular un ticket consigo mismo.');
    const ticket = await this.db.query('SELECT queue_id FROM tickets WHERE id=$1', [id]);
    if (!ticket.rows[0]) throw new NotFoundException('Ticket no encontrado.');
    await this.assertAllowed(ticket.rows[0].queue_id,user,'can_handle');
    return this.db.transaction(async (client) => {
      const related = await client.query('SELECT id FROM tickets WHERE id=$1', [relatedId]);
      if (!related.rows[0]) throw new BadRequestException('Ticket relacionado inexistente.');
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
        SELECT 1 FROM queue_grants g WHERE g.queue_id=t.queue_id AND g.can_view
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
      basis: 'Minutos calendario; los objetivos se evalúan al atender o resolver. El tiempo pausado se descuenta de la resolución; tickets abiertos sin atención o resolución quedan fuera de esos promedios.',
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
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,reason) VALUES($1,$2,'PAUSE',$3)`, [id,user.id,reason]);
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
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,reason) VALUES($1,$2,'RESUME',$3)`, [id,user.id,reason]);
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
