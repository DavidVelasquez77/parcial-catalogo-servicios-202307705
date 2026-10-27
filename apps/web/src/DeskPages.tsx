import { useEffect, useState, type FormEvent } from 'react';
import { api, patch, post } from './api';

type Account = { id: number; role: string; roles?: string[] };
type Page<T> = { data: T[]; total: number; page: number; pageSize: number };
type Queue = { id: number; code: string; name: string; description: string | null; process: string; active: boolean; canHandle: boolean; support_level: number; first_response_minutes: number | null; resolution_minutes: number | null };
type Ticket = { id: number; number: string; title: string; state: string; process: string; priority: number; queueId: number; queueName: string; createdAt: string; assignedUserId: number | null };
type TicketDetail = Record<string, unknown> & {
  id: number; number: string; title: string; description: string; state: string; process: string;
  queue_id: number; requester_id: number; assigned_user_id: number | null; process_data: Record<string, unknown>;
  service_name: string; level_1_name: string; no_ci_reason: string | null; paused_at: string | null;
  history: Array<{ id: number; action: string; actor_id: number; created_at: string; reason: string | null; old_values: unknown; new_values: unknown }>;
  comments: Array<{ id: number; body: string; visibility: string; author_id: number; created_at: string }>;
  ci: Array<{ id: number; code: string; name: string }>;
  links: Array<{ ticket_id: number; related_ticket_id: number; link_type: string }>;
  attachments: Array<{ id: number; originalName: string; sizeBytes: number }>;
};
type Ci = { id: number; code: string; name: string; categoryName: string; status: string; location: string };
type Category = { id: number; code: string; name: string; parentId: number | null; sourceKind: string; active: boolean };
type CiLocation = { id: number; code: string; name: string; active: boolean };
type Service = { id: number; code: string; name: string; status: string };
const names: Record<string,string> = { NEW_SERVICE:'Nuevos servicios', CHANGE:'Cambios', INCIDENT:'Incidentes', EVENT:'Eventos', PROBLEM:'Problemas', ACCESS:'Accesos', TECH_SERVICE:'Servicios de tecnología', SUBMITTED:'Registrado', ANALYSIS:'Análisis', PENDING_APPROVAL:'Pendiente de aprobación', APPROVED:'Aprobado', REJECTED:'Rechazado', RESOLVED:'Resuelto', CLOSED:'Cerrado', CLASSIFIED:'Clasificado', EVALUATED:'Evaluado', RESPONDED:'Respuesta', DIAGNOSING:'Diagnóstico', IN_PROGRESS:'En atención', ESCALATED:'Escalado', INVESTIGATING:'Investigación', VALIDATING:'Validación', EXECUTING:'Ejecución', PLANNED:'Planificado', FULFILLING:'Cumplimiento', CONFIRMING:'Confirmación' };
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
const processFields: Record<string,Array<[string,string,'text'|'number'|'boolean'|'category']>> = {
  NEW_SERVICE: [['need','Necesidad','text'],['feasibility','Viabilidad','text'],['proposedCode','Código propuesto','text'],['proposedName','Nombre propuesto','text'],['linkedServiceId','ID de servicio existente','number']],
  CHANGE: [['riskAssessment','Impacto y riesgo','text'],['testPlan','Plan de pruebas','text'],['rollbackPlan','Plan de reversión','text'],['executionResult','Resultado de ejecución','text']],
  INCIDENT: [['incidentCategory','Categoría I0–I6','category'],['estimatedMinutes','Duración estimada (min)','number'],['actualMinutes','Duración real (min)','number'],['redundancyAvailable','Redundancia disponible','boolean'],['solution','Solución aplicada','text']],
  EVENT: [['eventCategory','Categoría E0–E3','category'],['assessment','Evaluación','text'],['response','Respuesta','text']],
  PROBLEM: [['rootCause','Causa raíz','text'],['workaround','Solución temporal','text'],['knownError','Error conocido','text'],['definitiveSolution','Solución definitiva','text']],
  ACCESS: [['resource','Recurso','text'],['permission','Permiso','text'],['accessAction','Provisión o revocación','text'],['validation','Validación','text']],
  TECH_SERVICE: [['request','Prestación solicitada','text'],['delivery','Cumplimiento','text'],['confirmation','Confirmación','text']],
};
const date = (value: string) => new Date(value).toLocaleString('es-GT');
const message = (error: unknown) => error instanceof Error ? error.message : 'No fue posible completar la operación.';
const canWrite = (user: Account) => !(user.roles ?? [user.role]).includes('CONSULTA');
const isAdmin = (user: Account) => (user.roles ?? [user.role]).includes('ADMIN');

