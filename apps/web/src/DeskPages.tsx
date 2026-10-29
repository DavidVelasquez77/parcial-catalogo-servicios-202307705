import { useEffect, useState, type FormEvent } from 'react';
import { api, patch, post } from './api';

type Account = { id: number; role: string; roles?: string[] };
type Page<T> = { data: T[]; total: number; page: number; pageSize: number };
type Queue = { id: number; code: string; name: string; description: string | null; process: string; active: boolean; canHandle: boolean; canTransfer: boolean; canAdmin: boolean; responsible_user_id: number; responsibleName: string; sort_rule: string; support_level: number; first_response_minutes: number | null; resolution_minutes: number | null };
type Ticket = { id: number; number: string; title: string; state: string; process: string; priority: number; queueId: number; queueName: string; createdAt: string; assignedUserId: number | null };
type TicketDetail = Record<string, unknown> & {
  id: number; number: string; title: string; description: string; state: string; type: string; process: string;
  queue_id: number; requester_id: number; requester_name: string | null; creator_id: number;
  creator_name: string | null; assigned_user_id: number | null; assigned_user_name: string | null;
  process_data: Record<string, unknown>; priority: number; impact: number; urgency: number; channel: string;
  service_code: string; service_name: string; level_1_code: string; level_1_name: string;
  no_ci_reason: string | null; paused_at: string | null; created_at: string; updated_at: string;
  first_attended_at: string | null; resolved_at: string | null; closed_at: string | null;
  history: Array<{ id: number; action: string; actor_id: number; actor_name: string | null; created_at: string; reason: string | null; old_values: unknown; new_values: unknown }>;
  comments: Array<{ id: number; body: string; visibility: string; author_id: number; created_at: string }>;
  ci: Array<{ id: number; code: string; name: string }>;
  links: Array<{ ticket_id: number; related_ticket_id: number; link_type: string }>;
  attachments: Array<{ id: number; originalName: string; sizeBytes: number }>;
};
type Ci = { id: number; code: string; name: string; categoryName: string; status: string; location: string; locationId?: number | null; responsibleLabel?: string | null; responsibleUserName?: string | null; isDevice?: boolean };
type Category = { id: number; code: string; name: string; parentId: number | null; sourceKind: string; active: boolean };
type CiLocation = { id: number; code: string; name: string; active: boolean };
type Service = { id: number; code: string; name: string; status: string };
const names: Record<string,string> = { NEW_SERVICE:'Nuevos servicios', CHANGE:'Cambios', INCIDENT:'Incidentes', EVENT:'Eventos', PROBLEM:'Problemas', ACCESS:'Accesos', TECH_SERVICE:'Servicios de tecnología', SERVICE_REQUEST:'Requisición de servicio', SUBMITTED:'Registrado', ANALYSIS:'Análisis', PENDING_APPROVAL:'Pendiente de aprobación', APPROVED:'Aprobado', REJECTED:'Rechazado', RESOLVED:'Resuelto', CLOSED:'Cerrado', CLASSIFIED:'Clasificado', EVALUATED:'Evaluado', RESPONDED:'Respuesta', DIAGNOSING:'Diagnóstico', IN_PROGRESS:'En atención', ESCALATED:'Escalado', ESCALATE:'Escalamiento', TRANSFER:'Transferencia', PAUSE:'Pausa', RESUME:'Reanudación', CLAIM:'Asignación', ASSIGN:'Asignación dirigida', TRANSITION:'Cambio de estado', INVESTIGATING:'Investigación', VALIDATING:'Validación', EXECUTING:'Ejecución', PLANNED:'Planificado', FULFILLING:'Cumplimiento', CONFIRMING:'Confirmación' };
const channelNames: Record<string,string> = { PORTAL:'Portal', PHONE:'Teléfono', EMAIL:'Correo electrónico', IN_PERSON:'Presencial', SYSTEM:'Sistema' };
const ratingNames: Record<number,string> = { 1:'Muy baja', 2:'Baja', 3:'Media', 4:'Alta', 5:'Muy alta' };
const sortRuleLabel = (rule: string) => rule === 'AGE_PRIORITY' ? 'Antigüedad y prioridad' : 'Prioridad y antigüedad';
const label = (value: string) => names[value] ?? value.replaceAll('_',' ').toLowerCase();
const transitions: Record<string,Record<string,string[]>> = {
  NEW_SERVICE: { SUBMITTED:['ANALYSIS'],ANALYSIS:['PENDING_APPROVAL'],PENDING_APPROVAL:['APPROVED','REJECTED'],APPROVED:['IMPLEMENTING'],IMPLEMENTING:['RESOLVED'],RESOLVED:['CLOSED'] },
  CHANGE: { SUBMITTED:['RISK_ASSESSMENT'],RISK_ASSESSMENT:['PENDING_APPROVAL'],PENDING_APPROVAL:['APPROVED','REJECTED'],APPROVED:['PLANNED'],PLANNED:['EXECUTING'],EXECUTING:['VALIDATING'],VALIDATING:['RESOLVED'],RESOLVED:['CLOSED'] },
  INCIDENT: { SUBMITTED:['CLASSIFIED'],CLASSIFIED:['DIAGNOSING'],DIAGNOSING:['IN_PROGRESS','ESCALATED'],IN_PROGRESS:['ESCALATED','RESOLVED'],ESCALATED:['IN_PROGRESS','RESOLVED'],RESOLVED:['CLOSED'] },
  EVENT: { SUBMITTED:['CLASSIFIED'],CLASSIFIED:['EVALUATED'],EVALUATED:['RESPONDED','CLOSED'],RESPONDED:['CLOSED'] },
  PROBLEM: { SUBMITTED:['INVESTIGATING'],INVESTIGATING:['WORKAROUND','KNOWN_ERROR','DEFINITIVE_SOLUTION'],WORKAROUND:['KNOWN_ERROR','DEFINITIVE_SOLUTION'],KNOWN_ERROR:['DEFINITIVE_SOLUTION'],DEFINITIVE_SOLUTION:['RESOLVED'],RESOLVED:['CLOSED'] },
  ACCESS: { SUBMITTED:['PENDING_APPROVAL'],PENDING_APPROVAL:['APPROVED','REJECTED'],APPROVED:['PROVISIONING'],PROVISIONING:['VALIDATING'],VALIDATING:['RESOLVED'],RESOLVED:['CLOSED'] },
  TECH_SERVICE: { SUBMITTED:['VALIDATING'],VALIDATING:['ASSIGNED'],ASSIGNED:['FULFILLING'],FULFILLING:['CONFIRMING'],CONFIRMING:['RESOLVED'],RESOLVED:['CLOSED'] },
};
const processFields: Record<string,Array<[string,string,'text'|'number'|'boolean'|'category'|'accessAction']>> = {
  NEW_SERVICE: [['need','Necesidad','text'],['feasibility','Viabilidad','text'],['proposedCode','Código propuesto','text'],['proposedName','Nombre propuesto','text'],['linkedServiceId','ID de servicio existente','number'],['implementationResult','Resultado de implementación','text']],
  CHANGE: [['riskAssessment','Impacto y riesgo','text'],['testPlan','Plan de pruebas','text'],['rollbackPlan','Plan de reversión','text'],['executionResult','Resultado de ejecución','text'],['validationResult','Resultado de validación','text']],
  INCIDENT: [['incidentCategory','Categoría I0–I6','category'],['estimatedMinutes','Duración estimada (min)','number'],['actualMinutes','Duración real (min)','number'],['redundancyAvailable','Redundancia disponible','boolean'],['solution','Solución aplicada','text']],
  EVENT: [['eventCategory','Categoría E0–E3','category'],['assessment','Evaluación','text'],['response','Respuesta aplicada','text']],
  PROBLEM: [['rootCause','Causa raíz','text'],['workaround','Solución temporal','text'],['knownError','Error conocido','text'],['definitiveSolution','Solución definitiva','text']],
  ACCESS: [['resource','Recurso','text'],['permission','Permiso','text'],['accessAction','Provisión o revocación','accessAction'],['provisioningResult','Resultado de provisión o revocación','text'],['validation','Validación','text']],
  TECH_SERVICE: [['request','Prestación solicitada','text'],['validation','Validación de la solicitud','text'],['delivery','Cumplimiento','text'],['confirmation','Confirmación del solicitante','text']],
};
const eventLabels: Record<string,string> = {
  E0:'Programado; requiere registro',
  E1:'No programado, sin impacto; requiere evaluación registrada',
  E2:'No programado, impacta el servicio; requiere incidente',
  E3:'No programado, impacto en seguridad con posible impacto al servicio; requiere incidente',
};
const incidentLabels: Record<string,string> = {
  I0:'No causa interrupción',I1:'3 horas o menos, incluidas degradaciones',
  I2:'8 horas o menos, incluidas degradaciones',I3:'2 días o menos',
  I4:'1 semana o menos',I5:'1 mes o más',I6:'Afecta la seguridad de los recursos y la información',
};
const date = (value: string) => new Date(value).toLocaleString('es-GT');
const dateOrPending = (value: string | null | undefined) => value ? date(value) : 'Pendiente';
const rating = (value: number) => `${value} · ${ratingNames[value] ?? 'Sin clasificar'}`;
const message = (error: unknown) => error instanceof Error ? error.message : 'No fue posible completar la operación.';
const canWrite = (user: Account) => !(user.roles ?? [user.role]).includes('CONSULTA');
const isAdmin = (user: Account) => (user.roles ?? [user.role]).includes('ADMIN');

