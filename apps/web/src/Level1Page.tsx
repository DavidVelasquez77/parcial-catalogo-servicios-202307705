import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api, patch, post, del } from './api';

type Level1 = { id: number; code: string; name: string; active: boolean };

function Level1Modal({ initial, onClose, onSaved }: { initial: Level1 | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (initial) await patch('/services/level1/' + initial.id, { code, name });
      else await post('/services/level1', { code, name });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar el nivel 1.');
    } finally {
      setLoading(false);
    }
  }

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="modal-card" onClick={(event) => event.stopPropagation()}>
      <div className="drawer-head"><h2>{initial ? 'Editar nivel 1' : 'Nuevo servicio nivel 1'}</h2><button className="icon-button" type="button" onClick={onClose}>×</button></div>
      <form className="stack-form" onSubmit={submit}>
        <label>Código<input value={code} onChange={(event) => setCode(event.target.value)} required /></label>
        <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions"><button className="secondary" type="button" onClick={onClose}>Cancelar</button><button className="primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button></div>
      </form>
    </section>
  </div>;
}

export default function Level1Page() {
  const [rows, setRows] = useState<Level1[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Level1 | null | undefined>(undefined);

  async function load() {
    try {
      setRows(await api<Level1[]>('/services/level1'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar los niveles 1.');
    }
  }

  useEffect(() => { void load(); }, []);

  async function deactivate(row: Level1) {
    if (!window.confirm('¿Desactivar ' + row.code + '? Primero deben estar inactivos sus servicios.')) return;
    try {
      await del('/services/level1/' + row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible desactivar el nivel 1.');
    }
  }

  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">CATÁLOGO</p><h1>Servicios nivel 1</h1><p className="muted">Familias principales que agrupan los servicios de nivel 2.</p></div><button className="primary" onClick={() => setEditing(null)}><Plus size={17} />Nuevo nivel 1</button></div>
    <section className="panel">{error && <div className="alert error">{error}</div>}<div className="table-wrap"><table><thead><tr><th>Código</th><th>Nombre</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.code}</strong></td><td>{row.name}</td><td><span className={'badge ' + (row.active ? 'active' : 'inactive')}>{row.active ? 'Activo' : 'Inactivo'}</span></td><td><button className="text-button" onClick={() => setEditing(row)}>Editar</button>{row.active && <button className="text-button danger-text" onClick={() => void deactivate(row)}>Desactivar</button>}</td></tr>)}</tbody></table>{rows.length === 0 && <div className="empty">No hay niveles 1.</div>}</div></section>
    {editing !== undefined && <Level1Modal initial={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); void load(); }} />}
  </div>;
}

