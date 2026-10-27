import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as ExcelJS from 'exceljs';
import { Pool } from 'pg';

const source = process.argv[2] ?? process.env.CMDB_IMPORT_FILE ?? '/app/data/fuentes/CMDB.xlsx';
const headers = [
  'nombre del ci','tipo de ci','descripcion','numero de serie','version','fecha de adquisicion',
  'estado actual','relaciones','padres/hijos','ubicacion fisica','propietario/responsable',
  'fecha de cambio','descripcion del cambio','documentacion relacionada',
  'enlaces a incidentes y problemas','niveles de seguridad','cumplimiento',
  'estado de configuracion','numero de licencia','fecha de vencimiento',
];
type SourceRow = {
  row: number; name: string; type: string; description: string | null; serial: string | null;
  version: string | null; acquired: string | null; status: string; rawStatus: string | null;
  relations: string | null; parentsChildren: string | null; location: string; owner: string;
  changedOn: string | null; changeDescription: string | null; documentation: string | null;
  incidentLinks: string | null; security: string | null; compliance: string | null;
  configurationStatus: string | null; license: string | null; expires: string | null;
};
function scalar(cell: ExcelJS.Cell, label: string): string | null {
  const value = cell.value;
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0,10);
  if (typeof value === 'object') throw new Error(`${label}: fórmula o celda compleja no admitida.`);
  const text = String(value).trim();
  return text || null;
}
function header(value: string | null) {
  return String(value ?? '').replaceAll('√≥','o').replaceAll('√∫','u')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
}
function date(value: string | null, label: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label}: fecha debe ser YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==value) throw new Error(`${label}: fecha no válida.`);
  return value;
}
function required(value: string | null, label: string) {
  if (!value) throw new Error(`${label} es obligatorio.`);
  return value;
}
function mappedStatus(value: string | null) {
  const normalized = header(value);
  return ({activo:'ACTIVE',inactivo:'INACTIVE',mantenimiento:'MAINTENANCE',retirado:'RETIRED'} as Record<string,string>)[normalized] ?? 'UNKNOWN';
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value==='object' && !(value instanceof Date)) {
    return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function dbDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0,10);
  return String(value).slice(0,10);
}

async function parse() {
  const bytes = readFileSync(source);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const sheet = workbook.getWorksheet('CMDB');
  if (!sheet) throw new Error('Falta la hoja CMDB. La base no fue modificada.');
  for (let i=0;i<headers.length;i++) {
    const found = header(scalar(sheet.getCell(4,i+2),`encabezado ${i+2}`));
    if (found!==headers[i]) throw new Error(`Encabezado ${i+2} no válido: ${found}. Esperado: ${headers[i]}. La base no fue modificada.`);
  }
  const rows: SourceRow[] = [];
  const seen = new Set<string>();
  for (let index=5;index<=sheet.rowCount;index++) {
    const cells = Array.from({length:20},(_,offset) => scalar(sheet.getCell(index,offset+2),`fila ${index}, columna ${offset+2}`));
    if (cells.every((value) => value===null)) continue;
    const name = required(cells[0],`Nombre fila ${index}`);
    const type = required(cells[1],`Tipo fila ${index}`);
    const location = required(cells[9],`Ubicación fila ${index}`);
    const owner = required(cells[10],`Responsable fila ${index}`);
    const key = `${type.toLowerCase()}|${name.toLowerCase()}`;
    if (seen.has(key)) throw new Error(`CI duplicado en Excel: ${name} (${type}), fila ${index}. La base no fue modificada.`);
    seen.add(key);
    rows.push({row:index,name,type,description:cells[2],serial:cells[3],version:cells[4],
      acquired:date(cells[5],`Adquisición fila ${index}`),status:mappedStatus(cells[6]),rawStatus:cells[6],
      relations:cells[7],parentsChildren:cells[8],location,owner,
      changedOn:date(cells[11],`Cambio fila ${index}`),changeDescription:cells[12],
      documentation:cells[13],incidentLinks:cells[14],security:cells[15],compliance:cells[16],
      configurationStatus:cells[17],license:cells[18],expires:date(cells[19],`Vencimiento fila ${index}`)});
  }
  if (!rows.length) throw new Error('La hoja CMDB no contiene CI. La base no fue modificada.');
  return {hash,rows};
}