function TicketCreate({ queues, user, onDone, onCancel }: { queues: Queue[]; user: Account; onDone: () => void; onCancel: () => void }) {
  const [services,setServices] = useState<Service[]>([]);
  const [users,setUsers] = useState<Array<{id:number;name:string}>>([]);
  const [queueId,setQueueId] = useState(String(queues.find((q) => q.active)?.id ?? ''));
  const [serviceId,setServiceId] = useState('');
  const [title,setTitle] = useState('');
  const [description,setDescription] = useState('');
  const [noCiReason,setNoCiReason] = useState('No aplica un dispositivo concreto a este trámite.');
  const [category,setCategory] = useState('');
  const [beneficiaryId,setBeneficiaryId] = useState('');
  const [resource,setResource] = useState('');
  const [permission,setPermission] = useState('');
  const [accessAction,setAccessAction] = useState('GRANT');
  const [priority,setPriority] = useState('3');
  const [impact,setImpact] = useState('3');
  const [urgency,setUrgency] = useState('3');
  const [channel,setChannel] = useState('PORTAL');
  const [requesterId,setRequesterId] = useState(String(user.id));
  const [extra,setExtra] = useState<Record<string,string>>({});
  const [ciSearch,setCiSearch] = useState('');
  const [ciOptions,setCiOptions] = useState<Ci[]>([]);
  const [ciIds,setCiIds] = useState<number[]>([]);
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  const process = queues.find((q) => String(q.id) === queueId)?.process ?? '';
  useEffect(() => {
    api<Page<Service>>('/services?pageSize=100').then((page) => setServices(page.data.filter((s) => s.status === 'ACTIVE'))).catch((e) => setError(message(e)));
    api<Array<{id:number;name:string;active:boolean}>>('/desk/users').then(setUsers).catch(() => undefined);
  }, []);
  useEffect(() => {if (ciSearch.trim().length<2) {setCiOptions([]);return;}
    api<Page<Ci>>(`/cmdb/items?search=${encodeURIComponent(ciSearch)}&pageSize=20`).then((page) => setCiOptions(page.data)).catch(() => setCiOptions([]));
  },[ciSearch]);
  const change = (key:string,value:string) => setExtra((current) => ({...current,[key]:value}));
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    const processData: Record<string,unknown> = {};
    if (process === 'EVENT') processData.eventCategory = category;
    if (process === 'INCIDENT') processData.incidentCategory = category;
    if (process === 'ACCESS') { processData.resource = resource; processData.permission = permission; processData.accessAction = accessAction; }
    if (process === 'NEW_SERVICE') Object.assign(processData,{need:extra.need,feasibility:extra.feasibility,
      ...(extra.linkedServiceId ? {linkedServiceId:Number(extra.linkedServiceId)} : {proposedCode:extra.proposedCode,proposedName:extra.proposedName})});
    if (process === 'CHANGE') Object.assign(processData,{riskAssessment:extra.riskAssessment,testPlan:extra.testPlan,rollbackPlan:extra.rollbackPlan});
    if (process === 'PROBLEM') Object.assign(processData,{rootCause:extra.rootCause ?? '',workaround:extra.workaround ?? ''});
    if (process === 'TECH_SERVICE') processData.request = extra.request ?? description;
    if (process === 'INCIDENT') Object.assign(processData,{estimatedMinutes:extra.estimatedMinutes?Number(extra.estimatedMinutes):null,
      redundancyAvailable:extra.redundancyAvailable==='yes'?true:extra.redundancyAvailable==='no'?false:null,
      interruptsOrDegrades:extra.interruptsOrDegrades==='yes'?true:extra.interruptsOrDegrades==='no'?false:null});
    try {
      await post('/desk/tickets',{ queueId:Number(queueId),serviceId:Number(serviceId),title,description,
        priority:Number(priority),impact:Number(impact),urgency:Number(urgency),channel,ciIds,noCiReason:ciIds.length?undefined:noCiReason,processData,
        ...(isAdmin(user) ? { requesterId:Number(requesterId) } : {}),
        ...(process === 'ACCESS' ? { beneficiaryId:Number(beneficiaryId) } : {}) });
      onDone();
    } catch (e) { setError(message(e)); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onClick={onCancel}><section className="modal-card" role="dialog" aria-modal="true" aria-label="Nuevo ticket" onClick={(e) => e.stopPropagation()}><div className="drawer-head"><h2>Nuevo ticket</h2><button className="icon-button" onClick={onCancel} aria-label="Cerrar">×</button></div><form className="stack-form" onSubmit={submit}>
    <label>Cola y proceso<select value={queueId} onChange={(e) => {setQueueId(e.target.value);setCategory('');}} required>{queues.filter((q) => q.active).map((q) => <option key={q.id} value={q.id}>{q.name} · {label(q.process)}</option>)}</select></label>
    <label>Servicio existente<select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required><option value="">Selecciona un servicio</option>{services.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></label>
    <label>Título<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={240} required /></label>
    <label>Descripción<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required /></label>
    {isAdmin(user) && <label>Solicitante<select value={requesterId} onChange={(e) => setRequesterId(e.target.value)} required>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
    <p className="muted">Creador: cuenta con la que iniciaste sesión.</p>
    <label>Prioridad<select value={priority} onChange={(e) => setPriority(e.target.value)}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{rating(n)}</option>)}</select></label>
    <label>Impacto<select value={impact} onChange={(e) => setImpact(e.target.value)}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{rating(n)}</option>)}</select></label>
    <label>Urgencia<select value={urgency} onChange={(e) => setUrgency(e.target.value)}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{rating(n)}</option>)}</select></label>
    <label>Canal<select value={channel} onChange={(e) => setChannel(e.target.value)}><option value="PORTAL">Portal</option><option value="PHONE">Teléfono</option><option value="EMAIL">Correo electrónico</option><option value="IN_PERSON">Presencial</option><option value="SYSTEM">Sistema</option></select></label>
    {(process === 'EVENT' || process === 'INCIDENT') && <label>Categoría<select value={category} onChange={(e) => setCategory(e.target.value)} required><option value="">Selecciona</option>{(process === 'EVENT' ? ['E0','E1','E2','E3'] : ['I0','I1','I2','I3','I4','I5','I6']).map((x) => <option key={x} value={x}>{x} · {(process === 'EVENT' ? eventLabels : incidentLabels)[x]}</option>)}</select></label>}
    {process === 'EVENT' && category === 'E0' && <p className="muted">E0 queda registrado al crear el ticket y puede cerrarse sin clasificación, evaluación ni respuesta operativa.</p>}
    {process === 'EVENT' && category === 'E1' && <p className="muted">E1 requiere guardar una evaluación; no requiere respuesta operativa.</p>}
    {process === 'INCIDENT' && <><label>Duración estimada (minutos)<input type="number" min={['I1','I2','I3','I4','I5'].includes(category)?1:0} required={['I1','I2','I3','I4','I5'].includes(category)} value={extra.estimatedMinutes ?? ''} onChange={(e) => change('estimatedMinutes',e.target.value)} /></label><label>¿Interrupción o degradación?<select value={extra.interruptsOrDegrades ?? ''} onChange={(e) => change('interruptsOrDegrades',e.target.value)} required><option value="">Selecciona</option><option value="yes">Sí</option><option value="no">No</option></select></label><label>¿Redundancia disponible?<select value={extra.redundancyAvailable ?? ''} onChange={(e) => change('redundancyAvailable',e.target.value)}><option value="">No informada</option><option value="yes">Sí</option><option value="no">No</option></select></label></>}
    {process === 'NEW_SERVICE' && <><label>Necesidad<input value={extra.need ?? ''} onChange={(e) => change('need',e.target.value)} required /></label><label>Viabilidad preliminar<input value={extra.feasibility ?? ''} onChange={(e) => change('feasibility',e.target.value)} required /></label><label>Vincular servicio existente<select value={extra.linkedServiceId ?? ''} onChange={(e) => change('linkedServiceId',e.target.value)}><option value="">Crear servicio nuevo tras aprobación</option>{services.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></label>{!extra.linkedServiceId && <><label>Código propuesto<input value={extra.proposedCode ?? ''} onChange={(e) => change('proposedCode',e.target.value)} required /></label><label>Nombre propuesto<input value={extra.proposedName ?? ''} onChange={(e) => change('proposedName',e.target.value)} required /></label></>}</>}
    {process === 'CHANGE' && <><label>Impacto y riesgo<textarea value={extra.riskAssessment ?? ''} onChange={(e) => change('riskAssessment',e.target.value)} required /></label><label>Plan de pruebas<textarea value={extra.testPlan ?? ''} onChange={(e) => change('testPlan',e.target.value)} required /></label><label>Plan de reversión<textarea value={extra.rollbackPlan ?? ''} onChange={(e) => change('rollbackPlan',e.target.value)} required /></label></>}
    {process === 'PROBLEM' && <><label>Causa raíz preliminar<input value={extra.rootCause ?? ''} onChange={(e) => change('rootCause',e.target.value)} /></label><label>Solución temporal<input value={extra.workaround ?? ''} onChange={(e) => change('workaround',e.target.value)} /></label></>}
    {process === 'TECH_SERVICE' && <label>Prestación solicitada<input value={extra.request ?? ''} onChange={(e) => change('request',e.target.value)} required /></label>}
    {process === 'ACCESS' && <><label>Beneficiario<select value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)} required><option value="">Selecciona</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Recurso<input value={resource} onChange={(e) => setResource(e.target.value)} required /></label><label>Permiso solicitado<input value={permission} onChange={(e) => setPermission(e.target.value)} required /></label><label>Operación<select value={accessAction} onChange={(e) => setAccessAction(e.target.value)}><option value="GRANT">Conceder acceso</option><option value="REVOKE">Revocar acceso</option></select></label></>}
    <label>Buscar CI relacionado<input value={ciSearch} onChange={(e) => setCiSearch(e.target.value)} placeholder="Escribe al menos dos letras o parte del código" /></label>{ciOptions.length>0 && <div className="desk-search-options">{ciOptions.map((ci) => <button type="button" className="secondary" key={ci.id} onClick={() => {if(!ciIds.includes(Number(ci.id)))setCiIds([...ciIds,Number(ci.id)]);setCiSearch('');}}>{ci.code} · {ci.name}</button>)}</div>}
    {ciIds.length>0 && <p className="muted">{ciIds.length} CI seleccionado(s). <button type="button" className="text-button" onClick={() => setCiIds([])}>Quitar todos</button></p>}
    {ciIds.length===0 && <label>Motivo por el que no se asocia CI<input value={noCiReason} onChange={(e) => setNoCiReason(e.target.value)} required={process!=='CHANGE'} /></label>}
    {process==='CHANGE' && ciIds.length===0 && <p className="alert error">Un cambio necesita al menos un CI afectado.</p>}
    {error && <div className="alert error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving || (process==='CHANGE' && ciIds.length===0)}>{saving?'Guardando...':'Crear ticket'}</button></div>
  </form></section></div>;
}