function TicketCreate({ queues, onDone, onCancel }: { queues: Queue[]; onDone: () => void; onCancel: () => void }) {
  const [services,setServices] = useState<Service[]>([]);
  const [users,setUsers] = useState<Array<{id:number;name:string;active:boolean}>>([]);
  const [queueId,setQueueId] = useState(String(queues.find((q) => q.active)?.id ?? ''));
  const [serviceId,setServiceId] = useState('');
  const [title,setTitle] = useState('');
  const [description,setDescription] = useState('');
  const [noCiReason,setNoCiReason] = useState('No aplica un dispositivo concreto a este trámite.');
  const [category,setCategory] = useState('');
  const [beneficiaryId,setBeneficiaryId] = useState('');
  const [resource,setResource] = useState('');
  const [permission,setPermission] = useState('');
  const [priority,setPriority] = useState('3');
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
    if (process === 'ACCESS') { processData.resource = resource; processData.permission = permission; }
    if (process === 'NEW_SERVICE') Object.assign(processData,{need:extra.need,feasibility:extra.feasibility,
      ...(extra.linkedServiceId ? {linkedServiceId:Number(extra.linkedServiceId)} : {proposedCode:extra.proposedCode,proposedName:extra.proposedName})});
    if (process === 'CHANGE') Object.assign(processData,{riskAssessment:extra.riskAssessment,testPlan:extra.testPlan,rollbackPlan:extra.rollbackPlan});
    if (process === 'PROBLEM') Object.assign(processData,{rootCause:extra.rootCause ?? '',workaround:extra.workaround ?? ''});
    if (process === 'TECH_SERVICE') processData.request = extra.request ?? description;
    if (process === 'INCIDENT') Object.assign(processData,{estimatedMinutes:extra.estimatedMinutes?Number(extra.estimatedMinutes):null,
      redundancyAvailable:extra.redundancyAvailable==='yes',interruptsOrDegrades:extra.interruptsOrDegrades==='yes'});
    try {
      await post('/desk/tickets',{ queueId:Number(queueId),serviceId:Number(serviceId),title,description,
        priority:Number(priority),impact:3,urgency:3,ciIds,noCiReason:ciIds.length?undefined:noCiReason,processData,
        ...(process === 'ACCESS' ? { beneficiaryId:Number(beneficiaryId) } : {}) });
      onDone();
    } catch (e) { setError(message(e)); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onClick={onCancel}><section className="modal-card" role="dialog" aria-modal="true" aria-label="Nuevo ticket" onClick={(e) => e.stopPropagation()}><div className="drawer-head"><h2>Nuevo ticket</h2><button className="icon-button" onClick={onCancel} aria-label="Cerrar">×</button></div><form className="stack-form" onSubmit={submit}>
    <label>Cola y proceso<select value={queueId} onChange={(e) => {setQueueId(e.target.value);setCategory('');}} required>{queues.filter((q) => q.active).map((q) => <option key={q.id} value={q.id}>{q.name} · {label(q.process)}</option>)}</select></label>
    <label>Servicio existente<select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required><option value="">Selecciona un servicio</option>{services.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></label>
    <label>Título<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={240} required /></label>
    <label>Descripción<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required /></label>
    <label>Prioridad<select value={priority} onChange={(e) => setPriority(e.target.value)}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} · {n===5?'Muy alta':n===1?'Muy baja':'Nivel '+n}</option>)}</select></label>
    {(process === 'EVENT' || process === 'INCIDENT') && <label>Categoría<select value={category} onChange={(e) => setCategory(e.target.value)} required><option value="">Selecciona</option>{(process === 'EVENT' ? ['E0','E1','E2','E3'] : ['I0','I1','I2','I3','I4','I5','I6']).map((x) => <option key={x}>{x}</option>)}</select></label>}
    {process === 'INCIDENT' && <><label>Duración estimada (minutos)<input type="number" min="0" value={extra.estimatedMinutes ?? ''} onChange={(e) => change('estimatedMinutes',e.target.value)} /></label><label>¿Interrupción o degradación?<select value={extra.interruptsOrDegrades ?? ''} onChange={(e) => change('interruptsOrDegrades',e.target.value)}><option value="">Por evaluar</option><option value="yes">Sí</option><option value="no">No</option></select></label><label>¿Redundancia disponible?<select value={extra.redundancyAvailable ?? ''} onChange={(e) => change('redundancyAvailable',e.target.value)}><option value="">No informada</option><option value="yes">Sí</option><option value="no">No</option></select></label></>}
    {process === 'NEW_SERVICE' && <><label>Necesidad<input value={extra.need ?? ''} onChange={(e) => change('need',e.target.value)} required /></label><label>Viabilidad preliminar<input value={extra.feasibility ?? ''} onChange={(e) => change('feasibility',e.target.value)} required /></label><label>Vincular servicio existente<select value={extra.linkedServiceId ?? ''} onChange={(e) => change('linkedServiceId',e.target.value)}><option value="">Crear servicio nuevo tras aprobación</option>{services.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></label>{!extra.linkedServiceId && <><label>Código propuesto<input value={extra.proposedCode ?? ''} onChange={(e) => change('proposedCode',e.target.value)} required /></label><label>Nombre propuesto<input value={extra.proposedName ?? ''} onChange={(e) => change('proposedName',e.target.value)} required /></label></>}</>}
    {process === 'CHANGE' && <><label>Impacto y riesgo<textarea value={extra.riskAssessment ?? ''} onChange={(e) => change('riskAssessment',e.target.value)} required /></label><label>Plan de pruebas<textarea value={extra.testPlan ?? ''} onChange={(e) => change('testPlan',e.target.value)} required /></label><label>Plan de reversión<textarea value={extra.rollbackPlan ?? ''} onChange={(e) => change('rollbackPlan',e.target.value)} required /></label></>}
    {process === 'PROBLEM' && <><label>Causa raíz preliminar<input value={extra.rootCause ?? ''} onChange={(e) => change('rootCause',e.target.value)} /></label><label>Solución temporal<input value={extra.workaround ?? ''} onChange={(e) => change('workaround',e.target.value)} /></label></>}
    {process === 'TECH_SERVICE' && <label>Prestación solicitada<input value={extra.request ?? ''} onChange={(e) => change('request',e.target.value)} required /></label>}
    {process === 'ACCESS' && <><label>Beneficiario<select value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)} required><option value="">Selecciona</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Recurso<input value={resource} onChange={(e) => setResource(e.target.value)} required /></label><label>Permiso solicitado<input value={permission} onChange={(e) => setPermission(e.target.value)} required /></label></>}
    <label>Buscar CI relacionado<input value={ciSearch} onChange={(e) => setCiSearch(e.target.value)} placeholder="Escribe al menos dos letras o parte del código" /></label>{ciOptions.length>0 && <div className="desk-search-options">{ciOptions.map((ci) => <button type="button" className="secondary" key={ci.id} onClick={() => {if(!ciIds.includes(Number(ci.id)))setCiIds([...ciIds,Number(ci.id)]);setCiSearch('');}}>{ci.code} · {ci.name}</button>)}</div>}
    {ciIds.length>0 && <p className="muted">{ciIds.length} CI seleccionado(s). <button type="button" className="text-button" onClick={() => setCiIds([])}>Quitar todos</button></p>}
    {ciIds.length===0 && <label>Motivo por el que no se asocia CI<input value={noCiReason} onChange={(e) => setNoCiReason(e.target.value)} required={process!=='CHANGE'} /></label>}
    {process==='CHANGE' && ciIds.length===0 && <p className="alert error">Un cambio necesita al menos un CI afectado.</p>}
    {error && <div className="alert error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving || (process==='CHANGE' && ciIds.length===0)}>{saving?'Guardando...':'Crear ticket'}</button></div>
  </form></section></div>;
}

