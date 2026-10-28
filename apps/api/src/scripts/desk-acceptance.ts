import 'dotenv/config';
import { Pool } from 'pg';
import { incidentLessonReference } from '../desk/incident-rules';

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
    const requiredDemoRoles = [
      [`${process.env.DEMO_ADMIN_USERNAME ?? 'admin.demo'}`,'ADMIN'],
      [`${process.env.DEMO_QUERY_USERNAME ?? 'consulta.demo'}`,'CONSULTA'],
      ['solicitante.demo','SOLICITANTE'],['agente1.demo','AGENTE'],['agente2.demo','AGENTE'],['aprobador.demo','APROBADOR'],
    ];
    const roleRows = await pool.query(`SELECT u.username,ur.role FROM users u JOIN user_roles ur ON ur.user_id=u.id
      WHERE u.active AND u.username=ANY($1::text[])`,[requiredDemoRoles.map(([username])=>username)]);
    const rolePairs = new Set(roleRows.rows.map((row)=>`${row.username}:${row.role}`));
    truth(requiredDemoRoles.every(([username,role])=>rolePairs.has(`${username}:${role}`)),
      'cuentas de evaluación de administrador, consulta, solicitante, agente y aprobador');
    const demoTicketRows = await pool.query(`SELECT process,COUNT(*)::int AS count,COUNT(DISTINCT state)::int AS states
      FROM tickets WHERE number LIKE 'DEMO-%' GROUP BY process ORDER BY process`);
    const expectedProcesses = ['ACCESS','CHANGE','EVENT','INCIDENT','NEW_SERVICE','PROBLEM','TECH_SERVICE'];
    eq(demoTicketRows.rows.length,7,'siete procesos con tickets de muestra');
    truth(demoTicketRows.rows.reduce((sum,row)=>sum+row.count,0)>=35,'35 tickets de demostración');
    truth(demoTicketRows.rows.every((row)=>row.count>=5 && row.states>=2),'cinco tickets y varios estados por proceso');
    const demoQueues = await pool.query(`SELECT DISTINCT process FROM support_queues WHERE active ORDER BY process`);
    truth(expectedProcesses.every((process)=>demoQueues.rows.some((row)=>row.process===process)),
      'una cola activa por proceso');
    const demoEventCategories = await pool.query(`SELECT DISTINCT process_data->>'eventCategory' AS category
      FROM tickets WHERE number LIKE 'DEMO-EVT-%' ORDER BY category`);
    eq(demoEventCategories.rows.map((row)=>row.category).join(','),'E0,E1,E2,E3','categorías de evento de demostración');
    const demoEventFixtures = await pool.query(`SELECT number,state,process_data FROM tickets
      WHERE number LIKE 'DEMO-EVT-%' ORDER BY number`);
    eq(demoEventFixtures.rows.length,5,'cinco tickets de evento de demostración');
    const seededE0Fixture = demoEventFixtures.rows.find((row)=>row.number==='DEMO-EVT-01');
    truth(seededE0Fixture?.state==='CLOSED' && !('assessment' in seededE0Fixture.process_data) &&
      !('response' in seededE0Fixture.process_data),'E0 de muestra solo registra el evento');
    const seededE1Fixtures = demoEventFixtures.rows.filter((row)=>row.process_data.eventCategory==='E1');
    truth(seededE1Fixtures.length===2 && seededE1Fixtures.every((row)=>row.state==='EVALUATED' &&
      Boolean(row.process_data.assessment) && !('response' in row.process_data)),
      'E1 de muestra conserva evaluación y no inventa respuesta operativa');
    const pendingImpactEvents = demoEventFixtures.rows.filter((row)=>['E2','E3'].includes(String(row.process_data.eventCategory)));
    truth(pendingImpactEvents.length===2 && pendingImpactEvents.every((row)=>row.state==='SUBMITTED' &&
      !('response' in row.process_data)),'E2/E3 de muestra esperan evaluación y respuesta operativa');
    const demoIncidentCategories = await pool.query(`SELECT DISTINCT process_data->>'incidentCategory' AS category
      FROM tickets WHERE number LIKE 'DEMO-INC-%' ORDER BY category`);
    eq(demoIncidentCategories.rows.map((row)=>row.category).join(','),'I0,I1,I2,I3,I4,I5,I6','categorías de incidente de demostración');
    await status('/desk/queues',200,'GET',undefined,consulta);
    await status('/desk/queues',403,'POST',{code:`TEST-${stamp}`,name:'No',process:'EVENT'},consulta);
    const position = await pool.query('SELECT id FROM positions ORDER BY id LIMIT 1');
    const inactiveName = `inactive.${stamp}`;
    const inactive = await status('/users',201,'POST',{name:'Cuenta inactiva de prueba',username:inactiveName,password:'Test12345!',role:'SOLICITANTE',positionId:position.rows[0].id},admin);
    await status(`/users/${inactive.id}`,200,'PATCH',{active:false},admin);
    await status('/auth/login',401,'POST',{identifier:inactiveName,password:'Test12345!'});
    await status('/auth/logout',201,'POST',{},consulta);
    await status('/desk/tickets',401,'GET',undefined,consulta);
    done('P01',{demoRoles:requiredDemoRoles,tickets:demoTicketRows.rows,queues:demoQueues.rows.map((row)=>row.process),
      eventCategories:demoEventCategories.rows.map((row)=>row.category),incidentCategories:demoIncidentCategories.rows.map((row)=>row.category)});

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
    const byCategory = await pool.query(`SELECT cc.code,COUNT(*)::int AS count
      FROM configuration_items ci JOIN ci_categories cc ON cc.id=ci.category_id
      WHERE ci.is_device AND ci.synthetic_seed='EVAL2026' GROUP BY cc.code ORDER BY cc.code`);
    eq(byCategory.rows.length,4,'cuatro clases sintéticas de hardware');
    truth(byCategory.rows.every((row) => row.count===1250),'distribución reproducible de 1,250 por clase');
    const generatorIntegrity = await pool.query(`SELECT
      COUNT(*) FILTER(WHERE ci.location_id IS NULL OR owner.id IS NULL)::int AS missing_reference,
      COUNT(*) FILTER(WHERE owner.username IS DISTINCT FROM 'admin.demo')::int AS non_demo_owner,
      COUNT(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM ci_services cs WHERE cs.ci_id=ci.id))::int AS missing_service,
      COUNT(*) FILTER(WHERE ci.technical_attributes ? 'ipAddress')::int AS invented_required_ip,
      COUNT(*) FILTER(WHERE NOT (
        (cc.code='HW-SERVER' AND ci.technical_attributes ?& ARRAY['cpuCores','memoryGb','rackUnit']) OR
        (cc.code='HW-WORKSTATION' AND ci.technical_attributes ?& ARRAY['cpuCores','memoryGb','formFactor']) OR
        (cc.code='HW-NETWORK' AND ci.technical_attributes ?& ARRAY['ports','managed','protocol']) OR
        (cc.code='HW-STORAGE' AND ci.technical_attributes ?& ARRAY['capacityTb','driveCount'])
      ))::int AS invalid_class_attributes
      FROM configuration_items ci JOIN ci_categories cc ON cc.id=ci.category_id
      LEFT JOIN users owner ON owner.id=ci.responsible_user_id
      WHERE ci.is_device AND ci.synthetic_seed='EVAL2026'`);
    eq(generatorIntegrity.rows[0].missing_reference,0,'referencias existentes de ubicación y responsable');
    eq(generatorIntegrity.rows[0].non_demo_owner,0,'responsable sintético sin personas reales');
    eq(generatorIntegrity.rows[0].missing_service,0,'servicio existente asociado a cada dispositivo de muestra');
    eq(generatorIntegrity.rows[0].invented_required_ip,0,'dirección IP no obligatoria');
    eq(generatorIntegrity.rows[0].invalid_class_attributes,0,'atributos técnicos de acuerdo con la clase');
    const categoryTree = await pool.query(`WITH RECURSIVE category_path(id,code,name,level_no,path) AS (
        SELECT id,code,name,0,ARRAY[id] FROM ci_categories WHERE parent_id IS NULL AND active
        UNION ALL SELECT child.id,child.code,child.name,parent.level_no+1,parent.path||child.id
        FROM ci_categories child JOIN category_path parent ON child.parent_id=parent.id WHERE child.active
      )
      SELECT ancestor.level_no AS level,ancestor.code AS category_code,COUNT(DISTINCT ci.id)::int AS count
      FROM category_path ancestor
      LEFT JOIN category_path leaf ON ancestor.id=ANY(leaf.path)
      LEFT JOIN configuration_items ci ON ci.category_id=leaf.id AND ci.is_device AND ci.synthetic_seed='EVAL2026'
      WHERE ancestor.code=ANY(ARRAY['HARDWARE','SOFTWARE','HW-SERVER','HW-WORKSTATION','HW-NETWORK','HW-STORAGE']::text[])
      GROUP BY ancestor.level_no,ancestor.code ORDER BY ancestor.level_no,ancestor.code`);
    eq(categoryTree.rows.find((row) => row.category_code==='HARDWARE')?.count,5000,'recuento real por categoría raíz');
    eq(categoryTree.rows.find((row) => row.category_code==='SOFTWARE')?.count,0,'categoría sin dispositivos muestra el cero');
    done('P03',{...devices.rows[0],byCategory:byCategory.rows,byLevelAndCategory:categoryTree.rows});

    const categories = await status('/cmdb/categories',200,'GET',undefined,admin) as Array<Record<string,any>>;
    truth(categories.some((c) => c.sourceKind==='EXCEL' && c.name==='Hardware'),'raíz Hardware del Excel');
    truth(categories.some((c) => c.sourceKind==='EXCEL' && c.name==='Software'),'raíz Software del Excel');
    truth(categories.filter((c) => c.code?.startsWith('HW-')).every((c) => c.sourceKind==='PROJECT'),
      'subcategorías sintéticas identificadas como decisión del proyecto');
    const sourceCi = await pool.query(`SELECT ci.*,category.name AS category_name FROM configuration_items ci
      JOIN ci_categories category ON category.id=ci.category_id
      WHERE ci.code IN ('CMDB-XLSX-5','CMDB-XLSX-6') ORDER BY ci.code`);
    eq(sourceCi.rows.length,2,'CI originales del Excel');
    truth(sourceCi.rows.every((row) => row.technical_attributes.sourceSheet==='CMDB'),'trazabilidad de origen CMDB');
    truth(sourceCi.rows.every((row) => !row.technical_attributes.originalParentsChildren),
      'J5:J6 no aporta relaciones padre/hijo');
    const originalServer = sourceCi.rows.find((row) => row.name==='Servidor1');
    truth(originalServer,'registro de Servidor1 del Excel');
    eq(originalServer.category_name,'Hardware','tipo de CI original');
    eq(originalServer.description,'Servidor de Aplicaciones','descripción original');
    eq(originalServer.serial_number,'SN123456','serie original');
    eq(originalServer.version,'v1.0','versión original');
    truth(new Date(originalServer.acquired_on).toISOString().startsWith('2022-01-01'),'fecha de adquisición original');
    eq(originalServer.location,'Sala de Servidores 1','ubicación física original');
    eq(originalServer.responsible_label,'Equipo de Infraestructura','responsable original');
    eq(originalServer.security_level,'Alto','nivel de seguridad original');
    eq(originalServer.compliance_status,'Cumple','cumplimiento original');
    eq(originalServer.configuration_status,'Aprobado','estado de configuración original');
    eq(originalServer.license_number,'ABC123','licencia original');
    truth(new Date(originalServer.license_expires_on).toISOString().startsWith('2023-01-01'),'vencimiento original');
    eq(originalServer.technical_attributes.originalRelations,'Base de Datos1','relación original ambigua conservada');
    eq(originalServer.technical_attributes.sourceChangeDate,'2022-02-01','fecha de cambio original conservada');
    eq(originalServer.technical_attributes.sourceChangeDescription,'Actualización de Software','cambio original conservado');
    eq(originalServer.technical_attributes.originalDocumentation,'[Enlace a Manual](url)','documentación original conservada');
    eq(originalServer.technical_attributes.originalIncidentLinks,'[Enlace a Incidente](url)','enlace de incidente original conservado');
    const originalDetail = await status(`/cmdb/items/${originalServer.id}`,200,'GET',undefined,admin);
    eq(originalDetail.responsible_label,'Equipo de Infraestructura','detalle muestra el responsable de origen legible');
    truth(originalDetail.classificationPath.some((item:Record<string,unknown>)=>item.name==='Hardware'),'detalle muestra la clasificación completa');
    eq(originalDetail.technical_attributes.sourceSheet,'CMDB','ficha conserva la hoja de origen');
    eq(originalDetail.technical_attributes.sourceRow,5,'ficha conserva la fila de origen');
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
    const serviceCode = services.data[0].code as string;
    const queues = await status('/desk/queues',200,'GET',undefined,admin) as Array<Record<string,any>>;
    const queueCodes: Record<string,string> = {NEW_SERVICE:'Q-NEW',CHANGE:'Q-CHANGE',INCIDENT:'Q-INCIDENT',EVENT:'Q-EVENT',PROBLEM:'Q-PROBLEM',ACCESS:'Q-ACCESS',TECH_SERVICE:'Q-TECH'};
    const queueId = (process:string) => {const q=queues.find((row) => row.code===queueCodes[process]);truth(q,`cola ${process}`);return q!.id as number;};
    const firstCi = await pool.query('SELECT id FROM configuration_items WHERE is_device ORDER BY id LIMIT 2');
    const ci1 = Number(firstCi.rows[0].id); const ci2 = Number(firstCi.rows[1].id);
    async function create(process:string, data:Record<string,unknown>={}, options:Record<string,unknown>={}, session=admin) {
      const incidentDurations: Record<string,number|null> = {I0:null,I1:120,I2:360,I3:1500,I4:5000,I5:45000,I6:null};
      const processData = process==='INCIDENT'
        ? {interruptsOrDegrades:data.incidentCategory==='I0'?false:true,
          estimatedMinutes:incidentDurations[String(data.incidentCategory)] ?? null,...data}
        : data;
      return status('/desk/tickets',201,'POST',{
        title:`Prueba ${process} ${stamp}`,description:'Caso automatizado aislado de evaluación.',
        serviceId,queueId:queueId(process),priority:3,impact:3,urgency:3,
        noCiReason:'No aplica un CI específico al caso de prueba.',processData,...options,
      },session);
    }
    async function saveProcessData(ticketId:number,data:Record<string,unknown>) {
      return status(`/desk/tickets/${ticketId}/process-data`,200,'PATCH',data,admin);
    }
    const incident = await create('INCIDENT',{incidentCategory:'I1'});
    await status(`/desk/tickets/${incident.id}`,200,'GET',undefined,admin);
    await status('/desk/tickets',400,'POST',{title:'Inválido',description:'Referencia',serviceId:999999,queueId:queueId('INCIDENT'),noCiReason:'No aplica',processData:{incidentCategory:'I1'}},admin);
    await status('/desk/tickets',409,'POST',{
      title:'Servicio duplicado',description:'Código existente',serviceId,queueId:queueId('NEW_SERVICE'),
      noCiReason:'No aplica',processData:{need:'Capacidad',feasibility:'Viable',proposedCode:serviceCode,proposedName:'Duplicado'},
    },admin);
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
    const knowledge = await status('/desk/knowledge',200,'GET',undefined,admin) as Array<Record<string,any>>;
    const l0Articles = knowledge.filter((article) => String(article.title).startsWith('FAQ-L0-'));
    eq(l0Articles.length,5,'cinco artículos de autoservicio nivel 0 sembrados');
    truth(l0Articles.some((article) => article.title==='FAQ-L0-01 · Registrar una solicitud'),'FAQ de registro publicada');
    const seededE0 = await pool.query<{ process_data: Record<string,unknown> }>(`SELECT process_data FROM tickets
      WHERE number='DEMO-EVT-01' AND process='EVENT'`);
    truth(seededE0.rows[0]?.process_data.eventCategory==='E0' && !('assessment' in seededE0.rows[0].process_data) &&
      !('response' in seededE0.rows[0].process_data),'E0 de muestra solo conserva su registro');
    done('P05',{knowledgeArticles:l0Articles.length});

    await status('/desk/queues',400,'POST',{code:`NO-OWNER-${stamp}`,name:'Sin responsable',process:'INCIDENT'},admin);
    await status('/desk/queues',400,'POST',
      {code:`CONSULTA-${stamp}`,name:'Responsable consulta',process:'INCIDENT',responsibleUserId:consulta.id},admin);
    const privateQueue = await status('/desk/queues',201,'POST',
      {code:`PRV-${stamp}`,name:'Cola privada de prueba',process:'INCIDENT',responsibleUserId:agent1.id,
        sortRule:'AGE_PRIORITY',firstResponseMinutes:45,resolutionMinutes:240},admin);
    eq(privateQueue.responsible_user_id,agent1.id,'responsable de cola');
    eq(privateQueue.sort_rule,'AGE_PRIORITY','regla de orden configurada');
    const initialGrants = await status(`/desk/queues/${privateQueue.id}/grants`,200,'GET',undefined,admin);
    const ownerGrant = initialGrants.find((grant:Record<string,unknown>) => grant.userId===agent1.id);
    truth(ownerGrant?.canView===true && ownerGrant?.canHandle===true,'responsable con acceso de atención');
    await status(`/desk/queues/${privateQueue.id}/grants/${ownerGrant.id}`,409,'DELETE',undefined,admin);
    await status('/desk/queues',409,'POST',
      {code:`PRV-${stamp}`,name:'Código repetido',process:'INCIDENT',responsibleUserId:agent1.id},admin);
    await status(`/desk/queues/${privateQueue.id}/grants`,201,'POST',
      {userId:agent1.id,canView:true,canHandle:true,canTransfer:true,canAdmin:true},admin);
    await status(`/desk/queues/${privateQueue.id}`,200,'PATCH',{description:'Administrada por agente autorizado'},agent1);
    const delegated = await status(`/desk/queues/${privateQueue.id}/grants`,200,'GET',undefined,agent1);
    truth(delegated.some((grant:Record<string,unknown>) => grant.userId===agent1.id && grant.canAdmin===true),
      'administración de cola delegada por permiso');
    await status(`/desk/queues/${privateQueue.id}/grants`,201,'POST',{userId:approver.id,canAdmin:true},admin);
    await status(`/desk/queues/${privateQueue.id}`,200,'PATCH',{description:'Administrada también por aprobador'},approver);
    await status(`/desk/queues/${privateQueue.id}`,403,'PATCH',{name:'Sin permiso'},agent2);
    await status(`/desk/queues/${privateQueue.id}/grants`,400,'POST',
      {userId:consulta.id,canView:true,canHandle:true},admin);
    await status(`/desk/queues/${privateQueue.id}/grants`,400,'POST',
      {role:'CONSULTA',canAdmin:true},admin);
    const privateTicket = await create('INCIDENT',{incidentCategory:'I1'},{queueId:privateQueue.id});
    await status(`/desk/tickets/${privateTicket.id}`,200,'GET',undefined,agent1);
    await status(`/desk/tickets/${privateTicket.id}`,403,'GET',undefined,agent2);
    await status(`/desk/tickets/${privateTicket.id}/claim`,403,'POST',{},agent2);
    await status(`/desk/tickets/${privateTicket.id}/claim`,403,'POST',{},approver);
    const delegatedGrant = await status(`/desk/queues/${privateQueue.id}/grants`,201,'POST',
      {userId:agent2.id,canView:true},agent1);
    await status(`/desk/tickets/${privateTicket.id}`,200,'GET',undefined,agent2);
    await status(`/desk/tickets/${privateTicket.id}/claim`,403,'POST',{},agent2);
    await status(`/desk/queues/${privateQueue.id}/grants/${delegatedGrant.id}`,200,'DELETE',undefined,agent1);
    await status(`/desk/tickets/${privateTicket.id}`,403,'GET',undefined,agent2);
    await status(`/desk/queues/${privateQueue.id}`,409,'PATCH',{active:false},admin);
    await status(`/users/${agent1.id}`,409,'PATCH',{active:false},admin);
    await status(`/desk/tickets/${privateTicket.id}/claim`,201,'POST',{},agent1);
    await status(`/desk/queues/${privateQueue.id}/grants`,409,'POST',
      {userId:agent1.id,canView:true,canAdmin:true},admin);
    done('P06');

    const older = await create('INCIDENT',{incidentCategory:'I1'},
      {queueId:privateQueue.id,title:`ORDER-${stamp}-older`,priority:1});
    const newer = await create('INCIDENT',{incidentCategory:'I1'},
      {queueId:privateQueue.id,title:`ORDER-${stamp}-newer`,priority:5});
    await pool.query("UPDATE tickets SET created_at=NOW()-INTERVAL '1 hour' WHERE id=$1",[older.id]);
    const ageOrdered = await status(`/desk/tickets?queueId=${privateQueue.id}&search=ORDER-${stamp}`,200,'GET',undefined,admin);
    eq(ageOrdered.data[0].id,older.id,'orden por antigüedad de cola');
    const defaultOrdered = await status(`/desk/tickets?search=ORDER-${stamp}`,200,'GET',undefined,admin);
    eq(defaultOrdered.data[0].id,newer.id,'orden global por prioridad');
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
    const candidates = await status(`/desk/queues/${queueId('INCIDENT')}/assignees`,200,'GET',undefined,admin);
    truth(candidates.some((candidate:Record<string,unknown>) => candidate.id===agent1.id) &&
      !candidates.some((candidate:Record<string,unknown>) => candidate.id===requester.id),
      'solo agentes autorizados aparecen para asignación');
    const claimed = await status(`/desk/tickets/${race.id}`,200,'GET',undefined,admin);
    const targetAgentId = claimed.assigned_user_id===agent1.id ? agent2.id : agent1.id;
    await status(`/desk/tickets/${race.id}/assign`,403,'POST',{userId:agent1.id},agent2);
    await status(`/desk/tickets/${race.id}/assign`,400,'POST',{userId:requester.id},admin);
    await status(`/desk/tickets/${race.id}/assign`,201,'POST',{userId:targetAgentId,reason:'Asignación supervisada'},admin);
    const assigned = await status(`/desk/tickets/${race.id}`,200,'GET',undefined,admin);
    eq(assigned.assigned_user_id,targetAgentId,'agente reasignado');
    truth(assigned.history.some((item:Record<string,any>) => item.action==='ASSIGN' &&
      item.actor_id===admin.id && item.old_values.assignedUserId===claimed.assigned_user_id &&
      item.new_values.assignedUserId===targetAgentId),
      'asignación dirigida con actor y cambio registrado');
    done('P07',{claimStatuses:[claim1.status,claim2.status]});

    await status(`/desk/tickets/${race.id}/transfer`,201,'POST',{queueId:privateQueue.id,reason:'Escalamiento de prueba'},admin);
    const transferred = await status(`/desk/tickets/${race.id}`,200,'GET',undefined,admin);
    eq(transferred.queue_id,privateQueue.id,'cola destino');
    truth(transferred.history.some((item:Record<string,unknown>) => item.action==='TRANSFER'),'historial de transferencia');
    await status(`/desk/tickets/${race.id}/transfer`,400,'POST',{queueId:queueId('CHANGE'),reason:'Proceso distinto'},admin);
    await status(`/desk/tickets/${race.id}/transition`,201,'POST',{to:'CLASSIFIED'},admin);
    await status(`/desk/tickets/${race.id}/transition`,201,'POST',{to:'DIAGNOSING'},admin);
    await status(`/desk/tickets/${race.id}/transition`,400,'POST',{to:'ESCALATED',reason:'Sin destino'},admin);
    await status(`/desk/tickets/${race.id}/escalate`,400,'POST',{queueId:queueId('INCIDENT'),reason:'Mismo nivel'},admin);
    const upperQueue = await status('/desk/queues',201,'POST',
      {code:`ESC-${stamp}`,name:'Soporte nivel 2 de prueba',process:'INCIDENT',supportLevel:2,
        responsibleUserId:agent1.id},admin);
    await status(`/desk/tickets/${race.id}/escalate`,403,'POST',
      {queueId:upperQueue.id,reason:'Sin permiso'},agent2);
    await status(`/desk/tickets/${race.id}/escalate`,400,'POST',{queueId:upperQueue.id},admin);
    await status(`/desk/tickets/${race.id}/escalate`,201,'POST',
      {queueId:upperQueue.id,reason:'Escalamiento documentado'},admin);
    const escalated = await status(`/desk/tickets/${race.id}`,200,'GET',undefined,admin);
    eq(escalated.state,'ESCALATED','estado escalado');
    eq(escalated.queue_id,upperQueue.id,'cola de nivel superior');
    const escalation = escalated.history.find((item:Record<string,unknown>) => item.action==='ESCALATE');
    truth(escalation && escalation.actor_id===admin.id && escalation.actor_name &&
      escalation.old_values.supportLevel===1 && escalation.new_values.supportLevel===2 &&
      escalation.old_values.queueId===privateQueue.id && escalation.new_values.queueId===upperQueue.id,
      'escalamiento con actor y valores anteriores/nuevos');
    const seededEscalation = await pool.query(`SELECT q.support_level FROM tickets t
      JOIN support_queues q ON q.id=t.queue_id WHERE t.number='DEMO-INC-05' AND t.state='ESCALATED'`);
    eq(seededEscalation.rows[0]?.support_level,2,'ejemplo escalado en nivel 2');
    done('P08');

    const resolvedByProcess: Record<string,number> = {};
    const paths: Array<{process:string;data:Record<string,unknown>;extra?:Record<string,unknown>;route:string[]}> = [
      {process:'NEW_SERVICE',data:{need:'Nueva capacidad',feasibility:'Viable',linkedServiceId:serviceId},route:['ANALYSIS','PENDING_APPROVAL','APPROVED','IMPLEMENTING','RESOLVED','CLOSED']},
      {process:'NEW_SERVICE',data:{need:'Capacidad adicional de evaluación',feasibility:'Viable con controles aprobados',proposedCode:`P09-${stamp}`,proposedName:'Servicio nuevo de aceptación'},route:['ANALYSIS','PENDING_APPROVAL','APPROVED','IMPLEMENTING','RESOLVED','CLOSED']},
      {process:'CHANGE',data:{riskAssessment:'Riesgo bajo',testPlan:'Prueba funcional',rollbackPlan:'Revertir configuración'},extra:{ciIds:[ci1]},route:['RISK_ASSESSMENT','PENDING_APPROVAL','APPROVED','PLANNED','EXECUTING','VALIDATING','RESOLVED','CLOSED']},
      {process:'INCIDENT',data:{incidentCategory:'I3'},route:['CLASSIFIED','DIAGNOSING','IN_PROGRESS','RESOLVED','CLOSED']},
      {process:'EVENT',data:{eventCategory:'E0'},route:['CLOSED']},
      {process:'PROBLEM',data:{rootCause:'Causa identificada'},route:['INVESTIGATING','DEFINITIVE_SOLUTION','RESOLVED','CLOSED']},
      {process:'ACCESS',data:{resource:'Sistema de prueba',permission:'Lectura',accessAction:'GRANT'},extra:{beneficiaryId:requester.id},route:['PENDING_APPROVAL','APPROVED','PROVISIONING','VALIDATING','RESOLVED','CLOSED']},
      {process:'TECH_SERVICE',data:{request:'Atención programada'},route:['VALIDATING','ASSIGNED','FULFILLING','CONFIRMING','RESOLVED','CLOSED']},
    ];
    await status('/desk/tickets',400,'POST',{
      title:'Incidente sin indicador',description:'Prueba de validación del proceso',serviceId,
      queueId:queueId('INCIDENT'),noCiReason:'No aplica',processData:{incidentCategory:'I1'},
    },admin);
    await status('/desk/tickets',400,'POST',{
      title:'Incidente incoherente',description:'Duración incompatible con I1',serviceId,
      queueId:queueId('INCIDENT'),noCiReason:'No aplica',
      processData:{incidentCategory:'I1',interruptsOrDegrades:true,estimatedMinutes:600},
    },admin);
    await status('/desk/tickets',400,'POST',{
      title:'Incidente con duración cero',description:'Una interrupción requiere duración positiva',serviceId,
      queueId:queueId('INCIDENT'),noCiReason:'No aplica',
      processData:{incidentCategory:'I1',interruptsOrDegrades:true,estimatedMinutes:0},
    },admin);
    await status('/desk/tickets',400,'POST',{
      title:'Cambio sin riesgo',description:'Prueba de validación del proceso',serviceId,
      queueId:queueId('CHANGE'),noCiReason:'No aplica',processData:{},ciIds:[ci1],
    },admin);
    await status('/desk/tickets',400,'POST',{
      title:'Cambio sin CI',description:'Prueba de validación del proceso',serviceId,
      queueId:queueId('CHANGE'),noCiReason:'El cambio no debe aceptar motivo de ausencia de CI.',
      processData:{riskAssessment:'Riesgo',testPlan:'Prueba',rollbackPlan:'Reversión'},
    },admin);
    await status('/desk/tickets',400,'POST',{
      title:'Acceso sin operación',description:'Prueba de validación del proceso',serviceId,
      queueId:queueId('ACCESS'),noCiReason:'No aplica',beneficiaryId:requester.id,
      processData:{resource:'Sistema',permission:'Lectura'},
    },admin);
    const problemWithoutIncident = await create('PROBLEM',{rootCause:'Causa sin incidente'});
    await status(`/desk/tickets/${problemWithoutIncident.id}/transition`,400,'POST',{to:'INVESTIGATING'},admin);
    await status(`/desk/tickets/${problemWithoutIncident.id}/links`,201,'POST',
      {relatedTicketId:incident.id,linkType:'RELATED'},admin);
    await status(`/desk/tickets/${problemWithoutIncident.id}/transition`,201,'POST',{to:'INVESTIGATING'},admin);
    await status(`/desk/tickets/${problemWithoutIncident.id}/transition`,400,'POST',{to:'WORKAROUND'},admin);
    await saveProcessData(problemWithoutIncident.id,{workaround:'Servicio temporal alterno.'});
    await status(`/desk/tickets/${problemWithoutIncident.id}/transition`,201,'POST',{to:'WORKAROUND'},admin);
    await status(`/desk/tickets/${problemWithoutIncident.id}/transition`,400,'POST',{to:'KNOWN_ERROR'},admin);
    await saveProcessData(problemWithoutIncident.id,{knownError:'Defecto reproducible bajo condición documentada.'});
    await status(`/desk/tickets/${problemWithoutIncident.id}/transition`,201,'POST',{to:'KNOWN_ERROR'},admin);
    await status(`/desk/tickets/${problemWithoutIncident.id}/transition`,400,'POST',{to:'DEFINITIVE_SOLUTION'},admin);
    await saveProcessData(problemWithoutIncident.id,{definitiveSolution:'Corrección permanente desplegada.'});
    await status(`/desk/tickets/${problemWithoutIncident.id}/transition`,201,'POST',{to:'DEFINITIVE_SOLUTION'},admin);
    for (const item of paths) {
      const ticket = await create(item.process,item.data,item.extra ?? {});
      if (item.process==='PROBLEM') await status(`/desk/tickets/${ticket.id}/links`,201,'POST',{relatedTicketId:incident.id,linkType:'RELATED'},admin);
      if (item.process==='TECH_SERVICE') await status(`/desk/tickets/${ticket.id}/claim`,201,'POST',{},agent1);
      for (const to of item.route) {
        if (item.process==='NEW_SERVICE' && to==='RESOLVED') {
          await status(`/desk/tickets/${ticket.id}/transition`,400,'POST',{to,reason:'Implementación terminada'},admin);
          await saveProcessData(ticket.id,{implementationResult:'Servicio configurado y documentado.'});
        }
        if (item.process==='CHANGE' && to==='VALIDATING') {
          await status(`/desk/tickets/${ticket.id}/transition`,400,'POST',{to},admin);
          await saveProcessData(ticket.id,{executionResult:'Cambio aplicado según el plan.'});
        }
        if (item.process==='CHANGE' && to==='RESOLVED') {
          await status(`/desk/tickets/${ticket.id}/transition`,400,'POST',{to,reason:'Pruebas realizadas'},admin);
          await saveProcessData(ticket.id,{validationResult:'Pruebas aprobadas; servicio verificado.'});
        }
        if (item.process==='INCIDENT' && to==='RESOLVED') {
          await status(`/desk/tickets/${ticket.id}/transition`,400,'POST',{to,reason:'Recuperación comprobada'},admin);
          await saveProcessData(ticket.id,{solution:'Servicio recuperado y causa mitigada.',actualMinutes:1350});
        }
        if (item.process==='EVENT' && to==='EVALUATED') await saveProcessData(ticket.id,{assessment:'Evento analizado; se determina impacto bajo.'});
        if (item.process==='PROBLEM' && to==='DEFINITIVE_SOLUTION') await saveProcessData(ticket.id,{definitiveSolution:'Corrección permanente aplicada.'});
        if (item.process==='ACCESS' && to==='VALIDATING') {
          await status(`/desk/tickets/${ticket.id}/transition`,400,'POST',{to},admin);
          await saveProcessData(ticket.id,{provisioningResult:'Permiso concedido al beneficiario.'});
        }
        if (item.process==='ACCESS' && to==='RESOLVED') {
          await status(`/desk/tickets/${ticket.id}/transition`,400,'POST',{to,reason:'Acceso validado'},admin);
          await saveProcessData(ticket.id,{validation:'Acceso probado con el beneficiario.'});
        }
        if (item.process==='TECH_SERVICE' && to==='ASSIGNED') {
          await status(`/desk/tickets/${ticket.id}/transition`,400,'POST',{to},admin);
          await saveProcessData(ticket.id,{validation:'Solicitud existente y datos completos.'});
        }
        if (item.process==='TECH_SERVICE' && to==='CONFIRMING') {
          await status(`/desk/tickets/${ticket.id}/transition`,400,'POST',{to},admin);
          await saveProcessData(ticket.id,{delivery:'Prestación entregada según lo solicitado.'});
        }
        if (item.process==='TECH_SERVICE' && to==='RESOLVED') await saveProcessData(ticket.id,{confirmation:'Solicitante confirma el servicio recibido.'});
        const session = to==='APPROVED' ? approver : admin;
        await status(`/desk/tickets/${ticket.id}/transition`,201,'POST',{to,reason:`Control ${to}`},session);
        if (item.process==='NEW_SERVICE' && to==='APPROVED' && item.data.proposedCode) {
          const createdService = await pool.query(`SELECT id,status FROM service_level_2 WHERE code=$1`,[item.data.proposedCode]);
          eq(createdService.rows.length,1,'un servicio propuesto se crea una sola vez al aprobar');
          eq(createdService.rows[0].status,'REVIEW','servicio propuesto queda pendiente de completar');
          const linkedTicket = await pool.query(`SELECT process_data->>'approvedServiceId' AS service_id FROM tickets WHERE id=$1`,[ticket.id]);
          eq(Number(linkedTicket.rows[0]?.service_id),Number(createdService.rows[0].id),'ticket conserva el servicio aprobado');
          await status(`/desk/tickets/${ticket.id}/process-data`,400,'PATCH',{approvedServiceId:serviceId},admin);
          await status(`/desk/tickets/${ticket.id}/process-data`,409,'PATCH',{proposedName:'Cambio posterior a aprobación'},admin);
          await status('/desk/tickets',409,'POST',{
            title:'Propuesta duplicada',description:'No debe duplicar un código aprobado',serviceId,
            queueId:queueId('NEW_SERVICE'),noCiReason:'No aplica',
            processData:{need:'Otra solicitud',feasibility:'Viable',proposedCode:item.data.proposedCode,proposedName:'Duplicado'},
          },admin);
        }
        if (item.process==='CHANGE' && to==='APPROVED') {
          await status(`/desk/tickets/${ticket.id}/process-data`,409,'PATCH',{riskAssessment:'Riesgo modificado después de aprobar'},admin);
          await status(`/desk/tickets/${ticket.id}/ci`,409,'POST',{ciId:ci2},admin);
        }
        if (item.process==='ACCESS' && to==='APPROVED') {
          await status(`/desk/tickets/${ticket.id}/process-data`,409,'PATCH',{accessAction:'REVOKE'},admin);
        }
      }
      const closed = await status(`/desk/tickets/${ticket.id}`,200,'GET',undefined,admin);
      eq(closed.state,'CLOSED',`ruta ${item.process}`);
      if (item.process==='NEW_SERVICE' && item.data.proposedCode) {
        // La suite usa una base aislada: quita solo el servicio sintético que acaba de crear
        // para que P18 pueda seguir comprobando los 46 servicios originales importados.
        await pool.query('DELETE FROM service_level_2 WHERE code=$1',[item.data.proposedCode]);
      }
      resolvedByProcess[item.process]=ticket.id;
    }
    done('P09',Object.keys(resolvedByProcess));

    const rawChange = await create('CHANGE',{riskAssessment:'Riesgo',testPlan:'Prueba',rollbackPlan:'Reversión'},{ciIds:[ci1]});
    await status(`/desk/tickets/${rawChange.id}/transition`,400,'POST',{to:'EXECUTING'},admin);
    await pool.query("UPDATE tickets SET state='PLANNED' WHERE id=$1",[rawChange.id]);
    await status(`/desk/tickets/${rawChange.id}/transition`,409,'POST',{to:'EXECUTING'},admin);
    const selfAccess = await create('ACCESS',{resource:'Sistema',permission:'Lectura',accessAction:'GRANT'},{beneficiaryId:requester.id});
    await status(`/desk/tickets/${selfAccess.id}/transition`,201,'POST',{to:'PENDING_APPROVAL'},admin);
    await status(`/desk/tickets/${selfAccess.id}/transition`,403,'POST',{to:'APPROVED'},admin);
    done('P10');

    for (const category of ['E0','E1','E2','E3']) {
      const event = await create('EVENT',{eventCategory:category});
      if (category==='E0') {
        await status(`/desk/tickets/${event.id}/process-data`,400,'PATCH',{assessment:'No corresponde'},agent1);
        await status(`/desk/tickets/${event.id}/process-data`,409,'PATCH',{eventCategory:'E1'},agent1);
        await status(`/desk/tickets/${event.id}/transition`,400,'POST',{to:'CLASSIFIED'},agent1);
        await status(`/desk/tickets/${event.id}/transition`,201,'POST',{to:'CLOSED'},agent1);
        const recorded = await status(`/desk/tickets/${event.id}`,200,'GET',undefined,admin);
        eq(recorded.state,'CLOSED','E0 se registra y cierra sin evaluación operativa');
      } else {
        await status(`/desk/tickets/${event.id}/process-data`,409,'PATCH',{eventCategory:'E0'},agent1);
        await status(`/desk/tickets/${event.id}/transition`,201,'POST',{to:'CLASSIFIED'},agent1);
        await status(`/desk/tickets/${event.id}/transition`,400,'POST',{to:'EVALUATED'},agent1);
        await saveProcessData(event.id,{assessment:'Evaluación del evento'});
        await status(`/desk/tickets/${event.id}/transition`,201,'POST',{to:'EVALUATED'},agent1);
      }
      const links = await pool.query(`SELECT COUNT(*)::int AS total FROM ticket_links
        WHERE ticket_id=$1 AND link_type='GENERATED_INCIDENT'`,[event.id]);
      eq(links.rows[0].total,['E2','E3'].includes(category)?1:0,`evento ${category}`);
      if (category!=='E0') await status(`/desk/tickets/${event.id}/transition`,400,'POST',{to:'EVALUATED'},agent1);
      if (category==='E1') {
        await status(`/desk/tickets/${event.id}/process-data`,400,'PATCH',{response:'No corresponde'},agent1);
        await status(`/desk/tickets/${event.id}/transition`,400,'POST',{to:'RESPONDED'},agent1);
        await status(`/desk/tickets/${event.id}/transition`,201,'POST',{to:'CLOSED'},agent1);
      }
      if (['E2','E3'].includes(category)) {
        await status(`/desk/tickets/${event.id}/transition`,400,'POST',{to:'CLOSED'},agent1);
        await status(`/desk/tickets/${event.id}/transition`,400,'POST',{to:'RESPONDED'},agent1);
        await saveProcessData(event.id,{response:'Equipo técnico atendió la alerta y documentó las acciones.'});
        await status(`/desk/tickets/${event.id}/transition`,201,'POST',{to:'RESPONDED'},agent1);
        const notifications = await status('/desk/notifications',200,'GET',undefined,admin) as Array<Record<string,any>>;
        truth(notifications.some((n) => n.ticketId===event.id && String(n.message).includes(event.number)),`notificación verificable ${category}`);
        const notificationCount = await pool.query(`SELECT COUNT(*)::int AS count FROM ticket_notifications WHERE ticket_id=$1`,[event.id]);
        eq(notificationCount.rows[0].count,1,`una sola notificación para ${category}`);
        const linkedIncident = await pool.query(`SELECT COUNT(*)::int AS count FROM ticket_links
          WHERE ticket_id=$1 AND link_type='GENERATED_INCIDENT'`,[event.id]);
        eq(linkedIncident.rows[0].count,1,`un solo incidente generado para ${category}`);
      }
      if (category==='E0') continue;
    }
    done('P11');

    const categoriesIncident = await pool.query(`SELECT process_data->>'incidentCategory' AS category FROM tickets
      WHERE number LIKE 'DEMO-INC-%' ORDER BY number`);
    eq([...new Set(categoriesIncident.rows.map((row) => row.category))].sort().join(','),
      'I0,I1,I2,I3,I4,I5,I6','I0-I6 en muestra');
    const seededI6 = await pool.query(`SELECT process_data->>'securityImpact' AS security_impact,
      process_data->>'solution' AS solution,state FROM tickets WHERE number='DEMO-INC-07'`);
    truth(seededI6.rows[0]?.security_impact==='true' && seededI6.rows[0]?.solution && seededI6.rows[0]?.state==='CLOSED',
      'el I6 de demostración conserva impacto de seguridad y solución antes del cierre');
    const gap = await status('/desk/incident-classification',201,'POST',{securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:10081},admin);
    eq(gap.category,'I4','decisión complementaria para el hueco temporal');
    eq(gap.rule,'PROJECT_GAP_RULE_7_TO_30_DAYS','regla del vacío temporal');
    for (const [minutes,expected] of [[180,'I1'],[181,'I2'],[480,'I2'],[481,'I3'],[2880,'I3'],[2881,'I4'],[10080,'I4']] as Array<[number,string]>) {
      const suggestion = await status('/desk/incident-classification',201,'POST',
        {securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:minutes},admin);
      eq(suggestion.category,expected,`intervalo de proyecto ${minutes} min`);
      eq(suggestion.rule,'PROJECT_SHORTEST_MATCH',`regla explícita de solapamiento ${minutes} min`);
    }
    const zeroDuration = await status('/desk/incident-classification',201,'POST',
      {securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:0},admin);
    eq(zeroDuration.category,null,'duración cero requiere revisión manual');
    eq(zeroDuration.rule,'MANUAL_REVIEW','duración cero no se atribuye a la lección');
    for (const [minutes,expected,rule] of [[43199,'I4','PROJECT_GAP_RULE_7_TO_30_DAYS'],
      [43200,'I5','PROJECT_30_DAY_MONTH_THRESHOLD']] as Array<[number,string,string]>) {
      const suggestion = await status('/desk/incident-classification',201,'POST',
        {securityImpact:false,interruptsOrDegrades:true,estimatedMinutes:minutes},admin);
      eq(suggestion.category,expected,`umbral mensual ${minutes} min`);eq(suggestion.rule,rule,`regla mensual ${minutes} min`);
    }
    const securityCategory = await status('/desk/incident-classification',201,'POST',
      {securityImpact:true,interruptsOrDegrades:false,estimatedMinutes:null},admin);
    eq(securityCategory.category,'I6','seguridad prevalece sobre duración');
    const noInterruption = await status('/desk/incident-classification',201,'POST',
      {securityImpact:false,interruptsOrDegrades:false,estimatedMinutes:null},admin);
    eq(noInterruption.category,'I0','incidente sin interrupción');
    const incidentSamples = await pool.query(`SELECT process_data->>'incidentCategory' AS category,
      process_data->>'redundancyAvailable' AS redundancy,priority FROM tickets
      WHERE number LIKE 'DEMO-INC-%' ORDER BY process_data->>'incidentCategory'`);
    eq(incidentSamples.rows.length,7,'siete casos de demostración I0-I6');
    truth(incidentSamples.rows.every((row)=>Number.isInteger(row.priority) && row.priority>=1 && row.priority<=5),
      'prioridad operativa 1-5 registrada aparte de la equivalencia visual');
    truth(incidentSamples.rows.every((row)=>['true','false'].includes(row.redundancy)),
      'redundancia registrada como hecho explícito en los casos de demostración');
    eq(incidentSamples.rows.find((row)=>row.category==='I0')?.redundancy,'true','I0 de muestra refleja redundancia de la referencia');
    truth(incidentSamples.rows.filter((row)=>row.category!=='I0').every((row)=>row.redundancy==='false'),
      'I1-I6 de muestra reflejan la referencia sin automatizar la prioridad');
    eq(Object.keys(incidentLessonReference).sort().join(','),'I0,I1,I2,I3,I4,I5,I6','mapeo docente de prioridad y redundancia');
    done('P12',{durationRules:['180/181','480/481','2880/2881','10080/10081','43199/43200'],
      zeroDuration:'MANUAL_REVIEW',securityCategory:securityCategory.category,
      operationalPriorities:incidentSamples.rows.map((row)=>({category:row.category,priority:row.priority,
        referencePriority:incidentLessonReference[row.category as keyof typeof incidentLessonReference].priorityGroup,
        redundancy:row.redundancy})),i6:seededI6.rows[0]});

    const problem = await create('PROBLEM',{rootCause:'Causa de prueba'});
    await status(`/desk/tickets/${problem.id}/links`,201,'POST',{relatedTicketId:incident.id,linkType:'RELATED'},admin);
    await status(`/desk/tickets/${problem.id}/links`,400,'POST',{relatedTicketId:incident.id,linkType:'IMPLEMENTS'},admin);
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
    const changedCi = await status(`/cmdb/items/${testCi1.id}`,200,'PATCH',{
      name:'CI origen editado',isDevice:false,acquiredOn:'2026-10-27',documentationUrl:'https://example.test/ci-doc',
    },admin);
    eq(changedCi.is_device,false,'edición de CI no dispositivo');
    truth(new Date(changedCi.acquired_on).toISOString().startsWith('2026-10-27'),'fecha de adquisición editable');
    eq(changedCi.documentation_url,'https://example.test/ci-doc','documentación relacionada editable');
    const clearedCi = await status(`/cmdb/items/${testCi1.id}`,200,'PATCH',{acquiredOn:null,documentationUrl:null},admin);
    eq(clearedCi.acquired_on,null,'fecha de adquisición opcional se puede limpiar');
    eq(clearedCi.documentation_url,null,'documentación opcional se puede limpiar');
    const ciDetail = await status(`/cmdb/items/${testCi1.id}`,200,'GET',undefined,admin);
    truth(Array.isArray(ciDetail.classificationPath) && ciDetail.classificationPath.length===2,'ruta jerárquica del CI');
    const linkedTicket = await create('INCIDENT',{incidentCategory:'I1'},{ciIds:[Number(testCi1.id)]});
    const linkedCiDetail = await status(`/cmdb/items/${testCi1.id}`,200,'GET',undefined,admin);
    truth(linkedCiDetail.tickets.some((ticket:Record<string,unknown>) => Number(ticket.id)===Number(linkedTicket.id)),
      'historial de tickets consultable desde el CI');
    const requesterCiDetail = await status(`/cmdb/items/${testCi1.id}`,200,'GET',undefined,requester);
    truth(!requesterCiDetail.tickets.some((ticket:Record<string,unknown>) => Number(ticket.id)===Number(linkedTicket.id)),
      'ficha del CI no revela tickets de colas no autorizadas');
    await status('/cmdb/services',201,'POST',{ciId:testCi1.id,serviceId},admin);
    await status('/cmdb/relations',201,'POST',{fromCiId:testCi1.id,toCiId:testCi2.id,relationType:'DEPENDS_ON'},admin);
    await status('/cmdb/relations',409,'POST',{fromCiId:testCi2.id,toCiId:testCi1.id,relationType:'DEPENDS_ON'},admin);
    await status('/cmdb/relations',409,'POST',{fromCiId:testCi2.id,toCiId:testCi1.id,relationType:'HOSTED_ON'},admin);
    await status('/cmdb/relations',201,'POST',{fromCiId:testCi1.id,toCiId:testCi3.id,relationType:'PARENT_OF'},admin);
    await status('/cmdb/relations',409,'POST',{fromCiId:testCi2.id,toCiId:testCi3.id,relationType:'PARENT_OF'},admin);
    await status('/cmdb/relations',409,'POST',{fromCiId:testCi3.id,toCiId:testCi1.id,relationType:'PARENT_OF'},admin);
    await status('/cmdb/relations',201,'POST',{fromCiId:testCi1.id,toCiId:testCi2.id,relationType:'CONNECTED_TO'},admin);
    await status('/cmdb/relations',201,'POST',{fromCiId:testCi2.id,toCiId:testCi1.id,relationType:'CONNECTED_TO'},admin);
    await status('/cmdb/relations',201,'POST',{fromCiId:testCi3.id,toCiId:testCi1.id,relationType:'DEPENDS_ON'},admin);
    const parents = await pool.query(`SELECT COUNT(*)::int AS total FROM ci_relations
      WHERE to_ci_id=$1 AND relation_type='PARENT_OF'`,[testCi3.id]);
    eq(parents.rows[0].total,1,'componente con padre único');
    const impact = await status(`/cmdb/items/${testCi2.id}/impact`,200,'GET',undefined,admin);
    truth(impact.potentiallyAffected.some((item:Record<string,any>) => Number(item.id)===Number(testCi1.id)),'recorrido de dependencia');
    truth(impact.potentiallyAffected.some((item:Record<string,any>) => Number(item.id)===Number(testCi3.id)),'recorrido transitivo de dependencias');
    truth(impact.potentiallyAffected.some((item:Record<string,any>) => Number(item.service_id)===serviceId),'servicio potencialmente afectado');
    done('P14');

    const unfinished = await create('INCIDENT',{incidentCategory:'I4'});
    await status(`/desk/tickets/${unfinished.id}/transition`,400,'POST',{to:'CLOSED'},admin);
    await status(`/desk/tickets/${unfinished.id}/pause`,201,'POST',{reason:'Espera controlada'},admin);
    await status(`/desk/tickets/${unfinished.id}/resume`,201,'POST',{reason:'Atención reanudada'},admin);
    for (const to of ['CLASSIFIED','DIAGNOSING','IN_PROGRESS','RESOLVED','CLOSED']) {
      if (to==='RESOLVED') {
        await status(`/desk/tickets/${unfinished.id}/transition`,400,'POST',{to,reason:'Solución de prueba'},admin);
        await saveProcessData(unfinished.id,{solution:'Servicio restablecido.',actualMinutes:4800});
      }
      await status(`/desk/tickets/${unfinished.id}/transition`,201,'POST',{to,reason:'Solución de prueba'},admin);
    }
    await status(`/desk/tickets/${unfinished.id}/transition`,201,'POST',{to:'SUBMITTED',reason:'Se repitió el problema'},admin);
    const reopened = await status(`/desk/tickets/${unfinished.id}`,200,'GET',undefined,admin);
    eq(reopened.reopen_count,1,'reapertura');truth(reopened.history.some((item:Record<string,unknown>) => item.action==='TRANSITION'),'actor en historial');
    const pause = reopened.history.find((item:Record<string,unknown>) => item.action==='PAUSE');
    const resume = reopened.history.find((item:Record<string,unknown>) => item.action==='RESUME');
    truth(pause?.old_values && pause?.new_values?.pausedAt && pause?.actor_name,
      'pausa con actor y valores anteriores/nuevos');
    truth(resume?.old_values?.pausedAt && resume?.new_values && resume.new_values.pausedAt===null,
      'reanudación con valores anteriores/nuevos');
    done('P15');

    const started = performance.now();
    const page1 = await status('/cmdb/items?page=1&pageSize=25',200,'GET',undefined,admin);
    const observedMs = Math.round((performance.now()-started)*10)/10;
    const page2 = await status('/cmdb/items?page=2&pageSize=25',200,'GET',undefined,admin);
    truth(page1.total>=5000,'paginación sobre 5000');eq(page1.data.length,25,'25 por página');
    truth(page1.data[0].id!==page2.data[0].id,'páginas diferentes');
    const hardwareRoot = await pool.query('SELECT id FROM ci_categories WHERE code=$1',['HARDWARE']);
    const hardwarePage = await status(`/cmdb/items?page=1&pageSize=25&categoryId=${hardwareRoot.rows[0].id}&isDevice=true&status=ACTIVE`,200,'GET',undefined,admin);
    truth(hardwarePage.total>=5000,'filtro de categoría raíz incluye sus subcategorías');
    const searched = await status('/cmdb/items?search=SYN-EVAL2026-000001&isDevice=true',200,'GET',undefined,admin);
    eq(searched.total,1,'búsqueda por código en el conjunto de dispositivos');
    const locationId = Number(hardwarePage.data[0].locationId);
    const locationPage = await status(`/cmdb/items?locationId=${locationId}&isDevice=true`,200,'GET',undefined,admin);
    truth(locationPage.total>0,'filtro por ubicación paginable');
    done('P16',{observedMs,filteredCategoryTotal:hardwarePage.total,searchTotal:searched.total,
      locationTotal:locationPage.total,environment:'Docker Compose, API interna, PostgreSQL 16-alpine'});

    const metricTicket = await create('INCIDENT',{incidentCategory:'I2'});
    await pool.query(`UPDATE tickets SET created_at=NOW()-INTERVAL '2 hours',
      first_attended_at=NOW()-INTERVAL '90 minutes',
      resolved_at=NOW()-INTERVAL '30 minutes',
      paused_seconds=600,state='RESOLVED' WHERE id=$1`,[metricTicket.id]);
    const metrics = await status(`/desk/metrics?ticketId=${metricTicket.id}`,200,'GET',undefined,admin);
    eq(metrics.total,1,'métrica controlada');
    truth(Math.abs(metrics.averageFirstResponseMinutes-30)<0.2,'primera atención de 30 min');
    truth(Math.abs(metrics.averageResolutionMinutes-80)<0.2,'resolución de 90 min calendario menos 10 min pausados');
    truth(Math.abs(metrics.averageOpenAgeMinutes-120)<0.2,'antigüedad abierta incluye 120 min calendario aunque esté resuelto sin cerrar');
    eq(metrics.firstResponseObjective.met,1,'primera respuesta dentro del objetivo');
    eq(metrics.firstResponseObjective.evaluated,1,'primera respuesta evaluable');
    eq(metrics.resolutionObjective.met,1,'resolución dentro del objetivo');
    eq(metrics.resolutionObjective.evaluated,1,'resolución evaluable');
    const openMetrics = await status(`/desk/metrics?ticketId=${rawChange.id}`,200,'GET',undefined,admin);
    eq(openMetrics.averageResolutionMinutes,null,'abierto sin resolución no promedia');
    done('P17',{firstResponseMinutes:metrics.averageFirstResponseMinutes,resolutionMinutes:metrics.averageResolutionMinutes,
      openAgeMinutes:metrics.averageOpenAgeMinutes,firstResponseObjective:metrics.firstResponseObjective,
      resolutionObjective:metrics.resolutionObjective});

    console.log(JSON.stringify({ok:true,checks:results.length,stamp}));
  } finally {await pool.end();}
}
main().catch((error) => {console.error(error);process.exitCode=1;});