function TicketView({ id, user, queues, users, onClose, onChanged }: { id: number; user: Account; queues: Queue[]; users: Array<{id:number;name:string}>; onClose: () => void; onChanged: () => void }) {
  const [ticket,setTicket] = useState<TicketDetail | null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [reason,setReason] = useState('');
  const [comment,setComment] = useState('');
  const [visibility,setVisibility] = useState('PUBLIC');
  const [processValues,setProcessValues] = useState<Record<string,unknown>>({});
  const [destination,setDestination] = useState('');
  const [escalationQueueId,setEscalationQueueId] = useState('');
  const [assigneeId,setAssigneeId] = useState('');
  const [assignees,setAssignees] = useState<Array<{id:number;name:string}>>([]);
  const [file,setFile] = useState<File | null>(null);
  const [ciSearch,setCiSearch] = useState('');
  const [ciOptions,setCiOptions] = useState<Ci[]>([]);
  const [relatedId,setRelatedId] = useState('');
  const [linkType,setLinkType] = useState('RELATED');
  async function load() { try { const row = await api<TicketDetail>(`/desk/tickets/${id}`); setTicket(row); setProcessValues(row.process_data); } catch (e) { setError(message(e)); } }
  useEffect(() => { void load(); }, [id]);
  useEffect(() => {
    if (!ticket || (!isAdmin(user) && !queues.find((q) => q.id === ticket.queue_id)?.canAdmin)) { setAssignees([]); return; }
    api<Array<{id:number;name:string}>>(`/desk/queues/${ticket.queue_id}/assignees`)
      .then(setAssignees).catch((e) => setError(message(e)));
  },[ticket?.queue_id,queues,user.role]);
  useEffect(() => {if (ciSearch.trim().length<2) {setCiOptions([]);return;}
    api<Page<Ci>>(`/cmdb/items?search=${encodeURIComponent(ciSearch)}&pageSize=20`).then((page) => setCiOptions(page.data)).catch(() => setCiOptions([]));
  },[ciSearch]);
  async function action(path: string, body: unknown) { setBusy(true);setError('');try { await post(`/desk/tickets/${id}/${path}`,body);setReason('');setComment('');setFile(null);await load();onChanged(); } catch(e) {setError(message(e));} finally {setBusy(false);} }
  async function upload() {
    if (!file) return;
    setBusy(true);setError('');
    const data = new FormData(); data.append('file',file);
    try { const response = await fetch(`/api/desk/tickets/${id}/attachments`,{method:'POST',body:data,credentials:'include'});const payload = await response.json();if (!response.ok) throw new Error(payload.message);setFile(null);await load(); } catch(e) {setError(message(e));} finally {setBusy(false);}
  }
  const options = ticket ? (() => {
    const allowed = [...(transitions[ticket.process]?.[ticket.state] ?? []).filter((to) => to !== 'ESCALATED'),...(ticket.state === 'CLOSED' ? ['SUBMITTED'] : [])];
    if (ticket.process === 'EVENT' && ticket.process_data?.eventCategory === 'E0' && ticket.state === 'SUBMITTED') return ['CLOSED'];
    return allowed;
  })() : [];
  const staff = ticket && (isAdmin(user) || queues.find((q) => q.id === ticket.queue_id)?.canHandle);
  const sourceQueue = queues.find((q) => q.id === ticket?.queue_id);
  const mayTransfer = ticket && canWrite(user) && (isAdmin(user) || sourceQueue?.canTransfer);
  const mayAssign = ticket && canWrite(user) && (isAdmin(user) || sourceQueue?.canAdmin);
  const escalationTargets = ticket && sourceQueue ? queues.filter((q) => q.active && q.process === ticket.process && q.support_level > sourceQueue.support_level) : [];
  const visibleProcessFields = ticket ? (processFields[ticket.process] ?? []).filter(([key]) => {
    if (ticket.process !== 'EVENT') return true;
    if (ticket.process_data?.eventCategory === 'E0') return false;
    if (key === 'eventCategory') return false;
    if (ticket.process_data?.eventCategory === 'E1') return key !== 'response';
    return true;
  }) : [];
  return <div className="modal-backdrop" onClick={onClose}><section className="modal-card desk-detail" role="dialog" aria-modal="true" aria-label="Ficha de ticket" onClick={(e) => e.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Ficha de ticket</p><h2>{ticket?.number ?? 'Cargando...'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar">×</button></div>
    {error && <div className="alert error">{error}</div>}
    {ticket && <><h3>{ticket.title}</h3><p className="muted">{ticket.description}</p><div className="desk-facts">
      <span><strong>Tipo de ticket</strong>{label(ticket.type)}</span><span><strong>Proceso</strong>{label(ticket.process)}</span>
      <span><strong>Estado</strong>{label(ticket.state)}</span><span><strong>Solicitante</strong>{ticket.requester_name ?? `Usuario #${ticket.requester_id}`}</span>
      <span><strong>Creador</strong>{ticket.creator_name ?? `Usuario #${ticket.creator_id}`}</span><span><strong>Servicio de nivel 2</strong>{ticket.service_code} · {ticket.service_name}</span>
      <span><strong>Servicio de nivel 1</strong>{ticket.level_1_code} · {ticket.level_1_name}</span><span><strong>Cola</strong>{String(ticket.queue_name)}</span>
      <span><strong>Responsable</strong>{ticket.assigned_user_name ?? (ticket.assigned_user_id === null ? 'Sin asignar' : users.find((person) => person.id===ticket.assigned_user_id)?.name ?? `Usuario #${ticket.assigned_user_id}`)}</span>
      <span><strong>Prioridad</strong>{rating(ticket.priority)}</span><span><strong>Impacto</strong>{rating(ticket.impact)}</span>
      <span><strong>Urgencia</strong>{rating(ticket.urgency)}</span><span><strong>Canal</strong>{channelNames[ticket.channel] ?? label(ticket.channel)}</span>
      <span><strong>CI asociados</strong>{ticket.ci.length ? ticket.ci.map((ci) => ci.code).join(', ') : ticket.no_ci_reason ?? 'Sin CI'}</span>
    </div>
      <section className="desk-section"><h3>Fechas del ticket</h3><div className="desk-facts">
        <span><strong>Creación</strong>{dateOrPending(ticket.created_at)}</span><span><strong>Última actualización</strong>{dateOrPending(ticket.updated_at)}</span>
        <span><strong>Primera atención</strong>{dateOrPending(ticket.first_attended_at)}</span><span><strong>Resolución</strong>{dateOrPending(ticket.resolved_at)}</span>
        <span><strong>Cierre</strong>{dateOrPending(ticket.closed_at)}</span>
      </div></section>
      <section className="desk-section"><h3>Acciones</h3><label>Motivo o solución<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Obligatorio al resolver, rechazar o reabrir" /></label><div className="button-row desk-actions">{staff && !ticket.assigned_user_id && canWrite(user) && <button className="secondary" disabled={busy} onClick={() => void action('claim',{})}>Tomar ticket</button>}{options.filter((to) => to !== 'APPROVED' && to !== 'REJECTED' || isAdmin(user) || (user.roles ?? [user.role]).includes('APROBADOR')).map((to) => <button key={to} className={to==='CLOSED'?'primary':'secondary'} disabled={busy || !canWrite(user)} onClick={() => void action('transition',{to,reason})}>{label(to)}</button>)}{staff && !ticket.paused_at && <button className="secondary" disabled={busy} onClick={() => void action('pause',{reason})}>Pausar</button>}{staff && !!ticket.paused_at && <button className="secondary" disabled={busy} onClick={() => void action('resume',{reason})}>Reanudar</button>}</div></section>
      {mayAssign && !['CLOSED','REJECTED'].includes(ticket.state) && <section className="desk-section"><h3>Asignar agente</h3><p className="muted">Solo aparecen agentes activos con permiso para atender esta cola.</p><div className="button-row"><select aria-label="Agente autorizado" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">Selecciona agente</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><button className="secondary" disabled={busy || !assigneeId} onClick={() => void action('assign',{userId:Number(assigneeId),reason:reason.trim() || undefined})}>Asignar</button></div></section>}
      {staff && <section className="desk-section"><h3>Datos de {label(ticket.process)}</h3><p className="muted">Completa las evidencias necesarias antes de avanzar el proceso.</p>{ticket.process==='EVENT' && <p className="muted"><strong>{String(ticket.process_data?.eventCategory)}:</strong> {eventLabels[String(ticket.process_data?.eventCategory)] ?? 'Categoría no disponible'}.</p>}<div className="form-grid">{visibleProcessFields.map(([key,title,kind]) => <label key={key}>{title}{kind==='boolean'?<select value={processValues[key]===true?'true':processValues[key]===false?'false':''} onChange={(e) => setProcessValues({...processValues,[key]:e.target.value===''?null:e.target.value==='true'})}><option value="">No informado</option><option value="true">Sí</option><option value="false">No</option></select>:kind==='category'?<select value={String(processValues[key] ?? '')} onChange={(e) => setProcessValues({...processValues,[key]:e.target.value})}>{(ticket.process==='EVENT'?['E0','E1','E2','E3']:['I0','I1','I2','I3','I4','I5','I6']).map((item) => <option key={item} value={item}>{item} · {(ticket.process==='EVENT'?eventLabels:incidentLabels)[item]}</option>)}</select>:<input type={kind==='number'?'number':'text'} value={String(processValues[key] ?? '')} onChange={(e) => setProcessValues({...processValues,[key]:kind==='number'?(e.target.value===''?null:Number(e.target.value)):e.target.value})} />}</label>)}</div>{ticket.process !== 'EVENT' || ticket.process_data?.eventCategory !== 'E0' ? <div className="button-row desk-actions"><button className="secondary" disabled={busy} onClick={async () => {try {setBusy(true);await patch(`/desk/tickets/${id}/process-data`,processValues);await load();}catch(e){setError(message(e));}finally{setBusy(false);}}}>Guardar datos</button></div> : null}</section>}
      {mayTransfer && <section className="desk-section"><h3>Transferir</h3><div className="button-row"><select value={destination} onChange={(e) => setDestination(e.target.value)}><option value="">Cola destino</option>{queues.filter((q) => q.process===ticket.process && q.id!==ticket.queue_id && q.active).map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select><button className="secondary" disabled={busy || !destination} onClick={() => void action('transfer',{queueId:Number(destination),reason})}>Transferir</button></div></section>}
      {mayTransfer && ticket.process==='INCIDENT' && ['DIAGNOSING','IN_PROGRESS','ESCALATED'].includes(ticket.state) && <section className="desk-section"><h3>Escalar incidente</h3><p className="muted">Elige una cola del mismo proceso con nivel de soporte superior y escribe el motivo arriba.</p><div className="button-row"><select aria-label="Cola de escalamiento" value={escalationQueueId} onChange={(e) => setEscalationQueueId(e.target.value)}><option value="">Cola de nivel superior</option>{escalationTargets.map((q) => <option key={q.id} value={q.id}>{q.name} · nivel {q.support_level}</option>)}</select><button className="secondary" disabled={busy || !escalationQueueId || !reason.trim()} onClick={() => void action('escalate',{queueId:Number(escalationQueueId),reason})}>Escalar</button></div>{escalationTargets.length===0 && <p className="muted">No hay una cola activa de nivel superior para este proceso.</p>}</section>}
      <section className="desk-section"><h3>Conversación</h3>{ticket.comments.map((item) => <article className="desk-note" key={item.id}><small>{item.visibility==='INTERNAL'?'Nota interna':'Comentario público'} · {date(item.created_at)}</small><p>{item.body}</p></article>)}{canWrite(user) && <div className="stack-form"><label>Nuevo comentario<textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} /></label>{staff && <label>Visibilidad<select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="PUBLIC">Visible al solicitante</option><option value="INTERNAL">Nota interna</option></select></label>}<button className="secondary" disabled={busy || !comment.trim()} onClick={() => void action('comments',{body:comment,visibility})}>Enviar comentario</button></div>}</section>
      <section className="desk-section"><h3>Evidencias</h3>{ticket.attachments.map((item) => <p key={item.id}><a href={`/api/desk/tickets/${id}/attachments/${item.id}`}>{item.originalName}</a> <small>({Math.ceil(item.sizeBytes/1024)} KB)</small></p>)}{canWrite(user) && <div className="button-row"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><button className="secondary" disabled={busy || !file} onClick={() => void upload()}>Adjuntar</button></div>}</section>
      <section className="desk-section"><h3>Bitácora</h3>{ticket.history.map((item) => <article className="desk-note" key={item.id}><strong>{label(item.action)}</strong><small> · {date(item.created_at)} · {item.actor_name ?? `Actor #${item.actor_id ?? 'sistema'}`}</small>{item.reason && <p>{item.reason}</p>}{(item.old_values !== null || item.new_values !== null) && <details><summary>Ver valores anteriores y nuevos</summary><div className="desk-history-values">{item.old_values !== null && <div><strong>Antes</strong><pre>{JSON.stringify(item.old_values,null,2)}</pre></div>}{item.new_values !== null && <div><strong>Después</strong><pre>{JSON.stringify(item.new_values,null,2)}</pre></div>}</div></details>}</article>)}</section>
      <section className="desk-section"><h3>CI afectados</h3>{ticket.ci.map((ci) => <p key={ci.id}>{ci.code} · {ci.name}</p>)}{staff && <><label>Buscar CI para vincular<input value={ciSearch} onChange={(e) => setCiSearch(e.target.value)} placeholder="Código o nombre" /></label>{ciOptions.length>0 && <div className="desk-search-options">{ciOptions.map((ci) => <button className="secondary" key={ci.id} disabled={busy} onClick={() => {void action('ci',{ciId:Number(ci.id)});setCiSearch('');}}>{ci.code} · {ci.name}</button>)}</div>}</>}</section>
      <section className="desk-section"><h3>Tickets relacionados</h3>{ticket.links.length ? ticket.links.map((link,index) => <p key={index}>{link.link_type}: #{String(link.ticket_id)===String(ticket.id)?link.related_ticket_id:link.ticket_id}</p>) : <p className="muted">Sin relaciones.</p>}{staff && <div className="desk-category-form"><label>ID del ticket relacionado<input type="number" min="1" value={relatedId} onChange={(e) => setRelatedId(e.target.value)} /></label><label>Relación<select value={linkType} onChange={(e) => setLinkType(e.target.value)}><option value="RELATED">Relacionado</option><option value="CAUSED_BY">Causado por</option><option value="IMPLEMENTS">Implementa</option><option value="DUPLICATE_OF">Duplicado de</option></select></label><button className="secondary" disabled={busy || !relatedId} onClick={() => {void action('links',{relatedTicketId:Number(relatedId),linkType});setRelatedId('');}}>Vincular</button></div>}</section>
    </>}
  </section></div>;
}

export function TicketsPage({ user, initialTicketId, onTicketOpened, initialProcess = '' }: { user: Account; initialTicketId?: number | null; onTicketOpened?: () => void; initialProcess?: string }) {
  const [queues,setQueues] = useState<Queue[]>([]);
  const [services,setServices] = useState<Service[]>([]);
  const [users,setUsers] = useState<Array<{id:number;name:string}>>([]);
  const [rows,setRows] = useState<Page<Ticket> | null>(null);
  const [search,setSearch] = useState('');
  const [process,setProcess] = useState(initialProcess);
  const [state,setState] = useState('');
  const [queueId,setQueueId] = useState('');
  const [priority,setPriority] = useState('');
  const [serviceId,setServiceId] = useState('');
  const [assigneeId,setAssigneeId] = useState('');
  const [fromDate,setFromDate] = useState('');
  const [toDate,setToDate] = useState('');
  const [page,setPage] = useState(1);
  const [error,setError] = useState('');
  const [creating,setCreating] = useState(false);
  const [selected,setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (initialTicketId == null) return;
    setSelected(initialTicketId);
    onTicketOpened?.();
  },[initialTicketId,onTicketOpened]);
  async function load() {try {const params = new URLSearchParams({page:String(page),pageSize:'20'});for(const [key,value] of Object.entries({search,process,state,queueId,priority,serviceId,assigneeId,from:fromDate,to:toDate})){if(value)params.set(key,value);}setRows(await api<Page<Ticket>>(`/desk/tickets?${params}`));}catch(e){setError(message(e));}}
  useEffect(() => {api<Queue[]>('/desk/queues').then(setQueues).catch((e) => setError(message(e)));},[]);
  useEffect(() => {api<Page<Service>>('/services?pageSize=100').then((result)=>setServices(result.data)).catch((e)=>setError(message(e)));api<Array<{id:number;name:string}>>('/desk/users').then(setUsers).catch((e)=>setError(message(e)));},[]);
  useEffect(() => {void load();},[page,process,state,queueId,priority,serviceId,assigneeId,fromDate,toDate]);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">Service Desk</p><h1>Tickets</h1><p className="muted">Seguimiento por proceso, prioridad y cola de atención.</p></div>{canWrite(user) && <button className="primary" onClick={() => setCreating(true)}>Nuevo ticket</button>}</div>
    <div className="filters"><div className="search-input"><input aria-label="Buscar ticket" placeholder="Número o título" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => {if(e.key==='Enter'){setPage(1);void load();}}} /></div><select aria-label="Filtrar proceso" value={process} onChange={(e) => {setProcess(e.target.value);setPage(1);}}><option value="">Todos los procesos</option>{Object.keys(transitions).map((key) => <option key={key} value={key}>{label(key)}</option>)}</select><select aria-label="Filtrar estado" value={state} onChange={(e) => {setState(e.target.value);setPage(1);}}><option value="">Todos los estados</option>{['SUBMITTED','IN_PROGRESS','PENDING_APPROVAL','APPROVED','RESOLVED','CLOSED','REJECTED'].map((key) => <option key={key} value={key}>{label(key)}</option>)}</select><button className="secondary" onClick={() => {setPage(1);void load();}}>Buscar</button></div>
    <div className="filters desk-extra-filters"><select aria-label="Filtrar cola" value={queueId} onChange={(e)=>{setQueueId(e.target.value);setPage(1);}}><option value="">Todas las colas</option>{queues.map((q)=><option key={q.id} value={q.id}>{q.name}</option>)}</select><select aria-label="Filtrar servicio" value={serviceId} onChange={(e)=>{setServiceId(e.target.value);setPage(1);}}><option value="">Todos los servicios</option>{services.map((s)=><option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select><select aria-label="Filtrar prioridad" value={priority} onChange={(e)=>{setPriority(e.target.value);setPage(1);}}><option value="">Todas las prioridades</option>{[1,2,3,4,5].map((n)=><option key={n} value={n}>Prioridad {n}</option>)}</select><select aria-label="Filtrar responsable" value={assigneeId} onChange={(e)=>{setAssigneeId(e.target.value);setPage(1);}}><option value="">Todos los responsables</option>{users.map((u)=><option key={u.id} value={u.id}>{u.name}</option>)}</select><label>Desde<input type="date" value={fromDate} onChange={(e)=>{setFromDate(e.target.value);setPage(1);}} /></label><label>Antes de<input type="date" value={toDate} onChange={(e)=>{setToDate(e.target.value);setPage(1);}} /></label></div>
    {error && <div className="alert error">{error}</div>}<section className="panel"><div className="table-wrap"><table><thead><tr><th>Número</th><th>Título</th><th>Proceso</th><th>Cola</th><th>Estado</th><th>Prioridad</th><th>Creado</th></tr></thead><tbody>{rows?.data.map((row) => <tr className="clickable" key={row.id} onClick={() => setSelected(row.id)}><td><strong>{row.number}</strong></td><td>{row.title}</td><td>{label(row.process)}</td><td>{row.queueName}</td><td><span className="badge">{label(row.state)}</span></td><td>{row.priority}</td><td>{date(row.createdAt)}</td></tr>)}</tbody></table>{rows?.data.length===0 && <p className="empty">No hay tickets con esos filtros.</p>}</div><div className="pagination"><button className="secondary" disabled={page<=1} onClick={() => setPage(page-1)}>Anterior</button><span>Página {page} · {rows?.total ?? 0} tickets</span><button className="secondary" disabled={!rows || page*20>=rows.total} onClick={() => setPage(page+1)}>Siguiente</button></div></section>
    {creating && <TicketCreate queues={queues} user={user} onCancel={() => setCreating(false)} onDone={() => {setCreating(false);void load();}} />}
    {selected !== null && <TicketView id={selected} user={user} queues={queues} users={users} onClose={() => setSelected(null)} onChanged={() => void load()} />}
  </div>;
}

function CiEditor({ categories, locations, initial, onCancel, onSaved }: {
  categories: Category[]; locations: CiLocation[]; initial: Record<string,unknown> | null; onCancel: () => void; onSaved: () => void;
}) {
  const [users,setUsers] = useState<Array<{id:number;name:string}>>([]);
  const [form,setForm] = useState<Record<string,string>>({
    code:String(initial?.code ?? ''),name:String(initial?.name ?? ''),
    categoryId:String(initial?.category_id ?? ''),location:String(initial?.location ?? ''),
    locationId:String(initial?.location_id ?? ''),
    responsibleUserId:String(initial?.responsible_user_id ?? ''),responsibleLabel:String(initial?.responsible_label ?? ''),
    status:String(initial?.status ?? 'ACTIVE'),description:String(initial?.description ?? ''),
    serialNumber:String(initial?.serial_number ?? ''),version:String(initial?.version ?? ''),
    acquiredOn:String(initial?.acquired_on ?? '').slice(0,10),documentationUrl:String(initial?.documentation_url ?? ''),
    securityLevel:String(initial?.security_level ?? ''),complianceStatus:String(initial?.compliance_status ?? ''),
    configurationStatus:String(initial?.configuration_status ?? ''),licenseNumber:String(initial?.license_number ?? ''),
    licenseExpiresOn:String(initial?.license_expires_on ?? '').slice(0,10),
    isDevice:initial?.is_device===false?'false':'true',
    technicalAttributes:JSON.stringify(initial?.technical_attributes ?? {},null,2),
  });
  const [error,setError] = useState(''); const [saving,setSaving] = useState(false);
  useEffect(() => {api<typeof users>('/desk/users').then(setUsers).catch(() => undefined);},[]);
  const change = (key:string,value:string) => setForm((current) => ({...current,[key]:value}));
  async function submit(event:FormEvent) {event.preventDefault();setError('');setSaving(true);try {
    const controlledLocation = locations.find((item) => String(item.id)===form.locationId);
    const body = {code:form.code,name:form.name,categoryId:Number(form.categoryId),
      locationId:controlledLocation?.id ?? null,location:controlledLocation?.name ?? form.location,
      responsibleUserId:form.responsibleUserId?Number(form.responsibleUserId):null,
      responsibleLabel:form.responsibleLabel || null,status:form.status,description:form.description || null,
      serialNumber:form.serialNumber || null,version:form.version || null,acquiredOn:form.acquiredOn || null,
      documentationUrl:form.documentationUrl || null,
      securityLevel:form.securityLevel || null,complianceStatus:form.complianceStatus || null,
      configurationStatus:form.configurationStatus || null,licenseNumber:form.licenseNumber || null,
      licenseExpiresOn:form.licenseExpiresOn || null,isDevice:form.isDevice==='true',
      technicalAttributes:JSON.parse(form.technicalAttributes),
    };
    if(initial) await patch(`/cmdb/items/${initial.id}`,body); else await post('/cmdb/items',body);
    onSaved();
  }catch(e){setError(message(e));}finally{setSaving(false);}}
  return <div className="modal-backdrop" onClick={onCancel}><section className="modal-card desk-detail" role="dialog" aria-modal="true" aria-label={initial?'Editar CI':'Nuevo CI'} onClick={(e) => e.stopPropagation()}><div className="drawer-head"><h2>{initial?'Editar CI':'Nuevo CI'}</h2><button className="icon-button" onClick={onCancel} aria-label="Cerrar">×</button></div><form className="form-grid" onSubmit={submit}><label>Código<input value={form.code} onChange={(e) => change('code',e.target.value)} disabled={!!initial} required /></label><label>Nombre<input value={form.name} onChange={(e) => change('name',e.target.value)} required /></label><label>Categoría<select value={form.categoryId} onChange={(e) => change('categoryId',e.target.value)} required><option value="">Selecciona</option>{categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Estado<select value={form.status} onChange={(e) => change('status',e.target.value)}>{['ACTIVE','INACTIVE','MAINTENANCE','RETIRED','UNKNOWN'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></label><label>¿Cuenta como dispositivo?<select value={form.isDevice} onChange={(e) => change('isDevice',e.target.value)}><option value="true">Sí</option><option value="false">No, es otro CI</option></select></label><label>Ubicación controlada<select value={form.locationId} onChange={(e) => change('locationId',e.target.value)}><option value="">Usar texto libre del origen</option>{locations.filter((item)=>item.active).map((item)=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Ubicación escrita<input value={form.location} onChange={(e) => change('location',e.target.value)} disabled={!!form.locationId} required={!form.locationId} /></label><label>Usuario responsable<select value={form.responsibleUserId} onChange={(e) => change('responsibleUserId',e.target.value)}><option value="">Equipo o texto libre</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Equipo responsable<input value={form.responsibleLabel} onChange={(e) => change('responsibleLabel',e.target.value)} placeholder="Obligatorio si no eliges usuario" /></label><label>Número de serie<input value={form.serialNumber} onChange={(e) => change('serialNumber',e.target.value)} /></label><label>Versión<input value={form.version} onChange={(e) => change('version',e.target.value)} /></label><label>Fecha de adquisición<input type="date" value={form.acquiredOn} onChange={(e) => change('acquiredOn',e.target.value)} /></label><label>Documentación relacionada<input value={form.documentationUrl} onChange={(e) => change('documentationUrl',e.target.value)} /></label><label>Nivel de seguridad<input value={form.securityLevel} onChange={(e) => change('securityLevel',e.target.value)} /></label><label>Cumplimiento<input value={form.complianceStatus} onChange={(e) => change('complianceStatus',e.target.value)} /></label><label>Estado de configuración<input value={form.configurationStatus} onChange={(e) => change('configurationStatus',e.target.value)} /></label><label>Licencia<input value={form.licenseNumber} onChange={(e) => change('licenseNumber',e.target.value)} /></label><label>Vencimiento de licencia<input type="date" value={form.licenseExpiresOn} onChange={(e) => change('licenseExpiresOn',e.target.value)} /></label><label className="wide">Descripción<textarea value={form.description} onChange={(e) => change('description',e.target.value)} rows={2} /></label><label className="wide">Atributos técnicos (JSON)<textarea value={form.technicalAttributes} onChange={(e) => change('technicalAttributes',e.target.value)} rows={4} /></label>{error && <div className="alert error wide">{error}</div>}<div className="wide modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving?'Guardando...':'Guardar CI'}</button></div></form></section></div>;
}

function CiConnections({ ciId, onChanged }: { ciId: number; onChanged: () => void }) {
  const [search,setSearch] = useState(''); const [options,setOptions] = useState<Ci[]>([]);
  const [target,setTarget] = useState(''); const [relationType,setRelationType] = useState('DEPENDS_ON');
  const [services,setServices] = useState<Service[]>([]); const [serviceId,setServiceId] = useState('');
  const [error,setError] = useState('');
  useEffect(() => {api<Page<Service>>('/services?pageSize=100').then((page) => setServices(page.data)).catch(() => undefined);},[]);
  useEffect(() => {if(search.trim().length<2){setOptions([]);return;}
    api<Page<Ci>>(`/cmdb/items?search=${encodeURIComponent(search)}&pageSize=20`).then((page) => setOptions(page.data.filter((ci) => Number(ci.id)!==Number(ciId)))).catch(() => setOptions([]));
  },[search,ciId]);
  async function linkRelation(event:FormEvent) {event.preventDefault();setError('');try {await post('/cmdb/relations',{fromCiId:Number(ciId),toCiId:Number(target),relationType});setTarget('');setSearch('');onChanged();}catch(e){setError(message(e));}}
  async function linkService(event:FormEvent) {event.preventDefault();setError('');try {await post('/cmdb/services',{ciId:Number(ciId),serviceId:Number(serviceId)});setServiceId('');onChanged();}catch(e){setError(message(e));}}
  return <section className="desk-section"><h3>Vincular CI y servicios</h3>{error && <div className="alert error">{error}</div>}<form className="stack-form" onSubmit={linkRelation}><label>Buscar CI destino<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código o nombre" /></label>{options.length>0 && <div className="desk-search-options">{options.map((ci) => <button type="button" className="secondary" key={ci.id} onClick={() => {setTarget(String(ci.id));setSearch(`${ci.code} · ${ci.name}`);setOptions([]);}}>{ci.code} · {ci.name}</button>)}</div>}<label>Tipo de relación<select value={relationType} onChange={(e) => setRelationType(e.target.value)}><option value="DEPENDS_ON">Depende de</option><option value="CONNECTED_TO">Conectado a</option><option value="HOSTED_ON">Alojado en</option><option value="PARENT_OF">Padre técnico de</option></select></label><button className="secondary" disabled={!target}>Crear relación</button></form><form className="desk-category-form" onSubmit={linkService}><label>Servicio asociado<select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required><option value="">Selecciona</option>{services.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></label><button className="secondary">Vincular servicio</button></form></section>;
}

function CategoryEditor({ category, categories, onCancel, onSaved }: {
  category: Category; categories: Category[]; onCancel: () => void; onSaved: () => void;
}) {
  const [name,setName] = useState(category.name);
  const [parentId,setParentId] = useState(String(category.parentId ?? ''));
  const [active,setActive] = useState(category.active);
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  async function save(event:FormEvent) {
    event.preventDefault();setError('');setSaving(true);
    try {await patch(`/cmdb/categories/${category.id}`,{name,parentId:parentId?Number(parentId):null,active});onSaved();}
    catch(e){setError(message(e));}finally{setSaving(false);}
  }
  return <div className="modal-backdrop" onClick={onCancel}><section className="modal-card desk-detail" role="dialog" aria-modal="true" aria-label={`Editar categoría ${category.code}`} onClick={(e)=>e.stopPropagation()}><div className="drawer-head"><h2>Editar categoría {category.code}</h2><button className="icon-button" onClick={onCancel} aria-label="Cerrar">×</button></div><form className="stack-form" onSubmit={save}><label>Nombre<input value={name} onChange={(e)=>setName(e.target.value)} required /></label><label>Padre<select value={parentId} onChange={(e)=>setParentId(e.target.value)}><option value="">Raíz</option>{categories.filter((c)=>c.active && c.id!==category.id).map((c)=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label><label className="desk-checkbox"><input type="checkbox" checked={active} onChange={(e)=>setActive(e.target.checked)} />Categoría activa</label><p className="muted">Para desactivarla, reasigna antes sus categorías hijas y CI activos.</p>{error && <div className="alert error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>Guardar cambios</button></div></form></section></div>;
}

function LocationEditor({ location, onCancel, onSaved }: {
  location: CiLocation; onCancel: () => void; onSaved: () => void;
}) {
  const [name,setName] = useState(location.name);
  const [active,setActive] = useState(location.active);
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();setError('');setSaving(true);
    try {await patch(`/cmdb/locations/${location.id}`,{name,active});onSaved();}
    catch(e){setError(message(e));}finally{setSaving(false);}
  }
  return <div className="modal-backdrop" onClick={onCancel}><section className="modal-card desk-detail" role="dialog" aria-modal="true" aria-label={`Editar ubicación ${location.code}`} onClick={(e)=>e.stopPropagation()}><div className="drawer-head"><h2>Editar ubicación {location.code}</h2><button className="icon-button" onClick={onCancel} aria-label="Cerrar">×</button></div><form className="stack-form" onSubmit={save}><label>Nombre<input value={name} onChange={(e)=>setName(e.target.value)} required /></label><label className="desk-checkbox"><input type="checkbox" checked={active} onChange={(e)=>setActive(e.target.checked)} />Ubicación activa</label><p className="muted">Para desactivarla, reasigna o retira antes los CI vinculados.</p>{error && <div className="alert error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>Guardar cambios</button></div></form></section></div>;
}

export function CmdbPage({ user, onOpenTicket }: { user: Account; onOpenTicket?: (ticketId: number) => void }) {
  const [rows,setRows] = useState<Page<Ci> | null>(null);
  const [categories,setCategories] = useState<Category[]>([]);
  const [locations,setLocations] = useState<CiLocation[]>([]);
  const [search,setSearch] = useState('');
  const [appliedSearch,setAppliedSearch] = useState('');
  const [categoryId,setCategoryId] = useState('');
  const [status,setStatus] = useState('');
  const [locationId,setLocationId] = useState('');
  const [isDevice,setIsDevice] = useState('');
  const [page,setPage] = useState(1);
  const [selected,setSelected] = useState<Record<string,unknown> | null>(null);
  const [editing,setEditing] = useState<Record<string,unknown> | null | undefined>(undefined);
  const [impact,setImpact] = useState<Record<string,unknown> | null>(null);
  const [error,setError] = useState('');
  const [newCategory,setNewCategory] = useState({code:'',name:'',parentId:''});
  const [editingCategory,setEditingCategory] = useState<Category | null>(null);
  const [newLocation,setNewLocation] = useState({code:'',name:''});
  const [editingLocation,setEditingLocation] = useState<CiLocation | null>(null);
  async function load() {try {const params = new URLSearchParams({page:String(page),pageSize:'25'});if(appliedSearch)params.set('search',appliedSearch);if(categoryId)params.set('categoryId',categoryId);if(status)params.set('status',status);if(locationId)params.set('locationId',locationId);if(isDevice)params.set('isDevice',isDevice);setRows(await api<Page<Ci>>(`/cmdb/items?${params}`));}catch(e){setError(message(e));}}
  useEffect(() => {api<Category[]>('/cmdb/categories').then(setCategories).catch((e) => setError(message(e)));},[]);
  useEffect(() => {api<CiLocation[]>('/cmdb/locations').then(setLocations).catch((e) => setError(message(e)));},[]);
  useEffect(() => {void load();},[page,categoryId,status,locationId,isDevice,appliedSearch]);
  async function open(id: number) {try {setSelected(await api<Record<string,unknown>>(`/cmdb/items/${id}`));setImpact(null);}catch(e){setError(message(e));}}
  const sourceFields: Array<[string,string]> = [
    ['Descripción','description'],['Número de serie','serial_number'],['Versión','version'],['Adquisición','acquired_on'],
    ['Ubicación original','location'],['Responsable de origen','responsible_label'],
    ['Seguridad','security_level'],['Cumplimiento','compliance_status'],['Estado de configuración','configuration_status'],
    ['Número de licencia','license_number'],['Vencimiento de licencia','license_expires_on'],['Documentación','documentation_url'],
  ];
  const originalFields: Array<[string,string]> = [
    ['Estado actual original','originalStatus'],['Relaciones originales','originalRelations'],['Padres e hijos originales','originalParentsChildren'],
    ['Fecha de cambio original','sourceChangeDate'],['Descripción del cambio original','sourceChangeDescription'],
    ['Documentación original','originalDocumentation'],['Enlaces de incidentes y problemas','originalIncidentLinks'],
    ['Hoja de origen','sourceSheet'],['Fila de origen','sourceRow'],
  ];
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">Configuración</p><h1>CMDB</h1><p className="muted">Dispositivos, clasificación y relaciones técnicas.</p></div><div className="button-row"><span className="badge active">{rows?.total ?? '...'} CI</span>{isAdmin(user) && <button className="primary" onClick={() => setEditing(null)}>Nuevo CI</button>}</div></div>
    <div className="filters"><div className="search-input"><input placeholder="Código o nombre de CI" aria-label="Buscar CI" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => {if(e.key==='Enter'){setPage(1);setAppliedSearch(search);}}} /></div><select aria-label="Categoría" value={categoryId} onChange={(e) => {setCategoryId(e.target.value);setPage(1);}}><option value="">Todas las categorías</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select aria-label="Estado del CI" value={status} onChange={(e)=>{setStatus(e.target.value);setPage(1);}}><option value="">Todos los estados</option>{['ACTIVE','INACTIVE','MAINTENANCE','RETIRED','UNKNOWN'].map((value)=><option key={value} value={value}>{label(value)}</option>)}</select><select aria-label="Ubicación del CI" value={locationId} onChange={(e)=>{setLocationId(e.target.value);setPage(1);}}><option value="">Todas las ubicaciones</option>{locations.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Tipo de elemento" value={isDevice} onChange={(e)=>{setIsDevice(e.target.value);setPage(1);}}><option value="">Todos los CI</option><option value="true">Solo dispositivos</option><option value="false">Otros CI</option></select><button className="secondary" onClick={() => {setPage(1);setAppliedSearch(search);}}>Buscar</button></div>
    {error && <div className="alert error">{error}</div>}<section className="panel"><div className="table-wrap"><table><thead><tr><th>Código</th><th>Nombre</th><th>Clasificación</th><th>Tipo</th><th>Estado</th><th>Ubicación</th><th>Responsable</th></tr></thead><tbody>{rows?.data.map((row) => <tr key={row.id} className="clickable" onClick={() => void open(row.id)}><td><strong>{row.code}</strong></td><td>{row.name}</td><td>{row.categoryName}</td><td>{row.isDevice?'Dispositivo':'Otro CI'}</td><td><span className="badge">{label(row.status)}</span></td><td>{row.location}</td><td>{row.responsibleUserName ?? row.responsibleLabel ?? 'No informado'}</td></tr>)}</tbody></table>{rows?.data.length===0 && <p className="empty">No hay elementos que coincidan con esos filtros.</p>}</div><div className="pagination"><button className="secondary" disabled={page<=1} onClick={() => setPage(page-1)}>Anterior</button><span>Página {page} · {rows?.total ?? 0} CI</span><button className="secondary" disabled={!rows || page*25>=rows.total} onClick={() => setPage(page+1)}>Siguiente</button></div></section>
    <section className="panel desk-section"><h2>Jerarquía de clasificación</h2><div className="desk-category-grid">{categories.map((c) => <div key={c.id} className="desk-note"><strong>{c.code} · {c.name}</strong><small>Padre: {categories.find((p) => p.id===c.parentId)?.name ?? 'Raíz'} · Origen: {c.sourceKind} · {c.active?'Activa':'Inactiva'}</small>{isAdmin(user) && <button className="text-button" onClick={() => setEditingCategory(c)}>Editar categoría</button>}</div>)}</div>{isAdmin(user) && <form className="desk-category-form" onSubmit={async(e) => {e.preventDefault();try {await post('/cmdb/categories',{code:newCategory.code,name:newCategory.name,parentId:newCategory.parentId?Number(newCategory.parentId):null});setCategories(await api<Category[]>('/cmdb/categories'));setNewCategory({code:'',name:'',parentId:''});}catch(err){setError(message(err));}}}><label>Código<input value={newCategory.code} onChange={(e) => setNewCategory({...newCategory,code:e.target.value})} required /></label><label>Nombre<input value={newCategory.name} onChange={(e) => setNewCategory({...newCategory,name:e.target.value})} required /></label><label>Padre<select value={newCategory.parentId} onChange={(e) => setNewCategory({...newCategory,parentId:e.target.value})}><option value="">Raíz</option>{categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="secondary">Agregar categoría</button></form>}</section>
    <section className="panel desk-section"><h2>Ubicaciones controladas</h2><p className="muted">Los valores originales del Excel permanecen como texto cuando no hay una ubicación identificada.</p><div className="desk-category-grid">{locations.map((item)=><div key={item.id} className="desk-note"><strong>{item.code} · {item.name}</strong><small>{item.active?'Activa':'Inactiva'}</small>{isAdmin(user) && <button className="text-button" onClick={()=>setEditingLocation(item)}>Editar ubicación</button>}</div>)}</div>{isAdmin(user) && <form className="desk-category-form" onSubmit={async(e)=>{e.preventDefault();try {await post('/cmdb/locations',newLocation);setLocations(await api<CiLocation[]>('/cmdb/locations'));setNewLocation({code:'',name:''});}catch(err){setError(message(err));}}}><label>Código<input value={newLocation.code} onChange={(e)=>setNewLocation({...newLocation,code:e.target.value})} required /></label><label>Nombre<input value={newLocation.name} onChange={(e)=>setNewLocation({...newLocation,name:e.target.value})} required /></label><button className="secondary">Agregar ubicación</button></form>}</section>
    {editingCategory && <CategoryEditor category={editingCategory} categories={categories} onCancel={() => setEditingCategory(null)} onSaved={() => {setEditingCategory(null);void api<Category[]>('/cmdb/categories').then(setCategories);}} />}
    {editingLocation && <LocationEditor location={editingLocation} onCancel={() => setEditingLocation(null)} onSaved={() => {setEditingLocation(null);void api<CiLocation[]>('/cmdb/locations').then(setLocations);void load();}} />}
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}>
      <section className="modal-card desk-detail" role="dialog" aria-modal="true" aria-label="Detalle de CI" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head"><h2>{String(selected.code)} · {String(selected.name)}</h2><button className="icon-button" onClick={() => setSelected(null)} aria-label="Cerrar">×</button></div>
        <div className="desk-facts">
          <span><strong>Estado</strong>{String(selected.status)}</span>
          <span><strong>Ubicación</strong>{String(selected.location)}</span>
          <span><strong>Clasificación completa</strong>{(selected.classificationPath as Array<Record<string,unknown>>).map((c) => String(c.name)).join(' → ')}</span>
          <span><strong>Responsable</strong>{String(selected.responsible_user_name ?? selected.responsible_label ?? 'No informado')}</span>
          <span><strong>Tipo de registro</strong>{selected.is_device?'Dispositivo':'Otro CI'}</span>
          <span><strong>Código de ubicación</strong>{String(selected.location_code ?? 'Sin catálogo controlado')}</span>
        </div>
        {isAdmin(user) && <div className="button-row desk-actions"><button className="secondary" onClick={() => {setEditing(selected);setSelected(null);}}>Editar CI</button></div>}
        <section className="desk-section"><h3>Atributos de CMDB</h3><div className="desk-facts">{sourceFields.map(([title,key])=><span key={key}><strong>{title}</strong>{String(selected[key] ?? 'No informado')}</span>)}</div></section>
        <section className="desk-section"><h3>Atributos técnicos por clasificación</h3><pre>{JSON.stringify(selected.technical_attributes,null,2)}</pre></section>
        <section className="desk-section"><h3>Trazabilidad del Excel</h3><div className="desk-facts">{originalFields.map(([title,key])=>{const attrs=(selected.technical_attributes ?? {}) as Record<string,unknown>;return <span key={key}><strong>{title}</strong>{String(attrs[key] ?? 'Sin dato en la fuente')}</span>;})}</div></section>
        <section className="desk-section"><h3>Relaciones técnicas</h3>
          {(selected.relations as Array<Record<string,unknown>>).length===0 && <p className="muted">Sin relaciones registradas.</p>}
          {(selected.relations as Array<Record<string,unknown>>).map((relation,index) => {
            const fromId=Number(relation.from_ci_id),toId=Number(relation.to_ci_id);
            return <p key={index}><strong>{label(String(relation.relation_type))}:</strong> <button className="text-button" onClick={() => void open(fromId)}>{String(relation.from_code)} · {String(relation.from_name)}</button> → <button className="text-button" onClick={() => void open(toId)}>{String(relation.to_code)} · {String(relation.to_name)}</button></p>;
          })}
        </section>
        <section className="desk-section"><h3>Servicios asociados</h3>
          {(selected.services as Array<Record<string,unknown>>).map((service,index) => <p key={index}>{String(service.code)} · {String(service.name)}</p>)}
        </section>
        <section className="desk-section"><h3>Tickets relacionados</h3>
          {(selected.tickets as Array<Record<string,unknown>>).map((ticket,index) => <p key={index}><button className="text-button" onClick={() => onOpenTicket?.(Number(ticket.id))}>{String(ticket.number)} · {String(ticket.title)}</button><small> · {label(String(ticket.state))} · última actividad {String(ticket.lastActivityAt ?? ticket.createdAt)}</small></p>)}
          {(selected.tickets as Array<Record<string,unknown>>).length===0 && <p className="muted">No hay tickets visibles asociados a este CI.</p>}
        </section>
        <section className="desk-section"><h3>Historial del CI</h3>{(selected.history as Array<Record<string,unknown>>).length===0 && <p className="muted">Sin cambios registrados.</p>}{(selected.history as Array<Record<string,unknown>>).map((entry,index)=><article className="desk-note" key={index}><strong>{label(String(entry.action))}</strong><small> · {String(entry.created_at)} · {String(entry.actor_name ?? 'Sistema')}</small>{Boolean(entry.description) && <p>{String(entry.description)}</p>}{Boolean(entry.old_values || entry.new_values) && <details><summary>Ver valores anteriores y nuevos</summary><pre>{JSON.stringify({antes:entry.old_values,despues:entry.new_values},null,2)}</pre></details>}</article>)}</section>
        {isAdmin(user) && <CiConnections ciId={Number(selected.id)} onChanged={() => void open(Number(selected.id))} />}
        <section className="desk-section"><h3>Impacto potencial</h3><button className="secondary" onClick={async() => {try {setImpact(await api<Record<string,unknown>>('/cmdb/items/'+String(selected.id)+'/impact'));}catch(e){setError(message(e));}}}>Recorrer dependencias</button>
          {impact && <><p className="muted">{String(impact.note)}</p><div className="desk-category-grid">{(impact.potentiallyAffected as Array<Record<string,unknown>>).map((item,index) => <article className="desk-note" key={index}><strong>{String(item.code)} · {String(item.name)}</strong><small>Servicio: {item.service_code ? String(item.service_code)+' · '+String(item.service_name) : 'sin vínculo directo'}</small></article>)}</div></>}
        </section>
      </section>
    </div>}
    {editing!==undefined && <CiEditor categories={categories} locations={locations} initial={editing} onCancel={() => setEditing(undefined)} onSaved={() => {setEditing(undefined);void load();}} />}
  </div>;
}

function objectiveSummary(value: unknown) {
  const row = value && typeof value === 'object' ? value as { met?: unknown; evaluated?: unknown } : {};
  const met = Number(row.met ?? 0);
  const evaluated = Number(row.evaluated ?? 0);
  if (!Number.isFinite(met) || !Number.isFinite(evaluated) || evaluated <= 0) return 'Sin casos evaluables';
  const percentage = Math.round(met / evaluated * 1000) / 10;
  return `${met} de ${evaluated} dentro del objetivo (${percentage}%)`;
}

export function DeskMetricsPage() {
  const [data,setData] = useState<Record<string,unknown> | null>(null);
  const [error,setError] = useState('');
  useEffect(() => {api<Record<string,unknown>>('/desk/metrics').then(setData).catch((e) => setError(message(e)));},[]);
  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <div className="loading">Cargando indicadores...</div>;
  const groups = [['Por cola',data.byQueue],['Por proceso',data.byProcess],['Por prioridad',data.byPriority],['Por estado',data.byState]] as const;
  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">Indicadores</p><h1>Tablero de atención</h1><p className="muted">Cálculos sobre tickets visibles para tu cuenta.</p></div></div>
    <div className="desk-kpi-grid">
      {[
        ['Tickets',data.total],['No cerrados o rechazados',data.open],
        ['Antigüedad abierta (min)',data.averageOpenAgeMinutes],
        ['Primera atención promedio (min)',data.averageFirstResponseMinutes],
        ['Resolución promedio (min)',data.averageResolutionMinutes],
      ].map(([title,value]) => <div className="metric-card" key={String(title)}><div><span>{String(title)}</span><strong>{value==null?'—':String(value)}</strong></div></div>)}
    </div>
    <div className="desk-metric-grid">{groups.map(([title,values]) => <section className="panel" key={title}><h2>{title}</h2>{Object.entries(values as Record<string,number>).map(([key,value]) => <div className="desk-stat" key={key}><span>{label(key)}</span><strong>{value}</strong></div>)}</section>)}</div>
    <section className="panel desk-section">
      <h2>Objetivos de atención</h2>
      <div className="desk-objectives">
        <div><strong>Primera respuesta</strong><span>{objectiveSummary(data.firstResponseObjective)}</span></div>
        <div><strong>Resolución</strong><span>{objectiveSummary(data.resolutionObjective)}</span></div>
      </div>
      <p className="muted">{String(data.basis)}</p>
    </section>
  </div>;
}

const processGuide: Record<string,{ summary:string; evidence:string[]; rules:string[]; route:string[] }> = {
  NEW_SERVICE:{summary:'Solicitar y evaluar un servicio que todavía no está en el catálogo.',evidence:['Necesidad y viabilidad','Servicio existente o código y nombre propuestos','Resultado de implementación'],rules:['La aprobación vincula un servicio existente o crea uno en revisión sin duplicar códigos.','El rechazo detiene la implementación.'],route:['SUBMITTED','ANALYSIS','PENDING_APPROVAL','APPROVED','IMPLEMENTING','RESOLVED','CLOSED']},
  CHANGE:{summary:'Evaluar, aprobar y ejecutar un cambio controlado.',evidence:['CI afectados','Impacto y riesgo','Plan de pruebas y reversión','Resultados de ejecución y validación'],rules:['No se ejecuta sin aprobación registrada.','El alcance aprobado queda protegido.'],route:['SUBMITTED','RISK_ASSESSMENT','PENDING_APPROVAL','APPROVED','PLANNED','EXECUTING','VALIDATING','RESOLVED','CLOSED']},
  INCIDENT:{summary:'Restaurar un servicio interrumpido o degradado y registrar la solución.',evidence:['Categoría I0–I6','Interrupción o degradación y duración','Redundancia y solución aplicada'],rules:['El escalamiento exige una cola del mismo proceso con nivel superior.','La resolución exige una solución documentada.'],route:['SUBMITTED','CLASSIFIED','DIAGNOSING','IN_PROGRESS','RESOLVED','CLOSED']},
  EVENT:{summary:'Registrar y evaluar eventos; convertir E2/E3 en incidentes atendibles.',evidence:['Categoría E0–E3','Evaluación para E1–E3','Incidente y notificación para E2/E3'],rules:['E0 se registra y cierra; E1 se evalúa sin respuesta operativa.','E2/E3 generan o vinculan un único incidente.'],route:['SUBMITTED','CLASSIFIED','EVALUATED','RESPONDED','CLOSED']},
  PROBLEM:{summary:'Encontrar la causa de incidentes repetidos y su corrección definitiva.',evidence:['Incidentes vinculados','Causa raíz','Solución temporal o error conocido','Solución definitiva y cambio relacionado'],rules:['La investigación requiere al menos un incidente vinculado.','El cambio puede documentar la corrección.'],route:['SUBMITTED','INVESTIGATING','WORKAROUND','KNOWN_ERROR','DEFINITIVE_SOLUTION','RESOLVED','CLOSED']},
  ACCESS:{summary:'Autorizar y comprobar la provisión o revocación de un acceso.',evidence:['Beneficiario, recurso y permiso','Aprobación o rechazo','Resultado de provisión o revocación y validación'],rules:['El solicitante no puede autoaprobarse.','No se resuelve antes de validar el resultado.'],route:['SUBMITTED','PENDING_APPROVAL','APPROVED','PROVISIONING','VALIDATING','RESOLVED','CLOSED']},
  TECH_SERVICE:{summary:'Atender una prestación de un servicio que ya existe en el catálogo.',evidence:['Servicio existente y prestación solicitada','Asignación y cumplimiento','Confirmación del solicitante'],rules:['Se distingue de proponer un servicio nuevo.','La asignación requiere un agente autorizado.'],route:['SUBMITTED','VALIDATING','ASSIGNED','FULFILLING','CONFIRMING','RESOLVED','CLOSED']},
};

export function ProcessesPage({ onOpenTickets }: { onOpenTickets: (process: string) => void }) {
  const stateLabels: Record<string,string> = { IMPLEMENTING:'Implementación', RISK_ASSESSMENT:'Evaluación de riesgo', PROVISIONING:'Provisión o revocación', ASSIGNED:'Asignado', WORKAROUND:'Solución temporal', KNOWN_ERROR:'Error conocido', DEFINITIVE_SOLUTION:'Solución definitiva' };
  const [queues,setQueues] = useState<Queue[]>([]);
  const [error,setError] = useState('');
  const [selected,setSelected] = useState('NEW_SERVICE');
  useEffect(() => { api<Queue[]>('/desk/queues').then(setQueues).catch((err) => setError(message(err))); }, []);
  const guide = processGuide[selected];
  const related = queues.filter((queue) => queue.process === selected);
  return <div className="page process-page">
    <div className="page-heading"><div><p className="eyebrow">Service Desk</p><h1>Siete procesos de atención</h1><p className="muted">Elige un proceso para ver su recorrido, las evidencias exigidas y sus colas configuradas.</p></div></div>
    {error && <div className="alert error">{error}</div>}
    <div className="process-layout"><nav className="process-list" aria-label="Seleccionar proceso">{Object.keys(processGuide).map((key) => <button key={key} className={selected===key?'process-choice selected':'process-choice'} aria-current={selected===key?'true':undefined} onClick={() => setSelected(key)}><strong>{label(key)}</strong><small>{queues.filter((queue) => queue.process===key && queue.active).length} cola(s) activa(s)</small></button>)}</nav>
      <section className="panel process-detail"><p className="eyebrow">Proceso · {label(selected)}</p><h2>{label(selected)}</h2><p className="muted">{guide.summary}</p><div className="process-columns"><div><h3>Ruta principal</h3><ol className="process-steps">{guide.route.map((state,index) => <li key={`${state}-${index}`}>{stateLabels[state] ?? label(state)}</li>)}</ol><p className="muted">Puede haber rutas alternativas de rechazo, escalamiento o reapertura según el caso.</p></div><div><h3>Evidencias y datos</h3><ul>{guide.evidence.map((item) => <li key={item}>{item}</li>)}</ul><h3>Reglas para avanzar</h3><ul>{guide.rules.map((item) => <li key={item}>{item}</li>)}</ul></div></div>
        <div className="desk-section"><h3>Colas de este proceso</h3>{related.length ? <div className="process-queues">{related.map((queue) => <span className="badge" key={queue.id}>{queue.code} · {queue.name} · nivel {queue.support_level}{queue.active?'':' · inactiva'}</span>)}</div> : <p className="muted">No hay colas visibles para esta cuenta.</p>}</div>
        <p className="muted">Esta vista explica los flujos. Las transiciones, permisos y validaciones efectivas se comprueban en el servidor al operar un ticket.</p><button className="primary" onClick={() => onOpenTickets(selected)}>Abrir tickets de {label(selected)}</button>
      </section></div>
  </div>;
}

export function KnowledgePage({ user }: { user: Account }) {
  const [rows,setRows] = useState<Array<{id:number;title:string;body:string;serviceCode:string|null}>>([]);
  const [title,setTitle] = useState(''); const [body,setBody] = useState(''); const [error,setError] = useState('');
  async function load() {try {setRows(await api<typeof rows>('/desk/knowledge'));}catch(e){setError(message(e));}}
  useEffect(() => {void load();},[]);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">Autoservicio · nivel 0</p><h1>Base de conocimientos</h1><p className="muted">Guías y respuestas para resolver consultas frecuentes.</p></div></div>{error && <div className="alert error">{error}</div>}<div className="desk-article-grid">{rows.map((row) => <article className="panel" key={row.id}><h2>{row.title}</h2><p className="muted">{row.body}</p>{row.serviceCode && <span className="badge">{row.serviceCode}</span>}</article>)}</div>{rows.length===0 && <p className="empty">Aún no hay artículos publicados.</p>}{isAdmin(user) && <section className="panel desk-section"><h2>Publicar artículo</h2><form className="stack-form" onSubmit={async(e) => {e.preventDefault();try {await post('/desk/knowledge',{title,body});setTitle('');setBody('');await load();}catch(err){setError(message(err));}}}><label>Título<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label><label>Contenido<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} required /></label><button className="primary">Publicar</button></form></section>}</div>;
}

function QueueGrants({ queue }: { queue: Queue }) {
  type Grant = { id: number; role: string | null; userId: number | null; userName: string | null; canView: boolean; canHandle: boolean; canTransfer: boolean; canApprove: boolean; canAdmin: boolean; expiresOn: string };
  const [grants,setGrants] = useState<Grant[]>([]);
  const [users,setUsers] = useState<Array<{id:number;name:string;role:string;roles:string[]}>>([]);
  const [target,setTarget] = useState('AGENTE');
  const [expiresOn,setExpiresOn] = useState('2026-12-31');
  const [flags,setFlags] = useState<Record<string,boolean>>({canView:true,canHandle:false,canTransfer:false,canApprove:false,canAdmin:false});
  const [error,setError] = useState('');
  async function load() {try {setGrants(await api<Grant[]>(`/desk/queues/${queue.id}/grants`));}catch(e){setError(message(e));}}
  useEffect(() => {void load();api<typeof users>('/desk/users').then((rows) => setUsers(rows.filter((u) => !u.roles.includes('CONSULTA')))).catch((e) => setError(message(e)));},[queue.id]);
  async function add(event:FormEvent) {event.preventDefault();setError('');try {await post(`/desk/queues/${queue.id}/grants`,{
    ...(target.startsWith('U:') ? {userId:Number(target.slice(2))} : {role:target}),...flags,expiresOn,
  });await load();}catch(e){setError(message(e));}}
  return <section className="panel desk-section"><h2>Permisos de {queue.name}</h2><p className="muted">Consultar, atender, transferir, aprobar y administrar son permisos separados. Cada concesión tiene fecha de caducidad.</p>{error && <div className="alert error">{error}</div>}<div className="table-wrap"><table><thead><tr><th>Rol o usuario</th><th>Consultar</th><th>Atender</th><th>Transferir</th><th>Aprobar</th><th>Administrar</th><th>Caduca</th><th>Acción</th></tr></thead><tbody>{grants.map((g) => <tr key={g.id}><td>{g.role ?? g.userName}</td>{(['canView','canHandle','canTransfer','canApprove','canAdmin'] as const).map((key) => <td key={key}>{g[key]?'Sí':'—'}</td>)}<td>{g.expiresOn}</td><td>{g.userId === queue.responsible_user_id && queue.active ? <span className="muted">Responsable</span> : <button className="text-button danger-text" onClick={async() => {try {await api(`/desk/queues/${queue.id}/grants/${g.id}`,{method:'DELETE'});await load();}catch(e){setError(message(e));}}}>Retirar</button>}</td></tr>)}</tbody></table></div><form className="desk-category-form" onSubmit={add}><label>Rol o usuario<select value={target} onChange={(e) => setTarget(e.target.value)}><option value="AGENTE">Rol agente</option><option value="APROBADOR">Rol aprobador</option>{users.map((u) => <option key={u.id} value={`U:${u.id}`}>{u.name} · usuario</option>)}</select></label><label>Caduca el<input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} required /></label><div className="desk-checks">{([['canView','Consultar'],['canHandle','Atender'],['canTransfer','Transferir'],['canApprove','Aprobar'],['canAdmin','Administrar']] as const).map(([key,text]) => <label key={key}><input type="checkbox" checked={flags[key]} onChange={(e) => setFlags({...flags,[key]:e.target.checked})} />{text}</label>)}</div><button className="secondary">Guardar permisos</button></form></section>;
}

function QueueEditor({ queue, onCancel, onSaved }: { queue: Queue; onCancel: () => void; onSaved: () => void }) {
  const [name,setName] = useState(queue.name);
  const [description,setDescription] = useState(queue.description ?? '');
  const [process,setProcess] = useState(queue.process);
  const [responsibleUserId,setResponsibleUserId] = useState(String(queue.responsible_user_id));
  const [sortRule,setSortRule] = useState(queue.sort_rule);
  const [users,setUsers] = useState<Array<{id:number;name:string;roles:string[]}>>([]);
  const [supportLevel,setSupportLevel] = useState(String(queue.support_level));
  const [firstMinutes,setFirstMinutes] = useState(String(queue.first_response_minutes ?? ''));
  const [resolutionMinutes,setResolutionMinutes] = useState(String(queue.resolution_minutes ?? ''));
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  useEffect(() => {api<typeof users>('/desk/users').then((rows) => setUsers(rows.filter((u) => !u.roles.includes('CONSULTA') && (u.roles.includes('AGENTE') || u.roles.includes('ADMIN'))))).catch((e) => setError(message(e)));},[]);
  async function save(event:FormEvent) {
    event.preventDefault();setError('');setSaving(true);
    try {await patch(`/desk/queues/${queue.id}`,{name,description,process,responsibleUserId:Number(responsibleUserId),sortRule,supportLevel:Number(supportLevel),
      firstResponseMinutes:firstMinutes?Number(firstMinutes):null,
      resolutionMinutes:resolutionMinutes?Number(resolutionMinutes):null});onSaved();}
    catch(e){setError(message(e));}finally{setSaving(false);}
  }
  return <div className="modal-backdrop" onClick={onCancel}><section className="modal-card desk-detail" role="dialog" aria-modal="true" aria-label={`Editar cola ${queue.code}`} onClick={(e)=>e.stopPropagation()}>
    <div className="drawer-head"><h2>Editar cola {queue.code}</h2><button className="icon-button" onClick={onCancel} aria-label="Cerrar">×</button></div>
    <form className="form-grid" onSubmit={save}>
      <label>Nombre<input value={name} onChange={(e)=>setName(e.target.value)} required /></label>
      <label>Proceso<select value={process} onChange={(e)=>setProcess(e.target.value)}>{Object.keys(transitions).map((key) => <option key={key} value={key}>{label(key)}</option>)}</select></label>
      <label>Responsable<select value={responsibleUserId} onChange={(e)=>setResponsibleUserId(e.target.value)} required><option value="">Selecciona</option>{users.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <label>Regla de orden<select value={sortRule} onChange={(e)=>setSortRule(e.target.value)}><option value="PRIORITY_AGE">Prioridad y antigüedad</option><option value="AGE_PRIORITY">Antigüedad y prioridad</option></select></label>
      <label>Nivel de soporte<input type="number" min="0" max="4" value={supportLevel} onChange={(e)=>setSupportLevel(e.target.value)} required /></label>
      <label>Primera respuesta (min)<input type="number" min="1" value={firstMinutes} onChange={(e)=>setFirstMinutes(e.target.value)} /></label>
      <label>Resolución (min)<input type="number" min="1" value={resolutionMinutes} onChange={(e)=>setResolutionMinutes(e.target.value)} /></label>
      <label className="wide">Descripción<textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={3} /></label>
      <p className="muted wide">Si la cola ya tiene tickets, su proceso no puede cambiarse.</p>
      {error && <div className="alert error wide">{error}</div>}
      <div className="wide modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>Guardar cambios</button></div>
    </form>
  </section></div>;
}

export function QueuesPage({ user }: { user: Account }) {
  const [rows,setRows] = useState<Queue[]>([]);
  const [users,setUsers] = useState<Array<{id:number;name:string;roles:string[]}>>([]);
  const [error,setError] = useState('');
  const [code,setCode] = useState('');
  const [name,setName] = useState('');
  const [description,setDescription] = useState('');
  const [process,setProcess] = useState('INCIDENT');
  const [responsibleUserId,setResponsibleUserId] = useState('');
  const [sortRule,setSortRule] = useState('PRIORITY_AGE');
  const [supportLevel,setSupportLevel] = useState('1');
  const [firstMinutes,setFirstMinutes] = useState('60');
  const [resolutionMinutes,setResolutionMinutes] = useState('480');
  const [selected,setSelected] = useState<Queue | null>(null);
  const [editing,setEditing] = useState<Queue | null>(null);
  async function load() {try {setRows(await api<Queue[]>('/desk/queues'));}catch(e){setError(message(e));}}
  useEffect(() => {void load();},[]);
  useEffect(() => {if (isAdmin(user)) api<typeof users>('/desk/users').then((rows) => setUsers(rows.filter((person) => !person.roles.includes('CONSULTA') && (person.roles.includes('AGENTE') || person.roles.includes('ADMIN'))))).catch((e) => setError(message(e)));},[user.role]);
  const canManage = (queue: Queue) => canWrite(user) && (isAdmin(user) || queue.canAdmin);
  async function create(event: FormEvent) {
    event.preventDefault();setError('');
    try {
      await post('/desk/queues',{code,name,description,process,responsibleUserId:Number(responsibleUserId),sortRule,
        supportLevel:Number(supportLevel),firstResponseMinutes:Number(firstMinutes),resolutionMinutes:Number(resolutionMinutes)});
      setCode('');setName('');setDescription('');await load();
    } catch (e) {setError(message(e));}
  }
  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">Distribución</p><h1>Colas de atención</h1><p className="muted">Cada cola pertenece a un proceso y tiene responsable, orden y permisos propios.</p></div></div>
    {error && <div className="alert error">{error}</div>}
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>Código</th><th>Cola</th><th>Proceso</th><th>Responsable</th><th>Orden</th><th>Nivel</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}>
      <td>{row.code}</td><td><strong>{row.name}</strong>{row.description && <small className="muted">{row.description}</small>}</td><td>{label(row.process)}</td><td>{row.responsibleName}</td><td>{sortRuleLabel(row.sort_rule)}</td><td>{row.support_level}</td><td>{row.active?'Activa':'Inactiva'}</td>
      <td>{canManage(row) && <div className="button-row"><button className="text-button" onClick={() => setEditing(row)}>Editar</button><button className="text-button" onClick={() => setSelected(row)}>Permisos</button><button className="text-button" onClick={async() => {try {await patch(`/desk/queues/${row.id}`,{active:!row.active});await load();}catch(e){setError(message(e));}}}>{row.active?'Desactivar':'Activar'}</button></div>}</td>
    </tr>)}</tbody></table></div></section>
    {selected && canManage(selected) && <QueueGrants queue={selected} />}
    {editing && canManage(editing) && <QueueEditor queue={editing} onCancel={() => setEditing(null)} onSaved={() => {setEditing(null);void load();}} />}
    {isAdmin(user) && <section className="panel desk-section"><h2>Crear cola</h2><form className="desk-category-form" onSubmit={create}>
      <label>Código<input value={code} onChange={(e) => setCode(e.target.value)} required /></label>
      <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>Descripción<input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label>Proceso<select value={process} onChange={(e) => setProcess(e.target.value)}>{Object.keys(transitions).map((key) => <option key={key} value={key}>{label(key)}</option>)}</select></label>
      <label>Responsable<select value={responsibleUserId} onChange={(e) => setResponsibleUserId(e.target.value)} required><option value="">Selecciona</option>{users.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <label>Regla de orden<select value={sortRule} onChange={(e) => setSortRule(e.target.value)}><option value="PRIORITY_AGE">Prioridad y antigüedad</option><option value="AGE_PRIORITY">Antigüedad y prioridad</option></select></label>
      <label>Nivel de soporte<input type="number" min="0" max="4" value={supportLevel} onChange={(e) => setSupportLevel(e.target.value)} required /></label>
      <label>Primera respuesta (min)<input type="number" min="1" value={firstMinutes} onChange={(e) => setFirstMinutes(e.target.value)} required /></label>
      <label>Resolución (min)<input type="number" min="1" value={resolutionMinutes} onChange={(e) => setResolutionMinutes(e.target.value)} required /></label>
      <button className="primary">Crear cola</button>
    </form></section>}
  </div>;
}