async function main() {
  const parsed = await parse(); // Validación total antes de abrir la transacción.
  const pool = new Pool({connectionString:process.env.DATABASE_URL});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = await client.query<{id:string}>(`INSERT INTO cmdb_import_runs(source_file,source_sha256,source_sheet)
      VALUES('CMDB.xlsx',$1,'CMDB') RETURNING id`,[parsed.hash]);
    const runId = run.rows[0].id;
    let created=0,updated=0,skipped=0,observed=0;
    const presentNames = new Set(parsed.rows.map((row) => row.name.toLowerCase()));
    for (const row of parsed.rows) {
      const normalizedType = header(row.type);
      const categoryCode = normalizedType==='hardware' ? 'HARDWARE' : normalizedType==='software' ? 'SOFTWARE' :
        `SRC-${row.type.toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)}`;
      const category = await client.query<{id:number}>(`INSERT INTO ci_categories(code,name,source_kind,source_reference)
        VALUES($1,$2,'EXCEL','CMDB.xlsx!C5:C6') ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name
        RETURNING id`,[categoryCode,row.type]);
      const categoryId = category.rows[0].id;
      const code = `CMDB-XLSX-${row.row}`;
      const technical = { sourceSheet:'CMDB',sourceRow:row.row,sourceType:row.type,
        originalStatus:row.rawStatus,originalRelations:row.relations,
        originalParentsChildren:row.parentsChildren,sourceChangeDate:row.changedOn,
        sourceChangeDescription:row.changeDescription,originalDocumentation:row.documentation,
        originalIncidentLinks:row.incidentLinks };
      const reference = `CMDB.xlsx!B${row.row}:U${row.row}`;
      const old = await client.query('SELECT * FROM configuration_items WHERE code=$1 FOR UPDATE',[code]);
      const same = old.rows[0] && old.rows[0].name===row.name && old.rows[0].category_id===categoryId &&
        old.rows[0].description===row.description && old.rows[0].serial_number===row.serial &&
        old.rows[0].version===row.version && dbDate(old.rows[0].acquired_on)===row.acquired &&
        old.rows[0].status===row.status && old.rows[0].location===row.location &&
        old.rows[0].responsible_label===row.owner && old.rows[0].security_level===row.security &&
        old.rows[0].compliance_status===row.compliance && old.rows[0].configuration_status===row.configurationStatus &&
        old.rows[0].license_number===row.license && dbDate(old.rows[0].license_expires_on)===row.expires &&
        old.rows[0].source_reference===reference && old.rows[0].is_device===(header(row.type)==='hardware') &&
        stable(old.rows[0].technical_attributes)===stable(technical);
      let ciId: string;
      if (same) { skipped++; ciId=old.rows[0].id; }
      else {
        const values = [code,row.name,categoryId,header(row.type)==='hardware',row.description,row.serial,
          row.version,row.acquired,row.status,row.location,row.owner,row.security,row.compliance,
          row.configurationStatus,row.license,row.expires,JSON.stringify(technical),reference];
        const result = await client.query<{id:string}>(`INSERT INTO configuration_items
          (code,name,category_id,is_device,description,serial_number,version,acquired_on,status,
           location,responsible_label,security_level,compliance_status,configuration_status,
           license_number,license_expires_on,technical_attributes,source_reference)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18)
          ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,category_id=EXCLUDED.category_id,
            is_device=EXCLUDED.is_device,description=EXCLUDED.description,serial_number=EXCLUDED.serial_number,
            version=EXCLUDED.version,acquired_on=EXCLUDED.acquired_on,status=EXCLUDED.status,
            location=EXCLUDED.location,responsible_label=EXCLUDED.responsible_label,
            security_level=EXCLUDED.security_level,compliance_status=EXCLUDED.compliance_status,
            configuration_status=EXCLUDED.configuration_status,license_number=EXCLUDED.license_number,
            license_expires_on=EXCLUDED.license_expires_on,technical_attributes=EXCLUDED.technical_attributes,
            source_reference=EXCLUDED.source_reference,updated_at=NOW() RETURNING id`,values);
        ciId=result.rows[0].id;
        await client.query(`INSERT INTO ci_history(ci_id,action,old_values,new_values,description)
          VALUES($1,$2,$3::jsonb,$4::jsonb,$5)`,[ciId,old.rows[0]?'SOURCE_UPDATE':'SOURCE_IMPORT',
          old.rows[0]?JSON.stringify(old.rows[0]):null,JSON.stringify({code,name:row.name,reference}),
          'Importación desde CMDB.xlsx; fecha de cambio original conservada en atributos técnicos.']);
        if (old.rows[0]) updated++; else created++;
      }
      const observations: Array<[string,string]> = [];
      if (row.status==='UNKNOWN') observations.push(['Estado Actual',`Valor original "${row.rawStatus ?? 'vacío'}" conservado; estado operativo UNKNOWN.`]);
      if (row.relations) observations.push(['Relaciones',
        presentNames.has(row.relations.toLowerCase()) ?
          `Relación "${row.relations}" conservada como texto: el Excel no especifica su tipo técnico.` :
          `Referencia "${row.relations}" no aparece como CI en la hoja; no se crea un CI ficticio.`]);
      if (row.parentsChildren) observations.push(['Padres/Hijos',`Valor original "${row.parentsChildren}" conservado sin inferir una jerarquía.`]);
      for (const [field,detail] of observations) {
        await client.query(`INSERT INTO cmdb_import_observations(run_id,source_row,field_name,message)
          VALUES($1,$2,$3,$4)`,[runId,row.row,field,detail]);
        observed++;
      }
    }
    await client.query(`UPDATE cmdb_import_runs SET created_count=$1,updated_count=$2,
      skipped_count=$3,observed_count=$4,completed_at=NOW() WHERE id=$5`,[created,updated,skipped,observed,runId]);
    await client.query('COMMIT');
    console.log(JSON.stringify({ok:true,runId,source:'CMDB.xlsx',sha256:parsed.hash,rows:parsed.rows.length,
      created,updated,skipped,observed}));
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();await pool.end();}
}
main().catch((error) => {console.error(error);process.exitCode=1;});
