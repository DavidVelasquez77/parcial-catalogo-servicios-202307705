import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { Pool, PoolClient } from 'pg';
import { DeskProcess, processType } from '../desk/process-rules';

const queueDefinitions: Array<[string,string,DeskProcess]> = [
  ['Q-NEW','Nuevos servicios','NEW_SERVICE'],
  ['Q-CHANGE','Cambios','CHANGE'],
  ['Q-INCIDENT','Incidentes','INCIDENT'],
  ['Q-EVENT','Eventos','EVENT'],
  ['Q-PROBLEM','Problemas','PROBLEM'],
  ['Q-ACCESS','Accesos','ACCESS'],
  ['Q-TECH','Servicios de tecnología','TECH_SERVICE'],
];
const knowledgeEntries: Array<[string,string]> = [
  ['FAQ-L0-01 · Registrar una solicitud','Abre Tickets, selecciona Nuevo ticket, elige la cola del proceso y un servicio activo. Describe el resultado que necesitas. Si no corresponde asociar un CI, explica el motivo; conserva el número del ticket para darle seguimiento.'],
  ['FAQ-L0-02 · Incidente o solicitud de servicio','Registra un incidente cuando algo existente se interrumpió o degradó. Usa Servicios de tecnología para pedir una prestación de un servicio existente. Usa Nuevos servicios cuando necesites proponer un servicio que aún no está en el catálogo.'],
  ['FAQ-L0-03 · Elegir categoría de evento','E0 es programado y solo requiere registro. E1 es no programado sin impacto y conserva evaluación. E2 impacta el servicio y E3 afecta seguridad; ambos generan un incidente relacionado que debe recibir respuesta.'],
  ['FAQ-L0-04 · Dar seguimiento a un ticket','En Tickets busca por número o título. El detalle muestra estado, cola, responsable, historial y comentarios. Los comentarios públicos son visibles al solicitante; las notas internas quedan para el equipo autorizado.'],
  ['FAQ-L0-05 · Aportar información útil','Incluye cuándo empezó el problema, servicio afectado, síntomas observados y pasos para reproducirlo. Relaciona un CI solo cuando lo conoces; no inventes equipos. Evita incluir contraseñas o secretos en la descripción o en adjuntos.'],
];
const demoUsers = [
  { username: 'solicitante.demo', name: 'Solicitante de evaluación', role: 'SOLICITANTE', env: 'DEMO_REQUESTER_PASSWORD', fallback: 'Solicita123!' },
  { username: 'agente1.demo', name: 'Agente de evaluación 1', role: 'AGENTE', env: 'DEMO_AGENT1_PASSWORD', fallback: 'Agente123!' },
  { username: 'agente2.demo', name: 'Agente de evaluación 2', role: 'AGENTE', env: 'DEMO_AGENT2_PASSWORD', fallback: 'Agente123!' },
  { username: 'aprobador.demo', name: 'Aprobador de evaluación', role: 'APROBADOR', env: 'DEMO_APPROVER_PASSWORD', fallback: 'Aprueba123!' },
] as const;
const fixtureStates: Record<DeskProcess,string[]> = {
  NEW_SERVICE: ['SUBMITTED','ANALYSIS','PENDING_APPROVAL','REJECTED','APPROVED'],
  CHANGE: ['SUBMITTED','RISK_ASSESSMENT','PENDING_APPROVAL','REJECTED','PLANNED'],
  INCIDENT: ['SUBMITTED','CLASSIFIED','DIAGNOSING','IN_PROGRESS','ESCALATED','RESOLVED','CLOSED'],
  EVENT: ['SUBMITTED','CLASSIFIED','SUBMITTED','SUBMITTED','EVALUATED'],
  PROBLEM: ['SUBMITTED','INVESTIGATING','WORKAROUND','KNOWN_ERROR','DEFINITIVE_SOLUTION'],
  ACCESS: ['SUBMITTED','PENDING_APPROVAL','REJECTED','APPROVED','PROVISIONING'],
  TECH_SERVICE: ['SUBMITTED','VALIDATING','ASSIGNED','FULFILLING','CONFIRMING'],
};
const shortCodes: Record<DeskProcess,string> = {
  NEW_SERVICE: 'NEW',CHANGE: 'CHG',INCIDENT: 'INC',EVENT: 'EVT',
  PROBLEM: 'PRB',ACCESS: 'ACC',TECH_SERVICE: 'TEC',
};

