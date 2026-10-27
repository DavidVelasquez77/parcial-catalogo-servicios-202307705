import { useEffect, useState, type FormEvent } from 'react';
import { api, patch, post } from './api';

type Account = { id: number; role: string; roles?: string[] };
type Page<T> = { data: T[]; total: number; page: number; pageSize: number };
type Queue = { id: number; code: string; name: string; process: string; active: boolean; canHandle: boolean; support_level: number };
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
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  const process = queues.find((q) => String(q.id) === queueId)?.process ?? '';
  useEffect(() => {
    api<Page<Service>>('/services?pageSize=100').then((page) => setServices(page.data.filter((s) => s.status === 'ACTIVE'))).catch((e) => setError(message(e)));
    api<Array<{id:number;name:string;active:boolean}>>('/desk/users').then(setUsers).catch(() => undefined);
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    const processData: Record<string,unknown> = {};
    if (process === 'EVENT') processData.eventCategory = category;
    if (process === 'INCIDENT') processData.incidentCategory = category;
    if (process === 'ACCESS') { processData.resource = resource; processData.permission = permission; }
    try {
      await post('/desk/tickets',{ queueId:Number(queueId),serviceId:Number(serviceId),title,description,
        priority:Number(priority),impact:3,urgency:3,noCiReason,processData,
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
    {process === 'ACCESS' && <><label>Beneficiario<select value={beneficiaryId} onChange={(e) => setBeneficiaryId(e.target.value)} required><option value="">Selecciona</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Recurso<input value={resource} onChange={(e) => setResource(e.target.value)} required /></label><label>Permiso solicitado<input value={permission} onChange={(e) => setPermission(e.target.value)} required /></label></>}
    <label>Motivo por el que no se asocia CI<input value={noCiReason} onChange={(e) => setNoCiReason(e.target.value)} required /></label>
    {error && <div className="alert error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onCancel}>Cancelar</button><button className="primary" disabled={saving}>{saving?'Guardando...':'Crear ticket'}</button></div>
  </form></section></div>;
}

function TicketView({ id, user, queues, onClose, onChanged }: { id: number; user: Account; queues: Queue[]; onClose: () => void; onChanged: () => void }) {
  const [ticket,setTicket] = useState<TicketDetail | null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [reason,setReason] = useState('');
  const [comment,setComment] = useState('');
  const [visibility,setVisibility] = useState('PUBLIC');
  const [processJson,setProcessJson] = useState('');
  const [destination,setDestination] = useState('');
  const [file,setFile] = useState<File | null>(null);
  async function load() { try { const row = await api<TicketDetail>(`/desk/tickets/${id}`); setTicket(row); setProcessJson(JSON.stringify(row.process_data,null,2)); } catch (e) { setError(message(e)); } }
  useEffect(() => { void load(); }, [id]);
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
      {staff && <section className="desk-section"><h3>Datos del proceso</h3><p className="muted">Plan de pruebas, reversión, causa raíz y demás datos específicos se guardan aquí.</p><textarea value={processJson} rows={6} onChange={(e) => setProcessJson(e.target.value)} /><button className="secondary" disabled={busy} onClick={async () => {try {setBusy(true);await patch(`/desk/tickets/${id}/process-data`,JSON.parse(processJson));await load();}catch(e){setError(message(e));}finally{setBusy(false);}}}>Guardar datos</button></section>}
      {staff && <section className="desk-section"><h3>Transferir</h3><div className="button-row"><select value={destination} onChange={(e) => setDestination(e.target.value)}><option value="">Cola destino</option>{queues.filter((q) => q.process===ticket.process && q.id!==ticket.queue_id && q.active).map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select><button className="secondary" disabled={busy || !destination} onClick={() => void action('transfer',{queueId:Number(destination),reason})}>Transferir</button></div></section>}
      <section className="desk-section"><h3>Conversación</h3>{ticket.comments.map((item) => <article className="desk-note" key={item.id}><small>{item.visibility==='INTERNAL'?'Nota interna':'Comentario público'} · {date(item.created_at)}</small><p>{item.body}</p></article>)}{canWrite(user) && <div className="stack-form"><label>Nuevo comentario<textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} /></label>{staff && <label>Visibilidad<select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="PUBLIC">Visible al solicitante</option><option value="INTERNAL">Nota interna</option></select></label>}<button className="secondary" disabled={busy || !comment.trim()} onClick={() => void action('comments',{body:comment,visibility})}>Enviar comentario</button></div>}</section>
      <section className="desk-section"><h3>Evidencias</h3>{ticket.attachments.map((item) => <p key={item.id}><a href={`/api/desk/tickets/${id}/attachments/${item.id}`}>{item.originalName}</a> <small>({Math.ceil(item.sizeBytes/1024)} KB)</small></p>)}{canWrite(user) && <div className="button-row"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><button className="secondary" disabled={busy || !file} onClick={() => void upload()}>Adjuntar</button></div>}</section>
      <section className="desk-section"><h3>Bitácora</h3>{ticket.history.map((item) => <article className="desk-note" key={item.id}><strong>{label(item.action)}</strong><small> · {date(item.created_at)} · actor #{item.actor_id}</small>{item.reason && <p>{item.reason}</p>}</article>)}</section>
      <section className="desk-section"><h3>Tickets relacionados</h3>{ticket.links.length ? ticket.links.map((link,index) => <p key={index}>{link.link_type}: #{link.ticket_id===ticket.id?link.related_ticket_id:link.ticket_id}</p>) : <p className="muted">Sin relaciones.</p>}</section>
    </>}
  </section></div>;
}

export function TicketsPage({ user }: { user: Account }) {
  const [queues,setQueues] = useState<Queue[]>([]);
  const [rows,setRows] = useState<Page<Ticket> | null>(null);
  const [search,setSearch] = useState('');
  const [process,setProcess] = useState('');
  const [state,setState] = useState('');
  const [page,setPage] = useState(1);
  const [error,setError] = useState('');
  const [creating,setCreating] = useState(false);
  const [selected,setSelected] = useState<number | null>(null);
  async function load() {try {const params = new URLSearchParams({page:String(page),pageSize:'20'});if(search)params.set('search',search);if(process)params.set('process',process);if(state)params.set('state',state);setRows(await api<Page<Ticket>>(`/desk/tickets?${params}`));}catch(e){setError(message(e));}}
  useEffect(() => {api<Queue[]>('/desk/queues').then(setQueues).catch((e) => setError(message(e)));},[]);
  useEffect(() => {void load();},[page,process,state]);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">SERVICE DESK</p><h1>Tickets</h1><p className="muted">Seguimiento por proceso, prioridad y cola de atención.</p></div>{canWrite(user) && <button className="primary" onClick={() => setCreating(true)}>Nuevo ticket</button>}</div>
    <div className="filters"><div className="search-input"><input aria-label="Buscar ticket" placeholder="Número o título" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => {if(e.key==='Enter'){setPage(1);void load();}}} /></div><select aria-label="Filtrar proceso" value={process} onChange={(e) => {setProcess(e.target.value);setPage(1);}}><option value="">Todos los procesos</option>{Object.keys(transitions).map((key) => <option key={key} value={key}>{label(key)}</option>)}</select><select aria-label="Filtrar estado" value={state} onChange={(e) => {setState(e.target.value);setPage(1);}}><option value="">Todos los estados</option>{['SUBMITTED','IN_PROGRESS','PENDING_APPROVAL','APPROVED','RESOLVED','CLOSED','REJECTED'].map((key) => <option key={key} value={key}>{label(key)}</option>)}</select><button className="secondary" onClick={() => {setPage(1);void load();}}>Buscar</button></div>
    {error && <div className="alert error">{error}</div>}<section className="panel"><div className="table-wrap"><table><thead><tr><th>Número</th><th>Título</th><th>Proceso</th><th>Cola</th><th>Estado</th><th>Prioridad</th><th>Creado</th></tr></thead><tbody>{rows?.data.map((row) => <tr className="clickable" key={row.id} onClick={() => setSelected(row.id)}><td><strong>{row.number}</strong></td><td>{row.title}</td><td>{label(row.process)}</td><td>{row.queueName}</td><td><span className="badge">{label(row.state)}</span></td><td>{row.priority}</td><td>{date(row.createdAt)}</td></tr>)}</tbody></table>{rows?.data.length===0 && <p className="empty">No hay tickets con esos filtros.</p>}</div><div className="pagination"><button className="secondary" disabled={page<=1} onClick={() => setPage(page-1)}>Anterior</button><span>Página {page} · {rows?.total ?? 0} tickets</span><button className="secondary" disabled={!rows || page*20>=rows.total} onClick={() => setPage(page+1)}>Siguiente</button></div></section>
    {creating && <TicketCreate queues={queues} onCancel={() => setCreating(false)} onDone={() => {setCreating(false);void load();}} />}
    {selected !== null && <TicketView id={selected} user={user} queues={queues} onClose={() => setSelected(null)} onChanged={() => void load()} />}
  </div>;
}

export function CmdbPage({ user }: { user: Account }) {
  const [rows,setRows] = useState<Page<Ci> | null>(null);
  const [categories,setCategories] = useState<Category[]>([]);
  const [search,setSearch] = useState('');
  const [categoryId,setCategoryId] = useState('');
  const [page,setPage] = useState(1);
  const [selected,setSelected] = useState<Record<string,unknown> | null>(null);
  const [error,setError] = useState('');
  const [newCategory,setNewCategory] = useState({code:'',name:'',parentId:''});
  async function load() {try {const params = new URLSearchParams({page:String(page),pageSize:'25'});if(search)params.set('search',search);if(categoryId)params.set('categoryId',categoryId);setRows(await api<Page<Ci>>(`/cmdb/items?${params}`));}catch(e){setError(message(e));}}
  useEffect(() => {api<Category[]>('/cmdb/categories').then(setCategories).catch((e) => setError(message(e)));},[]);
  useEffect(() => {void load();},[page,categoryId]);
  async function open(id: number) {try {setSelected(await api<Record<string,unknown>>(`/cmdb/items/${id}`));}catch(e){setError(message(e));}}
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">CONFIGURACIÓN</p><h1>CMDB</h1><p className="muted">Dispositivos, clasificación y relaciones técnicas.</p></div><span className="badge active">{rows?.total ?? '...'} CI</span></div>
    <div className="filters"><div className="search-input"><input placeholder="Código o nombre de CI" aria-label="Buscar CI" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => {if(e.key==='Enter'){setPage(1);void load();}}} /></div><select aria-label="Categoría" value={categoryId} onChange={(e) => {setCategoryId(e.target.value);setPage(1);}}><option value="">Todas las categorías</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="secondary" onClick={() => {setPage(1);void load();}}>Buscar</button></div>
    {error && <div className="alert error">{error}</div>}<section className="panel"><div className="table-wrap"><table><thead><tr><th>Código</th><th>Nombre</th><th>Clasificación</th><th>Estado</th><th>Ubicación</th></tr></thead><tbody>{rows?.data.map((row) => <tr key={row.id} className="clickable" onClick={() => void open(row.id)}><td><strong>{row.code}</strong></td><td>{row.name}</td><td>{row.categoryName}</td><td><span className="badge">{row.status}</span></td><td>{row.location}</td></tr>)}</tbody></table></div><div className="pagination"><button className="secondary" disabled={page<=1} onClick={() => setPage(page-1)}>Anterior</button><span>Página {page} · {rows?.total ?? 0} CI</span><button className="secondary" disabled={!rows || page*25>=rows.total} onClick={() => setPage(page+1)}>Siguiente</button></div></section>
    <section className="panel desk-section"><h2>Jerarquía de clasificación</h2><div className="desk-category-grid">{categories.map((c) => <div key={c.id} className="desk-note"><strong>{c.code} · {c.name}</strong><small>Padre: {categories.find((p) => p.id===c.parentId)?.name ?? 'Raíz'} · Origen: {c.sourceKind}</small></div>)}</div>{isAdmin(user) && <form className="desk-category-form" onSubmit={async(e) => {e.preventDefault();try {await post('/cmdb/categories',{code:newCategory.code,name:newCategory.name,parentId:newCategory.parentId?Number(newCategory.parentId):null});setCategories(await api<Category[]>('/cmdb/categories'));setNewCategory({code:'',name:'',parentId:''});}catch(err){setError(message(err));}}}><label>Código<input value={newCategory.code} onChange={(e) => setNewCategory({...newCategory,code:e.target.value})} required /></label><label>Nombre<input value={newCategory.name} onChange={(e) => setNewCategory({...newCategory,name:e.target.value})} required /></label><label>Padre<select value={newCategory.parentId} onChange={(e) => setNewCategory({...newCategory,parentId:e.target.value})}><option value="">Raíz</option>{categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="secondary">Agregar categoría</button></form>}</section>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="modal-card desk-detail" role="dialog" aria-modal="true" aria-label="Detalle de CI" onClick={(e) => e.stopPropagation()}><div className="drawer-head"><h2>{String(selected.code)} · {String(selected.name)}</h2><button className="icon-button" onClick={() => setSelected(null)} aria-label="Cerrar">×</button></div><div className="desk-facts"><span><strong>Estado</strong>{String(selected.status)}</span><span><strong>Ubicación</strong>{String(selected.location)}</span><span><strong>Categoría</strong>{String(selected.category_name)}</span><span><strong>Responsable</strong>{String(selected.responsible_label ?? selected.responsible_user_id ?? 'No informado')}</span></div><section className="desk-section"><h3>Atributos técnicos</h3><pre>{JSON.stringify(selected.technical_attributes,null,2)}</pre></section><section className="desk-section"><h3>Relaciones técnicas</h3>{(selected.relations as Array<Record<string,unknown>>).map((r,index) => <p key={index}>{String(r.relation_type)} · CI #{String(r.from_ci_id)} → CI #{String(r.to_ci_id)}</p>)}</section><section className="desk-section"><h3>Servicios asociados</h3>{(selected.services as Array<Record<string,unknown>>).map((s,index) => <p key={index}>{String(s.code)} · {String(s.name)}</p>)}</section><section className="desk-section"><h3>Tickets relacionados</h3>{(selected.tickets as Array<Record<string,unknown>>).map((t,index) => <p key={index}>{String(t.number)} · {String(t.title)}</p>)}</section><button className="secondary" onClick={async() => {try {const data = await api<Record<string,unknown>>(`/cmdb/items/${selected.id}/impact`);alert(`${String(data.note)}\n${JSON.stringify(data.potentiallyAffected,null,2)}`);}catch(e){setError(message(e));}}}>Ver impacto potencial</button></section></div>}
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

export function QueuesPage({ user }: { user: Account }) {
  const [rows,setRows] = useState<Queue[]>([]); const [error,setError] = useState('');
  const [code,setCode] = useState(''); const [name,setName] = useState(''); const [process,setProcess] = useState('INCIDENT');
  async function load() {try {setRows(await api<Queue[]>('/desk/queues'));}catch(e){setError(message(e));}}
  useEffect(() => {void load();},[]);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">DISTRIBUCIÓN</p><h1>Colas de atención</h1><p className="muted">Una cola pertenece a un proceso y aplica permisos por acción.</p></div></div>{error && <div className="alert error">{error}</div>}<section className="panel"><div className="table-wrap"><table><thead><tr><th>Código</th><th>Cola</th><th>Proceso</th><th>Nivel</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td>{label(row.process)}</td><td>{row.support_level}</td><td>{row.active?'Activa':'Inactiva'}</td><td>{isAdmin(user) && <button className="text-button" onClick={async() => {try {await patch(`/desk/queues/${row.id}`,{active:!row.active});await load();}catch(e){setError(message(e));}}}>{row.active?'Desactivar':'Activar'}</button>}</td></tr>)}</tbody></table></div></section>{isAdmin(user) && <section className="panel desk-section"><h2>Crear cola</h2><form className="desk-category-form" onSubmit={async(e) => {e.preventDefault();try {await post('/desk/queues',{code,name,process});setCode('');setName('');await load();}catch(err){setError(message(err));}}}><label>Código<input value={code} onChange={(e) => setCode(e.target.value)} required /></label><label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Proceso<select value={process} onChange={(e) => setProcess(e.target.value)}>{Object.keys(transitions).map((key) => <option key={key} value={key}>{label(key)}</option>)}</select></label><button className="primary">Crear cola</button></form></section>}</div>;
}