function TicketView({ id, user, queues, onClose, onChanged }: { id: number; user: Account; queues: Queue[]; onClose: () => void; onChanged: () => void }) {
  const [ticket,setTicket] = useState<TicketDetail | null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [reason,setReason] = useState('');
  const [comment,setComment] = useState('');
  const [visibility,setVisibility] = useState('PUBLIC');
  const [processValues,setProcessValues] = useState<Record<string,unknown>>({});
  const [destination,setDestination] = useState('');
  const [file,setFile] = useState<File | null>(null);
  const [ciSearch,setCiSearch] = useState('');
  const [ciOptions,setCiOptions] = useState<Ci[]>([]);
  const [relatedId,setRelatedId] = useState('');
  const [linkType,setLinkType] = useState('RELATED');
  async function load() { try { const row = await api<TicketDetail>(`/desk/tickets/${id}`); setTicket(row); setProcessValues(row.process_data); } catch (e) { setError(message(e)); } }
  useEffect(() => { void load(); }, [id]);
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
  const options = ticket ? [...(transitions[ticket.process]?.[ticket.state] ?? []),...(ticket.state === 'CLOSED' ? ['SUBMITTED'] : [])] : [];
  const staff = ticket && (isAdmin(user) || queues.find((q) => q.id === ticket.queue_id)?.canHandle);
  return <div className="modal-backdrop" onClick={onClose}><section className="modal-card desk-detail" role="dialog" aria-modal="true" aria-label="Ficha de ticket" onClick={(e) => e.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">FICHA DE TICKET</p><h2>{ticket?.number ?? 'Cargando...'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar">×</button></div>
    {error && <div className="alert error">{error}</div>}
    {ticket && <><h3>{ticket.title}</h3><p className="muted">{ticket.description}</p><div className="desk-facts"><span><strong>Proceso</strong>{label(ticket.process)}</span><span><strong>Estado</strong>{label(ticket.state)}</span><span><strong>Servicio</strong>{ticket.service_name}</span><span><strong>Nivel 1</strong>{ticket.level_1_name}</span><span><strong>Prioridad</strong>{String(ticket.priority)}</span><span><strong>Cola</strong>{String(ticket.queue_name)}</span><span><strong>Asignado</strong>{ticket.assigned_user_id ?? 'Sin asignar'}</span><span><strong>CI</strong>{ticket.ci.length ? ticket.ci.map((ci) => ci.code).join(', ') : ticket.no_ci_reason ?? 'Sin CI'}</span></div>
      <section className="desk-section"><h3>Acciones</h3><label>Motivo o solución<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Obligatorio al resolver, rechazar o reabrir" /></label><div className="button-row desk-actions">{staff && !ticket.assigned_user_id && canWrite(user) && <button className="secondary" disabled={busy} onClick={() => void action('claim',{})}>Tomar ticket</button>}{options.filter((to) => to !== 'APPROVED' && to !== 'REJECTED' || isAdmin(user) || (user.roles ?? [user.role]).includes('APROBADOR')).map((to) => <button key={to} className={to==='CLOSED'?'primary':'secondary'} disabled={busy || !canWrite(user)} onClick={() => void action('transition',{to,reason})}>{label(to)}</button>)}{staff && !ticket.paused_at && <button className="secondary" disabled={busy} onClick={() => void action('pause',{reason})}>Pausar</button>}{staff && !!ticket.paused_at && <button className="secondary" disabled={busy} onClick={() => void action('resume',{reason})}>Reanudar</button>}</div></section>
      {staff && <section className="desk-section"><h3>Datos de {label(ticket.process)}</h3><p className="muted">Completa las evidencias necesarias antes de avanzar el proceso.</p><div className="form-grid">{(processFields[ticket.process] ?? []).map(([key,title,kind]) => <label key={key}>{title}{kind==='boolean'?<select value={processValues[key]===true?'true':processValues[key]===false?'false':''} onChange={(e) => setProcessValues({...processValues,[key]:e.target.value===''?null:e.target.value==='true'})}><option value="">No informado</option><option value="true">Sí</option><option value="false">No</option></select>:kind==='category'?<select value={String(processValues[key] ?? '')} onChange={(e) => setProcessValues({...processValues,[key]:e.target.value})}>{(ticket.process==='EVENT'?['E0','E1','E2','E3']:['I0','I1','I2','I3','I4','I5','I6']).map((item) => <option key={item} value={item}>{item}</option>)}</select>:<input type={kind==='number'?'number':'text'} value={String(processValues[key] ?? '')} onChange={(e) => setProcessValues({...processValues,[key]:kind==='number'?(e.target.value===''?null:Number(e.target.value)):e.target.value})} />}</label>)}</div><div className="button-row desk-actions"><button className="secondary" disabled={busy} onClick={async () => {try {setBusy(true);await patch(`/desk/tickets/${id}/process-data`,processValues);await load();}catch(e){setError(message(e));}finally{setBusy(false);}}}>Guardar datos</button></div></section>}
      {staff && <section className="desk-section"><h3>Transferir</h3><div className="button-row"><select value={destination} onChange={(e) => setDestination(e.target.value)}><option value="">Cola destino</option>{queues.filter((q) => q.process===ticket.process && q.id!==ticket.queue_id && q.active).map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select><button className="secondary" disabled={busy || !destination} onClick={() => void action('transfer',{queueId:Number(destination),reason})}>Transferir</button></div></section>}
      <section className="desk-section"><h3>Conversación</h3>{ticket.comments.map((item) => <article className="desk-note" key={item.id}><small>{item.visibility==='INTERNAL'?'Nota interna':'Comentario público'} · {date(item.created_at)}</small><p>{item.body}</p></article>)}{canWrite(user) && <div className="stack-form"><label>Nuevo comentario<textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} /></label>{staff && <label>Visibilidad<select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="PUBLIC">Visible al solicitante</option><option value="INTERNAL">Nota interna</option></select></label>}<button className="secondary" disabled={busy || !comment.trim()} onClick={() => void action('comments',{body:comment,visibility})}>Enviar comentario</button></div>}</section>
      <section className="desk-section"><h3>Evidencias</h3>{ticket.attachments.map((item) => <p key={item.id}><a href={`/api/desk/tickets/${id}/attachments/${item.id}`}>{item.originalName}</a> <small>({Math.ceil(item.sizeBytes/1024)} KB)</small></p>)}{canWrite(user) && <div className="button-row"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><button className="secondary" disabled={busy || !file} onClick={() => void upload()}>Adjuntar</button></div>}</section>
      <section className="desk-section"><h3>Bitácora</h3>{ticket.history.map((item) => <article className="desk-note" key={item.id}><strong>{label(item.action)}</strong><small> · {date(item.created_at)} · actor #{item.actor_id}</small>{item.reason && <p>{item.reason}</p>}</article>)}</section>
      <section className="desk-section"><h3>CI afectados</h3>{ticket.ci.map((ci) => <p key={ci.id}>{ci.code} · {ci.name}</p>)}{staff && <><label>Buscar CI para vincular<input value={ciSearch} onChange={(e) => setCiSearch(e.target.value)} placeholder="Código o nombre" /></label>{ciOptions.length>0 && <div className="desk-search-options">{ciOptions.map((ci) => <button className="secondary" key={ci.id} disabled={busy} onClick={() => {void action('ci',{ciId:Number(ci.id)});setCiSearch('');}}>{ci.code} · {ci.name}</button>)}</div>}</>}</section>
      <section className="desk-section"><h3>Tickets relacionados</h3>{ticket.links.length ? ticket.links.map((link,index) => <p key={index}>{link.link_type}: #{String(link.ticket_id)===String(ticket.id)?link.related_ticket_id:link.ticket_id}</p>) : <p className="muted">Sin relaciones.</p>}{staff && <div className="desk-category-form"><label>ID del ticket relacionado<input type="number" min="1" value={relatedId} onChange={(e) => setRelatedId(e.target.value)} /></label><label>Relación<select value={linkType} onChange={(e) => setLinkType(e.target.value)}><option value="RELATED">Relacionado</option><option value="CAUSED_BY">Causado por</option><option value="IMPLEMENTS">Implementa</option><option value="DUPLICATE_OF">Duplicado de</option></select></label><button className="secondary" disabled={busy || !relatedId} onClick={() => {void action('links',{relatedTicketId:Number(relatedId),linkType});setRelatedId('');}}>Vincular</button></div>}</section>
    </>}
  </section></div>;
}

export function TicketsPage({ user }: { user: Account }) {
  const [queues,setQueues] = useState<Queue[]>([]);
  const [services,setServices] = useState<Service[]>([]);
  const [users,setUsers] = useState<Array<{id:number;name:string}>>([]);
  const [rows,setRows] = useState<Page<Ticket> | null>(null);
  const [search,setSearch] = useState('');
  const [process,setProcess] = useState('');
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
  async function load() {try {const params = new URLSearchParams({page:String(page),pageSize:'20'});for(const [key,value] of Object.entries({search,process,state,queueId,priority,serviceId,assigneeId,from:fromDate,to:toDate})){if(value)params.set(key,value);}setRows(await api<Page<Ticket>>(`/desk/tickets?${params}`));}catch(e){setError(message(e));}}
  useEffect(() => {api<Queue[]>('/desk/queues').then(setQueues).catch((e) => setError(message(e)));},[]);
  useEffect(() => {api<Page<Service>>('/services?pageSize=100').then((result)=>setServices(result.data)).catch((e)=>setError(message(e)));api<Array<{id:number;name:string}>>('/desk/users').then(setUsers).catch((e)=>setError(message(e)));},[]);
  useEffect(() => {void load();},[page,process,state,queueId,priority,serviceId,assigneeId,fromDate,toDate]);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">SERVICE DESK</p><h1>Tickets</h1><p className="muted">Seguimiento por proceso, prioridad y cola de atención.</p></div>{canWrite(user) && <button className="primary" onClick={() => setCreating(true)}>Nuevo ticket</button>}</div>
    <div className="filters"><div className="search-input"><input aria-label="Buscar ticket" placeholder="Número o título" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => {if(e.key==='Enter'){setPage(1);void load();}}} /></div><select aria-label="Filtrar proceso" value={process} onChange={(e) => {setProcess(e.target.value);setPage(1);}}><option value="">Todos los procesos</option>{Object.keys(transitions).map((key) => <option key={key} value={key}>{label(key)}</option>)}</select><select aria-label="Filtrar estado" value={state} onChange={(e) => {setState(e.target.value);setPage(1);}}><option value="">Todos los estados</option>{['SUBMITTED','IN_PROGRESS','PENDING_APPROVAL','APPROVED','RESOLVED','CLOSED','REJECTED'].map((key) => <option key={key} value={key}>{label(key)}</option>)}</select><button className="secondary" onClick={() => {setPage(1);void load();}}>Buscar</button></div>
    <div className="filters desk-extra-filters"><select aria-label="Filtrar cola" value={queueId} onChange={(e)=>{setQueueId(e.target.value);setPage(1);}}><option value="">Todas las colas</option>{queues.map((q)=><option key={q.id} value={q.id}>{q.name}</option>)}</select><select aria-label="Filtrar servicio" value={serviceId} onChange={(e)=>{setServiceId(e.target.value);setPage(1);}}><option value="">Todos los servicios</option>{services.map((s)=><option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select><select aria-label="Filtrar prioridad" value={priority} onChange={(e)=>{setPriority(e.target.value);setPage(1);}}><option value="">Todas las prioridades</option>{[1,2,3,4,5].map((n)=><option key={n} value={n}>Prioridad {n}</option>)}</select><select aria-label="Filtrar responsable" value={assigneeId} onChange={(e)=>{setAssigneeId(e.target.value);setPage(1);}}><option value="">Todos los responsables</option>{users.map((u)=><option key={u.id} value={u.id}>{u.name}</option>)}</select><label>Desde<input type="date" value={fromDate} onChange={(e)=>{setFromDate(e.target.value);setPage(1);}} /></label><label>Antes de<input type="date" value={toDate} onChange={(e)=>{setToDate(e.target.value);setPage(1);}} /></label></div>
    {error && <div className="alert error">{error}</div>}<section className="panel"><div className="table-wrap"><table><thead><tr><th>Número</th><th>Título</th><th>Proceso</th><th>Cola</th><th>Estado</th><th>Prioridad</th><th>Creado</th></tr></thead><tbody>{rows?.data.map((row) => <tr className="clickable" key={row.id} onClick={() => setSelected(row.id)}><td><strong>{row.number}</strong></td><td>{row.title}</td><td>{label(row.process)}</td><td>{row.queueName}</td><td><span className="badge">{label(row.state)}</span></td><td>{row.priority}</td><td>{date(row.createdAt)}</td></tr>)}</tbody></table>{rows?.data.length===0 && <p className="empty">No hay tickets con esos filtros.</p>}</div><div className="pagination"><button className="secondary" disabled={page<=1} onClick={() => setPage(page-1)}>Anterior</button><span>Página {page} · {rows?.total ?? 0} tickets</span><button className="secondary" disabled={!rows || page*20>=rows.total} onClick={() => setPage(page+1)}>Siguiente</button></div></section>
    {creating && <TicketCreate queues={queues} onCancel={() => setCreating(false)} onDone={() => {setCreating(false);void load();}} />}
    {selected !== null && <TicketView id={selected} user={user} queues={queues} onClose={() => setSelected(null)} onChanged={() => void load()} />}
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
      serialNumber:form.serialNumber || null,version:form.version || null,
      securityLevel:form.securityLevel || null,complianceStatus:form.complianceStatus || null,
      configurationStatus:form.configurationStatus || null,licenseNumber:form.licenseNumber || null,
      licenseExpiresOn:form.licenseExpiresOn || null,isDevice:form.isDevice==='true',
      technicalAttributes:JSON.parse(form.technicalAttributes),
    };
    if(initial) await patch(`/cmdb/items/${initial.id}`,body); else await post('/cmdb/items',body);
    onSaved();
  }catch(e){setError(message(e));}finally{setSaving(false);}}
  return <div className="modal-backdrop" onClick={onCancel}><section className="modal-card desk-detail" role="dialog" aria-modal="true" aria-label={initial?'Editar CI':'Nuevo CI'} onClick={(e) => e.stopPropagation()}><div className="drawer-head"><h2>{initial?'Editar CI':'Nuevo CI'}</h2><button className="icon-button" onClick={onCancel} aria-label="Cerrar">×</button></div><form className="form-grid" onSubmit={submit}><label>Código<input value={form.code} onChange={(e) => change('code',e.target.value)} disabled={!!initial} required /></label><label>Nombre<input value={form.name} onChange={(e) => change('name',e.target.value)} required /></label><label>Categoría<select value={form.categoryId} onChange={(e) => change('categoryId',e.target.value)} required><option value="">Selecciona</option>{categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Estado<select value={form.status} onChange={(e) => change('status',e.target.value)}>{['ACTIVE','INACTIVE','MAINTENANCE','RETIRED','UNKNOWN'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></label><label>¿Cuenta como dispositivo?<select value={form.isDevice} onChange={(e) => change('isDevice',e.target.value)}><option value="true">Sí</option><option value="false">No, es otro CI</option></select></label><label>Ubicación controlada<select value={form.locationId} onChange={(e) => change('locationId',e.target.value)}><option value="">Usar texto libre del origen</option>{locations.filter((item)=>item.active).map((item)=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Ubicación escrita<input value={form.location} onChange={(e) => change('location',e.target.value)} disabled={!!form.locationId} required={!form.locationId} /></label><label>Usuario responsable<select value={form.responsibleUserId} onChange={(e) => change('responsibleUserId',e.target.value)}><option value="">Equipo o texto libre</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Equipo responsable<input value={form.responsibleLabel} onChange={(e) => change('responsibleLabel',e.target.value)} placeholder="Obligatorio si no eliges usuario" /></label><label>Número de serie<input value={form.serialNumber} onChange={(e) => change('serialNumber',e.target.value)} /></label><label>Versión<input value={form.version} onChange={(e) => change('version',e.target.value)} /></label><label>Nivel de seguridad<input value={form.securityLevel} onChange={(e) => change('securityLevel',e.target.value)} /></label><label>Cumplimiento<input value={form.complianceStatus} onChange={(e) => change('complianceStatus',e.target.value)} /></label><label>Estado de configuración<input value={form.configurationStatus} onChange={(e) => change('configurationStatus',e.target.value)} /></label><label>Licencia<input value={form.licenseNumber} onChange={(e) => change('licenseNumber',e.target.value)} /></label><label>Vencimiento de licencia<input type="date" value={form.licenseExpiresOn} onChange={(e) => change('licenseExpiresOn',e.target.value)} /></label><label className="wide">Descripción<textarea value={form.description} onChange={(e) => change('description',e.target.value)} rows={2} /></label><label className="wide">Atributos técnicos (JSON)<textarea value={form.technicalAttributes} onChange={(e) => change('technicalAttributes',e.target.value)} rows={4} /></label>{error && <div className="alert error wide">{error}</div>}<div className="wide modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving?'Guardando...':'Guardar CI'}</button></div></form></section></div>;
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

export function CmdbPage({ user }: { user: Account }) {
  const [rows,setRows] = useState<Page<Ci> | null>(null);
  const [categories,setCategories] = useState<Category[]>([]);
  const [locations,setLocations] = useState<CiLocation[]>([]);
  const [search,setSearch] = useState('');
  const [categoryId,setCategoryId] = useState('');
  const [page,setPage] = useState(1);
  const [selected,setSelected] = useState<Record<string,unknown> | null>(null);
  const [editing,setEditing] = useState<Record<string,unknown> | null | undefined>(undefined);
  const [impact,setImpact] = useState<Record<string,unknown> | null>(null);
  const [error,setError] = useState('');
  const [newCategory,setNewCategory] = useState({code:'',name:'',parentId:''});
  const [editingCategory,setEditingCategory] = useState<Category | null>(null);
  const [newLocation,setNewLocation] = useState({code:'',name:''});
  const [editingLocation,setEditingLocation] = useState<CiLocation | null>(null);
  async function load() {try {const params = new URLSearchParams({page:String(page),pageSize:'25'});if(search)params.set('search',search);if(categoryId)params.set('categoryId',categoryId);setRows(await api<Page<Ci>>(`/cmdb/items?${params}`));}catch(e){setError(message(e));}}
  useEffect(() => {api<Category[]>('/cmdb/categories').then(setCategories).catch((e) => setError(message(e)));},[]);
  useEffect(() => {api<CiLocation[]>('/cmdb/locations').then(setLocations).catch((e) => setError(message(e)));},[]);
  useEffect(() => {void load();},[page,categoryId]);
  async function open(id: number) {try {setSelected(await api<Record<string,unknown>>(`/cmdb/items/${id}`));setImpact(null);}catch(e){setError(message(e));}}
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>CMDB</h1><p className="muted">Dispositivos, clasificación y relaciones técnicas.</p></div><div className="button-row"><span className="badge active">{rows?.total ?? '...'} CI</span>{isAdmin(user) && <button className="primary" onClick={() => setEditing(null)}>Nuevo CI</button>}</div></div>
    <div className="filters"><div className="search-input"><input placeholder="Código o nombre de CI" aria-label="Buscar CI" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => {if(e.key==='Enter'){setPage(1);void load();}}} /></div><select aria-label="Categoría" value={categoryId} onChange={(e) => {setCategoryId(e.target.value);setPage(1);}}><option value="">Todas las categorías</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="secondary" onClick={() => {setPage(1);void load();}}>Buscar</button></div>
    {error && <div className="alert error">{error}</div>}<section className="panel"><div className="table-wrap"><table><thead><tr><th>Código</th><th>Nombre</th><th>Clasificación</th><th>Estado</th><th>Ubicación</th></tr></thead><tbody>{rows?.data.map((row) => <tr key={row.id} className="clickable" onClick={() => void open(row.id)}><td><strong>{row.code}</strong></td><td>{row.name}</td><td>{row.categoryName}</td><td><span className="badge">{row.status}</span></td><td>{row.location}</td></tr>)}</tbody></table></div><div className="pagination"><button className="secondary" disabled={page<=1} onClick={() => setPage(page-1)}>Anterior</button><span>Página {page} · {rows?.total ?? 0} CI</span><button className="secondary" disabled={!rows || page*25>=rows.total} onClick={() => setPage(page+1)}>Siguiente</button></div></section>
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
          <span><strong>Responsable</strong>{String(selected.responsible_label ?? selected.responsible_user_id ?? 'No informado')}</span>
        </div>
        {isAdmin(user) && <div className="button-row desk-actions"><button className="secondary" onClick={() => {setEditing(selected);setSelected(null);}}>Editar CI</button></div>}
        <section className="desk-section"><h3>Atributos técnicos</h3><pre>{JSON.stringify(selected.technical_attributes,null,2)}</pre></section>
        <section className="desk-section"><h3>Relaciones técnicas</h3>
          {(selected.relations as Array<Record<string,unknown>>).length===0 && <p className="muted">Sin relaciones registradas.</p>}
          {(selected.relations as Array<Record<string,unknown>>).map((relation,index) => {
            const related = Number(relation.from_ci_id)===Number(selected.id) ? Number(relation.to_ci_id) : Number(relation.from_ci_id);
            return <p key={index}>{label(String(relation.relation_type))} · <button className="text-button" onClick={() => void open(related)}>Ver CI #{related}</button></p>;
          })}
        </section>
        <section className="desk-section"><h3>Servicios asociados</h3>
          {(selected.services as Array<Record<string,unknown>>).map((service,index) => <p key={index}>{String(service.code)} · {String(service.name)}</p>)}
        </section>
        <section className="desk-section"><h3>Tickets relacionados</h3>
          {(selected.tickets as Array<Record<string,unknown>>).map((ticket,index) => <p key={index}>{String(ticket.number)} · {String(ticket.title)}</p>)}
        </section>
        {isAdmin(user) && <CiConnections ciId={Number(selected.id)} onChanged={() => void open(Number(selected.id))} />}
        <section className="desk-section"><h3>Impacto potencial</h3><button className="secondary" onClick={async() => {try {setImpact(await api<Record<string,unknown>>('/cmdb/items/'+String(selected.id)+'/impact'));}catch(e){setError(message(e));}}}>Recorrer dependencias</button>
          {impact && <><p className="muted">{String(impact.note)}</p><div className="desk-category-grid">{(impact.potentiallyAffected as Array<Record<string,unknown>>).map((item,index) => <article className="desk-note" key={index}><strong>{String(item.code)} · {String(item.name)}</strong><small>Servicio: {item.service_code ? String(item.service_code)+' · '+String(item.service_name) : 'sin vínculo directo'}</small></article>)}</div></>}
        </section>
      </section>
    </div>}
    {editing!==undefined && <CiEditor categories={categories} locations={locations} initial={editing} onCancel={() => setEditing(undefined)} onSaved={() => {setEditing(undefined);void load();}} />}
  </div>;
}

export function DeskMetricsPage() {
  const [data,setData] = useState<Record<string,unknown> | null>(null);
  const [error,setError] = useState('');
  useEffect(() => {api<Record<string,unknown>>('/desk/metrics').then(setData).catch((e) => setError(message(e)));},[]);
  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <div className="loading">Cargando indicadores...</div>;
  const groups = [['Por cola',data.byQueue],['Por proceso',data.byProcess],['Por prioridad',data.byPriority],['Por estado',data.byState]] as const;
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">INDICADORES</p><h1>Tablero de atención</h1><p className="muted">Cálculos sobre tickets visibles para tu cuenta.</p></div></div><div className="metric-grid">{[['Total',data.total],['Abiertos',data.open],['Primera atención (min)',data.averageFirstResponseMinutes],['Resolución (min)',data.averageResolutionMinutes]].map(([title,value]) => <div className="metric-card" key={String(title)}><div><span>{String(title)}</span><strong>{value==null?'—':String(value)}</strong></div></div>)}</div><div className="desk-metric-grid">{groups.map(([title,values]) => <section className="panel" key={title}><h2>{title}</h2>{Object.entries(values as Record<string,number>).map(([key,value]) => <div className="desk-stat" key={key}><span>{label(key)}</span><strong>{value}</strong></div>)}</section>)}</div><section className="panel desk-section"><h2>Objetivos de atención</h2><p>Primera respuesta: {JSON.stringify(data.firstResponseObjective)} · Resolución: {JSON.stringify(data.resolutionObjective)}</p><p className="muted">{String(data.basis)}</p></section></div>;
}

export function KnowledgePage({ user }: { user: Account }) {
  const [rows,setRows] = useState<Array<{id:number;title:string;body:string;serviceCode:string|null}>>([]);
  const [title,setTitle] = useState(''); const [body,setBody] = useState(''); const [error,setError] = useState('');
  async function load() {try {setRows(await api<typeof rows>('/desk/knowledge'));}catch(e){setError(message(e));}}
  useEffect(() => {void load();},[]);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">AUTOSERVICIO · NIVEL 0</p><h1>Base de conocimientos</h1><p className="muted">Guías y respuestas para resolver consultas frecuentes.</p></div></div>{error && <div className="alert error">{error}</div>}<div className="desk-article-grid">{rows.map((row) => <article className="panel" key={row.id}><h2>{row.title}</h2><p className="muted">{row.body}</p>{row.serviceCode && <span className="badge">{row.serviceCode}</span>}</article>)}</div>{rows.length===0 && <p className="empty">Aún no hay artículos publicados.</p>}{isAdmin(user) && <section className="panel desk-section"><h2>Publicar artículo</h2><form className="stack-form" onSubmit={async(e) => {e.preventDefault();try {await post('/desk/knowledge',{title,body});setTitle('');setBody('');await load();}catch(err){setError(message(err));}}}><label>Título<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label><label>Contenido<textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} required /></label><button className="primary">Publicar</button></form></section>}</div>;
}

function QueueGrants({ queue }: { queue: Queue }) {
  type Grant = { id: number; role: string | null; userId: number | null; userName: string | null; canView: boolean; canHandle: boolean; canTransfer: boolean; canApprove: boolean; canAdmin: boolean };
  const [grants,setGrants] = useState<Grant[]>([]);
  const [users,setUsers] = useState<Array<{id:number;name:string;role:string;active:boolean}>>([]);
  const [target,setTarget] = useState('AGENTE');
  const [flags,setFlags] = useState<Record<string,boolean>>({canView:true,canHandle:false,canTransfer:false,canApprove:false,canAdmin:false});
  const [error,setError] = useState('');
  async function load() {try {setGrants(await api<Grant[]>(`/desk/queues/${queue.id}/grants`));}catch(e){setError(message(e));}}
  useEffect(() => {void load();api<typeof users>('/users').then((rows) => setUsers(rows.filter((u) => u.active && u.role!=='CONSULTA'))).catch((e) => setError(message(e)));},[queue.id]);
  async function add(event:FormEvent) {event.preventDefault();setError('');try {await post(`/desk/queues/${queue.id}/grants`,{
    ...(target.startsWith('U:') ? {userId:Number(target.slice(2))} : {role:target}),...flags,
  });await load();}catch(e){setError(message(e));}}
  return <section className="panel desk-section"><h2>Permisos de {queue.name}</h2><p className="muted">Consultar, atender, transferir, aprobar y administrar son permisos separados.</p>{error && <div className="alert error">{error}</div>}<div className="table-wrap"><table><thead><tr><th>Rol o usuario</th><th>Consultar</th><th>Atender</th><th>Transferir</th><th>Aprobar</th><th>Administrar</th><th>Acción</th></tr></thead><tbody>{grants.map((g) => <tr key={g.id}><td>{g.role ?? g.userName}</td>{(['canView','canHandle','canTransfer','canApprove','canAdmin'] as const).map((key) => <td key={key}>{g[key]?'Sí':'—'}</td>)}<td><button className="text-button danger-text" onClick={async() => {try {await api(`/desk/queues/${queue.id}/grants/${g.id}`,{method:'DELETE'});await load();}catch(e){setError(message(e));}}}>Retirar</button></td></tr>)}</tbody></table></div><form className="desk-category-form" onSubmit={add}><label>Rol o usuario<select value={target} onChange={(e) => setTarget(e.target.value)}><option value="AGENTE">Rol agente</option><option value="APROBADOR">Rol aprobador</option>{users.map((u) => <option key={u.id} value={`U:${u.id}`}>{u.name} · usuario</option>)}</select></label><div className="desk-checks">{([['canView','Consultar'],['canHandle','Atender'],['canTransfer','Transferir'],['canApprove','Aprobar'],['canAdmin','Administrar']] as const).map(([key,text]) => <label key={key}><input type="checkbox" checked={flags[key]} onChange={(e) => setFlags({...flags,[key]:e.target.checked})} />{text}</label>)}</div><button className="secondary">Guardar permisos</button></form></section>;
}

function QueueEditor({ queue, onCancel, onSaved }: { queue: Queue; onCancel: () => void; onSaved: () => void }) {
  const [name,setName] = useState(queue.name);
  const [description,setDescription] = useState(queue.description ?? '');
  const [supportLevel,setSupportLevel] = useState(String(queue.support_level));
  const [firstMinutes,setFirstMinutes] = useState(String(queue.first_response_minutes ?? ''));
  const [resolutionMinutes,setResolutionMinutes] = useState(String(queue.resolution_minutes ?? ''));
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  async function save(event:FormEvent) {
    event.preventDefault();setError('');setSaving(true);
    try {await patch(`/desk/queues/${queue.id}`,{name,description,supportLevel:Number(supportLevel),
      firstResponseMinutes:firstMinutes?Number(firstMinutes):null,
      resolutionMinutes:resolutionMinutes?Number(resolutionMinutes):null});onSaved();}
    catch(e){setError(message(e));}finally{setSaving(false);}
  }
  return <div className="modal-backdrop" onClick={onCancel}><section className="modal-card desk-detail" role="dialog" aria-modal="true" aria-label={`Editar cola ${queue.code}`} onClick={(e)=>e.stopPropagation()}><div className="drawer-head"><h2>Editar cola {queue.code}</h2><button className="icon-button" onClick={onCancel} aria-label="Cerrar">×</button></div><form className="form-grid" onSubmit={save}><label>Nombre<input value={name} onChange={(e)=>setName(e.target.value)} required /></label><label>Nivel de soporte<input type="number" min="0" max="4" value={supportLevel} onChange={(e)=>setSupportLevel(e.target.value)} required /></label><label>Primera respuesta (min)<input type="number" min="1" value={firstMinutes} onChange={(e)=>setFirstMinutes(e.target.value)} /></label><label>Resolución (min)<input type="number" min="1" value={resolutionMinutes} onChange={(e)=>setResolutionMinutes(e.target.value)} /></label><label className="wide">Descripción<textarea value={description} onChange={(e)=>setDescription(e.target.value)} rows={3} /></label>{error && <div className="alert error wide">{error}</div>}<div className="wide modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>Guardar cambios</button></div></form></section></div>;
}

export function QueuesPage({ user }: { user: Account }) {
  const [rows,setRows] = useState<Queue[]>([]); const [error,setError] = useState('');
  const [code,setCode] = useState(''); const [name,setName] = useState(''); const [process,setProcess] = useState('INCIDENT');
  const [supportLevel,setSupportLevel] = useState('1'); const [firstMinutes,setFirstMinutes] = useState('60'); const [resolutionMinutes,setResolutionMinutes] = useState('480');
  const [selected,setSelected] = useState<Queue | null>(null);
  const [editing,setEditing] = useState<Queue | null>(null);
  async function load() {try {setRows(await api<Queue[]>('/desk/queues'));}catch(e){setError(message(e));}}
  useEffect(() => {void load();},[]);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">DISTRIBUCIÓN</p><h1>Colas de atención</h1><p className="muted">Una cola pertenece a un proceso y aplica permisos por acción.</p></div></div>{error && <div className="alert error">{error}</div>}<section className="panel"><div className="table-wrap"><table><thead><tr><th>Código</th><th>Cola</th><th>Proceso</th><th>Nivel</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td>{label(row.process)}</td><td>{row.support_level}</td><td>{row.active?'Activa':'Inactiva'}</td><td>{isAdmin(user) && <div className="button-row"><button className="text-button" onClick={() => setEditing(row)}>Editar</button><button className="text-button" onClick={() => setSelected(row)}>Permisos</button><button className="text-button" onClick={async() => {try {await patch(`/desk/queues/${row.id}`,{active:!row.active});await load();}catch(e){setError(message(e));}}}>{row.active?'Desactivar':'Activar'}</button></div>}</td></tr>)}</tbody></table></div></section>{isAdmin(user) && selected && <QueueGrants queue={selected} />}{isAdmin(user) && editing && <QueueEditor queue={editing} onCancel={() => setEditing(null)} onSaved={() => {setEditing(null);void load();}} />}{isAdmin(user) && <section className="panel desk-section"><h2>Crear cola</h2><form className="desk-category-form" onSubmit={async(e) => {e.preventDefault();try {await post('/desk/queues',{code,name,process,supportLevel:Number(supportLevel),firstResponseMinutes:Number(firstMinutes),resolutionMinutes:Number(resolutionMinutes)});setCode('');setName('');await load();}catch(err){setError(message(err));}}}><label>Código<input value={code} onChange={(e) => setCode(e.target.value)} required /></label><label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Proceso<select value={process} onChange={(e) => setProcess(e.target.value)}>{Object.keys(transitions).map((key) => <option key={key} value={key}>{label(key)}</option>)}</select></label><label>Nivel de soporte<input type="number" min="0" max="4" value={supportLevel} onChange={(e) => setSupportLevel(e.target.value)} required /></label><label>Primera respuesta (min)<input type="number" min="1" value={firstMinutes} onChange={(e) => setFirstMinutes(e.target.value)} required /></label><label>Resolución (min)<input type="number" min="1" value={resolutionMinutes} onChange={(e) => setResolutionMinutes(e.target.value)} required /></label><button className="primary">Crear cola</button></form></section>}</div>;
}