async function createUsers(client: PoolClient, positionId: number) {
  const users = new Map<string,number>();
  for (const account of demoUsers) {
    const password = String(process.env[account.env] ?? account.fallback);
    if (password.length < 8) throw new Error(`${account.env} debe tener ocho caracteres o más.`);
    const hash = await bcrypt.hash(password,12);
    const result = await client.query<{ id: number }>(`INSERT INTO users(name,username,password_hash,role,position_id,active)
      VALUES($1,$2,$3,$4,$5,TRUE)
      ON CONFLICT(username) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,
        role=EXCLUDED.role,position_id=EXCLUDED.position_id,active=TRUE,updated_at=NOW()
      RETURNING id`, [account.name,account.username,hash,account.role,positionId]);
    users.set(account.username,result.rows[0].id);
    await client.query('DELETE FROM user_roles WHERE user_id=$1', [result.rows[0].id]);
    await client.query('INSERT INTO user_roles(user_id,role) VALUES($1,$2)', [result.rows[0].id,account.role]);
  }
  return users;
}

async function seedQueues(client: PoolClient, responsibleUserId: number) {
  const queues = new Map<DeskProcess,number>();
  for (const [code,name,process] of queueDefinitions) {
    const result = await client.query<{ id: number }>(`INSERT INTO support_queues
      (code,name,process,responsible_user_id,support_level,first_response_minutes,resolution_minutes)
      VALUES($1,$2,$3,$4,1,60,480)
      ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,process=EXCLUDED.process,
        active=TRUE,updated_at=NOW() RETURNING id`, [code,name,process,responsibleUserId]);
    const queueId = result.rows[0].id;
    queues.set(process,queueId);
    await client.query(`INSERT INTO queue_grants(queue_id,role,can_view,can_handle,can_transfer)
      VALUES($1,'AGENTE',TRUE,TRUE,TRUE) ON CONFLICT DO NOTHING`, [queueId]);
    await client.query(`INSERT INTO queue_grants(queue_id,role,can_view,can_approve)
      VALUES($1,'APROBADOR',TRUE,TRUE) ON CONFLICT DO NOTHING`, [queueId]);
    await client.query(`INSERT INTO queue_grants(queue_id,user_id,can_view,can_handle)
      VALUES($1,$2,TRUE,TRUE)
      ON CONFLICT (queue_id,user_id) WHERE role IS NULL
      DO UPDATE SET can_view=TRUE,can_handle=TRUE`, [queueId,responsibleUserId]);
  }
  const escalationQueue = await client.query<{ id: number }>(`INSERT INTO support_queues
    (code,name,process,responsible_user_id,support_level,first_response_minutes,resolution_minutes)
    VALUES('Q-INCIDENT-L2','Soporte técnico de incidentes','INCIDENT',$1,2,60,480)
    ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,process=EXCLUDED.process,
      support_level=2,active=TRUE,updated_at=NOW() RETURNING id`, [responsibleUserId]);
  const incidentEscalationQueueId = escalationQueue.rows[0].id;
  await client.query(`INSERT INTO queue_grants(queue_id,role,can_view,can_handle,can_transfer)
    VALUES($1,'AGENTE',TRUE,TRUE,TRUE) ON CONFLICT DO NOTHING`, [incidentEscalationQueueId]);
  await client.query(`INSERT INTO queue_grants(queue_id,user_id,can_view,can_handle)
    VALUES($1,$2,TRUE,TRUE)
    ON CONFLICT (queue_id,user_id) WHERE role IS NULL
    DO UPDATE SET can_view=TRUE,can_handle=TRUE`, [incidentEscalationQueueId,responsibleUserId]);
  return { queues, incidentEscalationQueueId };
}

async function seedKnowledge(client: PoolClient, createdBy: number) {
  for (const [title,body] of knowledgeEntries) {
    await client.query(`INSERT INTO knowledge_articles(title,body,created_by)
      SELECT $1::varchar,$2::text,$3::bigint WHERE NOT EXISTS (
        SELECT 1 FROM knowledge_articles WHERE title=$1::varchar
      )`, [title,body,createdBy]);
  }
}

