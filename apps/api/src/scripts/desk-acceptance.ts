import 'dotenv/config';
import { Pool } from 'pg';

if (process.env.DESK_TEST_ISOLATED !== '1') throw new Error('Esta suite solo se ejecuta con DESK_TEST_ISOLATED=1 en un proyecto Compose de pruebas.');
const base = 'http://127.0.0.1:3000/api';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const stamp = `${Date.now()}-${Math.floor(Math.random()*10000)}`;
const results: Array<{ id:string; result:'PASS'; detail?:unknown }> = [];
type Session = { cookie: string; id: number };

async function request(path: string, method = 'GET', body?: unknown, cookie = '') {
  const response = await fetch(base+path, { method, headers: {
    ...(body === undefined ? {} : {'Content-Type':'application/json'}),
    ...(cookie ? {Cookie:cookie} : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as Record<string,any>;
  const received = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  return {status:response.status,data,cookie:received.map((item) => item.split(';')[0]).join('; ')};
}
function eq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: esperaba ${String(expected)}, recibió ${String(actual)}`);
}
function truth(value: unknown, label: string) { if (!value) throw new Error(label); }
async function status(path: string, expected: number, method='GET', body?:unknown, session?:Session) {
  const response = await request(path,method,body,session?.cookie ?? '');
  if (response.status !== expected) throw new Error(`${method} ${path}: esperaba ${expected}, recibió ${response.status}: ${JSON.stringify(response.data)}`);
  return response.data;
}
async function login(username: string,password: string): Promise<Session> {
  const response = await request('/auth/login','POST',{identifier:username,password});
  eq(response.status,201,`login ${username}`);
  truth(response.cookie,`login ${username} sin cookie`);
  return {cookie:response.cookie,id:response.data.user.id};
}
function done(id:string, detail?:unknown) {results.push({id,result:'PASS',...(detail===undefined?{}:{detail})});console.log(JSON.stringify(results.at(-1)));}

async function main() {
  try {
    const absent = await request('/desk/tickets'); eq(absent.status,401,'sin sesión');
    const bad = await request('/auth/login','POST',{identifier:'admin.demo',password:'incorrecta'}); eq(bad.status,401,'clave inválida');
    const admin = await login(process.env.DEMO_ADMIN_USERNAME ?? 'admin.demo',process.env.DEMO_ADMIN_PASSWORD ?? 'Admin123!');
    const consulta = await login(process.env.DEMO_QUERY_USERNAME ?? 'consulta.demo',process.env.DEMO_QUERY_PASSWORD ?? 'Consulta123!');
    const requester = await login('solicitante.demo',process.env.DEMO_REQUESTER_PASSWORD ?? 'Solicita123!');
    const agent1 = await login('agente1.demo',process.env.DEMO_AGENT1_PASSWORD ?? 'Agente123!');
    const agent2 = await login('agente2.demo',process.env.DEMO_AGENT2_PASSWORD ?? 'Agente123!');
    const approver = await login('aprobador.demo',process.env.DEMO_APPROVER_PASSWORD ?? 'Aprueba123!');
    await status('/desk/queues',200,'GET',undefined,consulta);
    await status('/desk/queues',403,'POST',{code:`TEST-${stamp}`,name:'No',process:'EVENT'},consulta);
    const position = await pool.query('SELECT id FROM positions ORDER BY id LIMIT 1');
    const inactiveName = `inactive.${stamp}`;
    const inactive = await status('/users',201,'POST',{name:'Cuenta inactiva de prueba',username:inactiveName,password:'Test12345!',role:'SOLICITANTE',positionId:position.rows[0].id},admin);
    await status(`/users/${inactive.id}`,200,'PATCH',{active:false},admin);
    await status('/auth/login',401,'POST',{identifier:inactiveName,password:'Test12345!'});
    await status('/auth/logout',201,'POST',{},consulta);
    await status('/desk/tickets',401,'GET',undefined,consulta);
    done('P01');

    const counts = await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM service_level_1) AS level1,
      (SELECT COUNT(*)::int FROM service_level_2) AS level2,
      (SELECT COUNT(*)::int FROM service_level_2 WHERE code LIKE 'SE.12.%' AND status='REVIEW') AS review,
      (SELECT COUNT(*)::int FROM import_observations) AS observations`);
    eq(counts.rows[0].level1,12,'catálogo nivel 1');eq(counts.rows[0].level2,46,'catálogo nivel 2');
    truth(counts.rows[0].observations>0,'incidencias originales');
    done('P02',counts.rows[0]);

    const devices = await pool.query(`SELECT COUNT(*)::int AS total,COUNT(DISTINCT code)::int AS unique_codes
      FROM configuration_items WHERE is_device AND synthetic_seed='EVAL2026'`);
    eq(devices.rows[0].total,5000,'dispositivos');eq(devices.rows[0].unique_codes,5000,'códigos de dispositivo');
    done('P03',devices.rows[0]);

    const categories = await status('/cmdb/categories',200,'GET',undefined,admin) as Array<Record<string,any>>;
    truth(categories.some((c) => c.sourceKind==='EXCEL' && c.name==='Hardware'),'raíz Hardware del Excel');
    truth(categories.some((c) => c.sourceKind==='EXCEL' && c.name==='Software'),'raíz Software del Excel');
    truth(categories.filter((c) => c.code?.startsWith('HW-')).every((c) => c.sourceKind==='PROJECT'),
      'subcategorías sintéticas identificadas como decisión del proyecto');
    const sourceCi = await pool.query(`SELECT code,technical_attributes FROM configuration_items
      WHERE code IN ('CMDB-XLSX-5','CMDB-XLSX-6') ORDER BY code`);
    eq(sourceCi.rows.length,2,'CI originales del Excel');
    truth(sourceCi.rows.every((row) => row.technical_attributes.sourceSheet==='CMDB'),'trazabilidad de origen CMDB');
    truth(sourceCi.rows.every((row) => !row.technical_attributes.originalParentsChildren),
      'J5:J6 no aporta relaciones padre/hijo');
    await status('/cmdb/categories',400,'POST',{code:`BAD-${stamp}`,name:'Huérfana',parentId:999999999},admin);
    const root = await status('/cmdb/categories',201,'POST',{code:`RT-${stamp}`,name:'Raíz de prueba'},admin);
    const child = await status('/cmdb/categories',201,'POST',{code:`CH-${stamp}`,name:'Hija de prueba',parentId:root.id},admin);
    await status(`/cmdb/categories/${root.id}`,400,'PATCH',{parentId:child.id},admin);
    const controlledLocation = await status('/cmdb/locations',201,'POST',
      {code:`LOC-${stamp}`,name:'Laboratorio de prueba'},admin);
    await status('/cmdb/locations',409,'POST',
      {code:`LOC-${stamp}`,name:'Duplicada'},admin);
    const visibleLocations = await status('/cmdb/locations',200,'GET',undefined,admin);
    truth(visibleLocations.some((item:Record<string,unknown>)=>Number(item.id)===Number(controlledLocation.id)),
      'ubicación controlada recuperable');
    done('P04');

    const services = await status('/services?status=ACTIVE&pageSize=100',200,'GET',undefined,admin);
    const serviceId = services.data[0].id as number;
    const queues = await status('/desk/queues',200,'GET',undefined,admin) as Array<Record<string,any>>;
    const queueCodes: Record<string,string> = {NEW_SERVICE:'Q-NEW',CHANGE:'Q-CHANGE',INCIDENT:'Q-INCIDENT',EVENT:'Q-EVENT',PROBLEM:'Q-PROBLEM',ACCESS:'Q-ACCESS',TECH_SERVICE:'Q-TECH'};
    const queueId = (process:string) => {const q=queues.find((row) => row.code===queueCodes[process]);truth(q,`cola ${process}`);return q!.id as number;};
    const firstCi = await pool.query('SELECT id FROM configuration_items WHERE is_device ORDER BY id LIMIT 2');
    const ci1 = Number(firstCi.rows[0].id); const ci2 = Number(firstCi.rows[1].id);
    async function create(process:string, data:Record<string,unknown>={}, options:Record<string,unknown>={}, session=admin) {
      return status('/desk/tickets',201,'POST',{
        title:`Prueba ${process} ${stamp}`,description:'Caso automatizado aislado de evaluación.',
        serviceId,queueId:queueId(process),priority:3,impact:3,urgency:3,
        noCiReason:'No aplica un CI específico al caso de prueba.',processData:data,...options,
      },session);
    }
    const incident = await create('INCIDENT',{incidentCategory:'I1'});
    await status(`/desk/tickets/${incident.id}`,200,'GET',undefined,admin);
    await status('/desk/tickets',400,'POST',{title:'Inválido',description:'Referencia',serviceId:999999,queueId:queueId('INCIDENT'),noCiReason:'No aplica',processData:{incidentCategory:'I1'}},admin);
    await status('/desk/tickets?from=2026-99-99',400,'GET',undefined,admin);
    await status('/desk/tickets?from=2026-10-27&to=2026-10-26',400,'GET',undefined,admin);
    const filtered = await status(`/desk/tickets?search=${stamp}&queueId=${queueId('INCIDENT')}&serviceId=${serviceId}&priority=3`,200,'GET',undefined,admin);
    truth(filtered.data.some((row:Record<string,unknown>)=>Number(row.id)===Number(incident.id)),'filtros combinados de ticket');
    const filePath = `/desk/tickets/${incident.id}/attachments`;
    const evidence = new FormData();
    evidence.append('file',new Blob(['Evidencia de prueba'],{type:'text/plain'}),'evidencia.txt');
    const uploaded = await fetch(base+filePath,{method:'POST',headers:{Cookie:admin.cookie},body:evidence});
    eq(uploaded.status,201,'adjunto de texto válido');
    const attachment = await uploaded.json() as {id:number};
    const anonymousDownload = await fetch(`${base}${filePath}/${attachment.id}`);
    eq(anonymousDownload.status,401,'descarga sin sesión');
    const authorizedDownload = await fetch(`${base}${filePath}/${attachment.id}`,{headers:{Cookie:admin.cookie}});
    eq(authorizedDownload.status,200,'descarga autorizada');
    const invalidFile = new FormData();
    invalidFile.append('file',new Blob(['contenido inválido'],{type:'application/pdf'}),'falso.pdf');
    const invalidUpload = await fetch(base+filePath,{method:'POST',headers:{Cookie:admin.cookie},body:invalidFile});
    eq(invalidUpload.status,400,'firma de PDF inválida');
    done('P05');

    const privateQueue = await status('/desk/queues',201,'POST',{code:`PRV-${stamp}`,name:'Cola privada de prueba',process:'INCIDENT'},admin);
    await status(`/desk/queues/${privateQueue.id}/grants`,201,'POST',{userId:agent1.id,canView:true,canHandle:true,canTransfer:true},admin);
    const privateTicket = await create('INCIDENT',{incidentCategory:'I1'},{queueId:privateQueue.id});
    await status(`/desk/tickets/${privateTicket.id}`,200,'GET',undefined,agent1);
    await status(`/desk/tickets/${privateTicket.id}`,403,'GET',undefined,agent2);
    await status(`/desk/tickets/${privateTicket.id}/claim`,403,'POST',{},agent2);
    done('P06');

    const race = await create('INCIDENT',{incidentCategory:'I2'});
    const [claim1,claim2] = await Promise.all([
      request(`/desk/tickets/${race.id}/claim`,'POST',{},agent1.cookie),
      request(`/desk/tickets/${race.id}/claim`,'POST',{},agent2.cookie),
    ]);
    truth([claim1.status,claim2.status].includes(201) && [claim1.status,claim2.status].includes(409),'solo un agente debe tomar el ticket');
    const ordered = await status('/desk/tickets?process=INCIDENT&pageSize=100',200,'GET',undefined,admin);
    for (let index=1;index<ordered.data.length;index++) {
      truth(ordered.data[index-1].priority>=ordered.data[index].priority,'orden por prioridad');
    }
    done('P07',{claimStatuses:[claim1.status,claim2.status]});

    await status(`/desk/tickets/${race.id}/transfer`,201,'POST',{queueId:privateQueue.id,reason:'Escalamiento de prueba'},admin);
    const transferred = await status(`/desk/tickets/${race.id}`,200,'GET',undefined,admin);
    eq(transferred.queue_id,privateQueue.id,'cola destino');
    truth(transferred.history.some((item:Record<string,unknown>) => item.action==='TRANSFER'),'historial de transferencia');
    await status(`/desk/tickets/${race.id}/transfer`,400,'POST',{queueId:queueId('CHANGE'),reason:'Proceso distinto'},admin);
    done('P08');

    const resolvedByProcess: Record<string,number> = {};
    const paths: Array<{process:string;data:Record<string,unknown>;extra?:Record<string,unknown>;route:string[]}> = [
      {process:'NEW_SERVICE',data:{need:'Nueva capacidad',feasibility:'Viable',linkedServiceId:serviceId},route:['ANALYSIS','PENDING_APPROVAL','APPROVED','IMPLEMENTING','RESOLVED','CLOSED']},
      {process:'CHANGE',data:{riskAssessment:'Riesgo bajo',testPlan:'Prueba funcional',rollbackPlan:'Revertir configuración'},extra:{ciIds:[ci1]},route:['RISK_ASSESSMENT','PENDING_APPROVAL','APPROVED','PLANNED','EXECUTING','VALIDATING','RESOLVED','CLOSED']},
      {process:'INCIDENT',data:{incidentCategory:'I3'},route:['CLASSIFIED','DIAGNOSING','IN_PROGRESS','RESOLVED','CLOSED']},
      {process:'EVENT',data:{eventCategory:'E0'},route:['CLASSIFIED','EVALUATED','CLOSED']},
      {process:'PROBLEM',data:{rootCause:'Causa identificada'},route:['INVESTIGATING','DEFINITIVE_SOLUTION','RESOLVED','CLOSED']},
      {process:'ACCESS',data:{resource:'Sistema de prueba',permission:'Lectura'},extra:{beneficiaryId:requester.id},route:['PENDING_APPROVAL','APPROVED','PROVISIONING','VALIDATING','RESOLVED','CLOSED']},
      {process:'TECH_SERVICE',data:{request:'Atención programada'},route:['VALIDATING','ASSIGNED','FULFILLING','CONFIRMING','RESOLVED','CLOSED']},
    ];
    for (const item of paths) {
      const ticket = await create(item.process,item.data,item.extra ?? {});
      if (item.process==='PROBLEM') await status(`/desk/tickets/${ticket.id}/links`,201,'POST',{relatedTicketId:incident.id,linkType:'RELATED'},admin);
      if (item.process==='TECH_SERVICE') await status(`/desk/tickets/${ticket.id}/claim`,201,'POST',{},agent1);
      for (const to of item.route) {
        const session = to==='APPROVED' ? approver : admin;
        await status(`/desk/tickets/${ticket.id}/transition`,201,'POST',{to,reason:`Control ${to}`},session);
      }
      const closed = await status(`/desk/tickets/${ticket.id}`,200,'GET',undefined,admin);
      eq(closed.state,'CLOSED',`ruta ${item.process}`);
      resolvedByProcess[item.process]=ticket.id;
    }
    done('P09',Object.keys(resolvedByProcess));

    const rawChange = await create('CHANGE',{riskAssessment:'Riesgo',testPlan:'Prueba',rollbackPlan:'Reversión'},{ciIds:[ci1]});
    await status(`/desk/tickets/${rawChange.id}/transition`,400,'POST',{to:'EXECUTING'},admin);
    const selfAccess = await create('ACCESS',{resource:'Sistema',permission:'Lectura'},{beneficiaryId:requester.id});
    await status(`/desk/tickets/${selfAccess.id}/transition`,201,'POST',{to:'PENDING_APPROVAL'},admin);
    await status(`/desk/tickets/${selfAccess.id}/transition`,403,'POST',{to:'APPROVED'},admin);
    done('P10');

    for (const category of ['E0','E1','E2','E3']) {
      const event = await create('EVENT',{eventCategory:category});
      await status(`/desk/tickets/${event.id}/transition`,201,'POST',{to:'CLASSIFIED'},agent1);
      await status(`/desk/tickets/${event.id}/transition`,201,'POST',{to:'EVALUATED'},agent1);
      const links = await pool.query(`SELECT COUNT(*)::int AS total FROM ticket_links
        WHERE ticket_id=$1 AND link_type='GENERATED_INCIDENT'`,[event.id]);
      eq(links.rows[0].total,['E2','E3'].includes(category)?1:0,`evento ${category}`);
      await status(`/desk/tickets/${event.id}/transition`,400,'POST',{to:'EVALUATED'},agent1);
      if (['E2','E3'].includes(category)) {
        await status(`/desk/tickets/${event.id}/transition`,400,'POST',{to:'CLOSED'},agent1);
        await status(`/desk/tickets/${event.id}/transition`,201,'POST',{to:'RESPONDED'},agent1);
        const notifications = await status('/desk/notifications',200,'GET',undefined,admin) as Array<Record<string,any>>;
        truth(notifications.some((n) => n.ticketId===event.id),`notificación ${category}`);
      }
      await status(`/desk/tickets/${event.id}/transition`,201,'POST',{to:'CLOSED'},agent1);
    }
    done('P11');

    const categoriesIncident = await pool.query(`SELECT process_data->>'incidentCategory' AS category FROM tickets
      WHERE number LIKE 'DEMO-INC-%' ORDER BY number`);
    eq(new Set(categoriesIncident.rows.map((row) => row.category)).size,7,'I0-I6 en muestra');
    const gap = await status('/desk/incident-classification',201,'POST',{securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:10081},admin);
    eq(gap.rule,'PROJECT_GAP_RULE_7_TO_30_DAYS','regla del vacío temporal');
    done('P12');

    const problem = await create('PROBLEM',{rootCause:'Causa de prueba'});
    await status(`/desk/tickets/${problem.id}/links`,201,'POST',{relatedTicketId:incident.id,linkType:'RELATED'},admin);
    await status(`/desk/tickets/${problem.id}/links`,201,'POST',{relatedTicketId:rawChange.id,linkType:'IMPLEMENTS'},admin);
    const related = await status(`/desk/tickets/${problem.id}`,200,'GET',undefined,admin);
    eq(related.links.length,2,'relaciones problema-incidente-cambio');
    done('P13');

    const testCi1 = await status('/cmdb/items',201,'POST',{code:`T-A-${stamp}`,name:'CI origen de prueba',categoryId:child.id,locationId:controlledLocation.id,location:'Laboratorio de prueba',responsibleUserId:admin.id},admin);
    const testCi2 = await status('/cmdb/items',201,'POST',{code:`T-B-${stamp}`,name:'CI destino de prueba',categoryId:child.id,location:'Laboratorio',responsibleUserId:admin.id},admin);
    const testCi3 = await status('/cmdb/items',201,'POST',{code:`T-C-${stamp}`,name:'Componente de prueba',categoryId:child.id,location:'Laboratorio',responsibleUserId:admin.id},admin);
    await status('/cmdb/items',400,'POST',{code:`T-INVALID-${stamp}`,name:'Ubicación inválida',categoryId:child.id,locationId:999999999,responsibleUserId:admin.id},admin);
    await status(`/cmdb/locations/${controlledLocation.id}`,200,'PATCH',{name:'Laboratorio renombrado'},admin);
    const renamedCi = await status(`/cmdb/items/${testCi1.id}`,200,'GET',undefined,admin);
    eq(renamedCi.location,'Laboratorio renombrado','ubicación sincronizada');
    truth(renamedCi.history.some((item:Record<string,unknown>)=>item.action==='LOCATION_RENAME'),
      'cambio de ubicación en historial');
    await status(`/cmdb/locations/${controlledLocation.id}`,409,'PATCH',{active:false},admin);
    const changedCi = await status(`/cmdb/items/${testCi1.id}`,200,'PATCH',{name:'CI origen editado',isDevice:false},admin);
    eq(changedCi.is_device,false,'edición de CI no dispositivo');
    const ciDetail = await status(`/cmdb/items/${testCi1.id}`,200,'GET',undefined,admin);
    truth(Array.isArray(ciDetail.classificationPath) && ciDetail.classificationPath.length===2,'ruta jerárquica del CI');
    await status('/cmdb/services',201,'POST',{ciId:testCi1.id,serviceId},admin);
    await status('/cmdb/relations',201,'POST',{fromCiId:testCi1.id,toCiId:testCi2.id,relationType:'DEPENDS_ON'},admin);
    await status('/cmdb/relations',409,'POST',{fromCiId:testCi2.id,toCiId:testCi1.id,relationType:'DEPENDS_ON'},admin);
    await status('/cmdb/relations',409,'POST',{fromCiId:testCi2.id,toCiId:testCi1.id,relationType:'HOSTED_ON'},admin);
    await status('/cmdb/relations',201,'POST',{fromCiId:testCi1.id,toCiId:testCi3.id,relationType:'PARENT_OF'},admin);
    await status('/cmdb/relations',409,'POST',{fromCiId:testCi2.id,toCiId:testCi3.id,relationType:'PARENT_OF'},admin);
    await status('/cmdb/relations',409,'POST',{fromCiId:testCi3.id,toCiId:testCi1.id,relationType:'PARENT_OF'},admin);
    const parents = await pool.query(`SELECT COUNT(*)::int AS total FROM ci_relations
      WHERE to_ci_id=$1 AND relation_type='PARENT_OF'`,[testCi3.id]);
    eq(parents.rows[0].total,1,'componente con padre único');
    const impact = await status(`/cmdb/items/${testCi2.id}/impact`,200,'GET',undefined,admin);
    truth(impact.potentiallyAffected.some((item:Record<string,any>) => Number(item.id)===Number(testCi1.id)),'recorrido de dependencia');
    truth(impact.potentiallyAffected.some((item:Record<string,any>) => Number(item.service_id)===serviceId),'servicio potencialmente afectado');
    done('P14');

    const unfinished = await create('INCIDENT',{incidentCategory:'I4'});
    await status(`/desk/tickets/${unfinished.id}/transition`,400,'POST',{to:'CLOSED'},admin);
    for (const to of ['CLASSIFIED','DIAGNOSING','IN_PROGRESS','RESOLVED','CLOSED']) {
      await status(`/desk/tickets/${unfinished.id}/transition`,201,'POST',{to,reason:'Solución de prueba'},admin);
    }
    await status(`/desk/tickets/${unfinished.id}/transition`,201,'POST',{to:'SUBMITTED',reason:'Se repitió el problema'},admin);
    const reopened = await status(`/desk/tickets/${unfinished.id}`,200,'GET',undefined,admin);
    eq(reopened.reopen_count,1,'reapertura');truth(reopened.history.some((item:Record<string,unknown>) => item.action==='TRANSITION'),'actor en historial');
    done('P15');

    const started = performance.now();
    const page1 = await status('/cmdb/items?page=1&pageSize=25',200,'GET',undefined,admin);
    const observedMs = Math.round((performance.now()-started)*10)/10;
    const page2 = await status('/cmdb/items?page=2&pageSize=25',200,'GET',undefined,admin);
    truth(page1.total>=5000,'paginación sobre 5000');eq(page1.data.length,25,'25 por página');
    truth(page1.data[0].id!==page2.data[0].id,'páginas diferentes');
    done('P16',{observedMs,environment:'Docker Compose, API interna, PostgreSQL 16-alpine'});

    const metricTicket = await create('INCIDENT',{incidentCategory:'I2'});
    await pool.query(`UPDATE tickets SET created_at=NOW()-INTERVAL '2 hours',
      first_attended_at=NOW()-INTERVAL '90 minutes',
      resolved_at=NOW()-INTERVAL '30 minutes',
      paused_seconds=600,state='RESOLVED' WHERE id=$1`,[metricTicket.id]);
    const metrics = await status(`/desk/metrics?ticketId=${metricTicket.id}`,200,'GET',undefined,admin);
    eq(metrics.total,1,'métrica controlada');
    truth(Math.abs(metrics.averageFirstResponseMinutes-30)<0.2,'primera atención de 30 min');
    truth(Math.abs(metrics.averageResolutionMinutes-80)<0.2,'resolución de 80 min sin pausa');
    const openMetrics = await status(`/desk/metrics?ticketId=${rawChange.id}`,200,'GET',undefined,admin);
    eq(openMetrics.averageResolutionMinutes,null,'abierto sin resolución no promedia');
    done('P17',{firstResponseMinutes:metrics.averageFirstResponseMinutes,resolutionMinutes:metrics.averageResolutionMinutes});

    console.log(JSON.stringify({ok:true,checks:results.length,stamp}));
  } finally {await pool.end();}
}
main().catch((error) => {console.error(error);process.exitCode=1;});
