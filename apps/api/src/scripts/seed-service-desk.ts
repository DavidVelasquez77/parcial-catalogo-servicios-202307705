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

async function seedQueues(client: PoolClient) {
  const queues = new Map<DeskProcess,number>();
  for (const [code,name,process] of queueDefinitions) {
    const result = await client.query<{ id: number }>(`INSERT INTO support_queues
      (code,name,process,support_level,first_response_minutes,resolution_minutes)
      VALUES($1,$2,$3,1,60,480)
      ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,process=EXCLUDED.process,
        active=TRUE,updated_at=NOW() RETURNING id`, [code,name,process]);
    const queueId = result.rows[0].id;
    queues.set(process,queueId);
    await client.query(`INSERT INTO queue_grants(queue_id,role,can_view,can_handle,can_transfer)
      VALUES($1,'AGENTE',TRUE,TRUE,TRUE) ON CONFLICT DO NOTHING`, [queueId]);
    await client.query(`INSERT INTO queue_grants(queue_id,role,can_view,can_approve)
      VALUES($1,'APROBADOR',TRUE,TRUE) ON CONFLICT DO NOTHING`, [queueId]);
  }
  const escalationQueue = await client.query<{ id: number }>(`INSERT INTO support_queues
    (code,name,process,support_level,first_response_minutes,resolution_minutes)
    VALUES('Q-INCIDENT-L2','Soporte técnico de incidentes','INCIDENT',2,60,480)
    ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,process=EXCLUDED.process,
      support_level=2,active=TRUE,updated_at=NOW() RETURNING id`);
  const incidentEscalationQueueId = escalationQueue.rows[0].id;
  await client.query(`INSERT INTO queue_grants(queue_id,role,can_view,can_handle,can_transfer)
    VALUES($1,'AGENTE',TRUE,TRUE,TRUE) ON CONFLICT DO NOTHING`, [incidentEscalationQueueId]);
  return { queues, incidentEscalationQueueId };
}

function dataFor(process: DeskProcess, index: number) {
  if (process === 'EVENT') return { eventCategory: ['E0','E1','E2','E3','E1'][index - 1], assessment: 'Caso sintético de evaluación' };
  if (process === 'INCIDENT') return {
    incidentCategory: `I${index - 1}`, estimatedMinutes: index * 60,
    redundancyAvailable: index === 1, solution: index > 5 ? 'Recuperación sintética documentada' : null,
  };
  if (process === 'CHANGE') return { riskAssessment: 'Riesgo controlado de demostración', testPlan: 'Prueba de verificación', rollbackPlan: 'Restaurar configuración previa' };
  if (process === 'ACCESS') return { resource: 'Portal de evaluación', permission: 'Lectura' };
  if (process === 'NEW_SERVICE') return { linkedServiceId: null, proposedCode: `DEMO.NEW.${index}`, proposedName: `Servicio propuesto ${index}` };
  if (process === 'PROBLEM') return { rootCause: 'Causa sintética bajo investigación', workaround: index > 2 ? 'Ruta temporal' : null };
  return { request: 'Atención de servicio tecnológico de evaluación' };
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
    const { queues, incidentEscalationQueueId } = await seedQueues(client);
    const ci = await client.query<{ id: number }>(`SELECT id FROM configuration_items WHERE is_device ORDER BY id LIMIT 20`);
    let created = 0;
    for (const [,,process] of queueDefinitions) {
      const states = fixtureStates[process];
      for (let index = 1; index <= states.length; index++) {
        const number = `DEMO-${shortCodes[process]}-${String(index).padStart(2,'0')}`;
        const state = states[index - 1];
        const serviceId = services.rows[(index - 1) % services.rows.length].id;
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
            1 + ((index - 1) % 5),JSON.stringify(dataFor(process,index)),
            ci.rows.length ? null : 'Sin CI cargados al preparar la muestra',
            index % 2 === 0 ? users.get('agente1.demo') : null,
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
    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: true,created,total: totals.rows.reduce((sum,row) => sum + row.count,0),
      byProcess: totals.rows,queues: queues.size + 1,accounts: [...users.keys()] }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