async function normalizeSeededE0(client: PoolClient) {
  const fixture = await client.query<{ id: number; process_data: Record<string,unknown> }>(`SELECT id,process_data
    FROM tickets WHERE number='DEMO-EVT-01' AND process='EVENT' AND process_data->>'eventCategory'='E0'
      AND process_data->>'assessment'='Caso sintético de evaluación'
      AND process_data->>'response' IS NULL FOR UPDATE`);
  if (!fixture.rows[0]) return 0;
  const previous = fixture.rows[0].process_data;
  const revised = { ...previous };
  delete revised.assessment;
  delete revised.response;
  await client.query('UPDATE tickets SET process_data=$1::jsonb,updated_at=NOW() WHERE id=$2',
    [JSON.stringify(revised),fixture.rows[0].id]);
  await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values,reason)
    VALUES($1,NULL,'DEMO_SEED_REPAIR',$2::jsonb,$3::jsonb,$4)`,
    [fixture.rows[0].id,JSON.stringify(previous),JSON.stringify(revised),
      'Se elimina evidencia operativa sintética del E0 de muestra; este evento solo requiere registro.']);
  return 1;
}

function dataFor(process: DeskProcess, index: number) {
  if (process === 'EVENT') {
    const eventCategory = ['E0','E1','E2','E3','E1'][index - 1];
    return { eventCategory,assessment:eventCategory === 'E0' ? null : 'Caso sintético de evaluación',
      response:index > 2 ? 'Alerta atendida en la cola de evaluación.' : null };
  }
  if (process === 'INCIDENT') return {
    incidentCategory: `I${index - 1}`, estimatedMinutes: [null,120,360,1500,5000,45000,null][index - 1],
    interruptsOrDegrades: index > 1 && index < 7, redundancyAvailable: index === 1,
    actualMinutes:index === 6 ? 43200 : null,
    solution: index > 5 ? 'Recuperación sintética documentada' : null,
  };
  if (process === 'CHANGE') return { riskAssessment: 'Riesgo controlado de demostración', testPlan: 'Prueba de verificación',
    rollbackPlan: 'Restaurar configuración previa',executionResult:index > 3 ? 'Ejecución sintética completada.' : null,
    validationResult:index > 3 ? 'Pruebas sintéticas aprobadas.' : null };
  if (process === 'ACCESS') return { resource: 'Portal de evaluación', permission: 'Lectura',accessAction:'GRANT',
    provisioningResult:index > 4 ? 'Concesión sintética registrada.' : null,
    validation:index > 4 ? 'Validación sintética completada.' : null };
  if (process === 'NEW_SERVICE') return { need:'Capacidad de demostración',feasibility:'Viabilidad sintética revisada.',
    linkedServiceId: null, proposedCode: `DEMO.NEW.${index}`, proposedName: `Servicio propuesto ${index}` };
  if (process === 'PROBLEM') return { rootCause: 'Causa sintética bajo investigación',
    workaround: index > 2 ? 'Ruta temporal' : null,knownError:index > 3 ? 'Error conocido sintético.' : null,
    definitiveSolution:index > 4 ? 'Corrección sintética aplicada.' : null };
  return { request: 'Atención de servicio tecnológico de evaluación',validation:'Solicitud validada para demostración.',
    delivery:index > 3 ? 'Prestación sintética realizada.' : null,
    confirmation:index > 4 ? 'Confirmación sintética registrada.' : null };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const position = await client.query<{ id: number }>('SELECT id FROM positions WHERE active ORDER BY id LIMIT 1');
    const services = await client.query<{ id: number }>(`SELECT id FROM service_level_2 WHERE status='ACTIVE' ORDER BY id`);
    if (!position.rows[0] || !services.rows[0]) throw new Error('Ejecuta seed-demo e import-catalog antes de seed-service-desk.');
    const users = await createUsers(client,position.rows[0].id);
    const administrator = await client.query<{ id: number }>(
      `SELECT id FROM users WHERE active AND role='ADMIN' ORDER BY id LIMIT 1`);
    if (!administrator.rows[0]) throw new Error('Ejecuta seed-demo para preparar el administrador de la base de conocimientos.');
    await seedKnowledge(client,administrator.rows[0].id);
    const responsibleUserId = users.get('agente1.demo');
    if (!responsibleUserId) throw new Error('No se creó el agente responsable de las colas.');
    const { queues, incidentEscalationQueueId } = await seedQueues(client,responsibleUserId);
    const repairedE0 = await normalizeSeededE0(client);
    const ci = await client.query<{ id: number }>(`SELECT id FROM configuration_items WHERE is_device ORDER BY id LIMIT 20`);
    let created = 0;
    for (const [,,process] of queueDefinitions) {
      const states = fixtureStates[process];
      for (let index = 1; index <= states.length; index++) {
        const number = `DEMO-${shortCodes[process]}-${String(index).padStart(2,'0')}`;
        const state = states[index - 1];
        const serviceId = services.rows[(index - 1) % services.rows.length].id;
        const processData: Record<string,unknown> = dataFor(process,index);
        if (process === 'NEW_SERVICE' && state === 'APPROVED') {
          processData.linkedServiceId = serviceId;
          processData.proposedCode = null;
          processData.proposedName = null;
          processData.approvedServiceId = serviceId;
        }
        if (process === 'NEW_SERVICE' && ['IMPLEMENTING','RESOLVED','CLOSED'].includes(state)) {
          processData.approvedServiceId = serviceId;
          processData.implementationResult = 'Implementación sintética documentada.';
        }
        const assignedUserId = ['ASSIGNED','FULFILLING','CONFIRMING'].includes(state) || index % 2 === 0
          ? users.get('agente1.demo') : null;
        const result = await client.query<{ id: number }>(`INSERT INTO tickets
          (number,title,description,requester_id,creator_id,beneficiary_id,service_id,queue_id,
           type,process,state,priority,impact,urgency,channel,process_data,no_ci_reason,
           assigned_user_id,first_attended_at,resolved_at,closed_at,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,3,3,'PORTAL',$13::jsonb,$14,
            $15,$16,$17,$18,NOW()-($19::int * INTERVAL '1 hour'))
          ON CONFLICT(number) DO NOTHING RETURNING id`,
          [number,`${process} - caso de evaluación ${index}`,
            'Ticket sintético para recorrer estados y permisos sin datos personales.',
            users.get('solicitante.demo'),users.get('solicitante.demo'),
            process === 'ACCESS' ? users.get('solicitante.demo') : null,
            serviceId,process === 'INCIDENT' && state === 'ESCALATED' ? incidentEscalationQueueId : queues.get(process),
            processType[process],process,state,
            1 + ((index - 1) % 5),JSON.stringify(processData),
            ci.rows.length ? null : 'Sin CI cargados al preparar la muestra',
            assignedUserId,
            index > 1 ? new Date() : null,
            state === 'RESOLVED' || state === 'CLOSED' ? new Date() : null,
            state === 'CLOSED' ? new Date() : null,index * 3]);
        if (!result.rows[0]) continue;
        created++;
        const ticketId = result.rows[0].id;
        if (ci.rows.length) await client.query('INSERT INTO ticket_ci(ticket_id,ci_id) VALUES($1,$2)', [ticketId,ci.rows[(index - 1) % ci.rows.length].id]);
        await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,new_values,reason)
          VALUES($1,$2,'DEMO_SEED',$3::jsonb,'Estado de muestra insertado directamente; no representa una transición ejecutada')`,
          [ticketId,users.get('solicitante.demo'),JSON.stringify({ state, process })]);
      }
    }
    const oldEscalated = await client.query<{ id: number; queue_id: number }>(`SELECT id,queue_id
      FROM tickets WHERE number='DEMO-INC-05' AND process='INCIDENT' FOR UPDATE`);
    if (oldEscalated.rows[0] && oldEscalated.rows[0].queue_id !== incidentEscalationQueueId) {
      await client.query('UPDATE tickets SET queue_id=$1,updated_at=NOW() WHERE id=$2',
        [incidentEscalationQueueId,oldEscalated.rows[0].id]);
      await client.query(`INSERT INTO ticket_history(ticket_id,actor_id,action,old_values,new_values,reason)
        VALUES($1,NULL,'DEMO_SEED_REPAIR',$2::jsonb,$3::jsonb,$4)`,
        [oldEscalated.rows[0].id,JSON.stringify({ queueId: oldEscalated.rows[0].queue_id }),
          JSON.stringify({ queueId: incidentEscalationQueueId }),
          'Se alinea el ejemplo de estado ESCALATED con una cola de soporte de nivel 2.']);
    }
    const totals = await client.query(`SELECT process,COUNT(*)::int AS count FROM tickets
      WHERE number LIKE 'DEMO-%' GROUP BY process ORDER BY process`);
    const articles = await client.query(`SELECT COUNT(*)::int AS total FROM knowledge_articles
      WHERE active AND title LIKE 'FAQ-L0-%'`);
    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: true,created,repairedE0,total: totals.rows.reduce((sum,row) => sum + row.count,0),
      byProcess: totals.rows,queues: queues.size + 1,knowledgeArticles: articles.rows[0].total,accounts: [...users.keys()] }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
