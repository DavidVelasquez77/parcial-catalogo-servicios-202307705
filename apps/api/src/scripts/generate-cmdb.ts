import 'dotenv/config';
import { Pool, PoolClient } from 'pg';

const seed = String(process.env.CMDB_SEED ?? 'EVAL2026').toUpperCase();
const count = Number(process.env.CMDB_COUNT ?? 5000);
if (!/^[A-Z0-9_-]{1,20}$/.test(seed)) throw new Error('CMDB_SEED debe contener 1-20 caracteres A-Z, 0-9, _ o -.');
if (!Number.isSafeInteger(count) || count < 1 || count > 100000) throw new Error('CMDB_COUNT debe estar entre 1 y 100000.');

const classes = [
  { code: 'HW-SERVER', name: 'Servidor', root: 'HARDWARE' },
  { code: 'HW-WORKSTATION', name: 'Estación de trabajo', root: 'HARDWARE' },
  { code: 'HW-NETWORK', name: 'Equipo de red', root: 'HARDWARE' },
  { code: 'HW-STORAGE', name: 'Almacenamiento', root: 'HARDWARE' },
] as const;
const locations = [
  { code: 'DC-A', name: 'Centro de datos A' },
  { code: 'DC-B', name: 'Centro de datos B' },
  { code: 'OFFICE-A', name: 'Oficina A' },
  { code: 'OFFICE-B', name: 'Oficina B' },
] as const;

async function prepare(client: PoolClient) {
  for (const root of ['HARDWARE', 'SOFTWARE']) {
    await client.query(`INSERT INTO ci_categories(code,name,source_kind,source_reference)
      VALUES($1,$2,'EXCEL','CMDB.xlsx, hoja CMDB, celdas C5:C6')
      ON CONFLICT(code) DO NOTHING`,
      [root, root === 'HARDWARE' ? 'Hardware' : 'Software']);
  }
  const root = await client.query<{ id: number }>('SELECT id FROM ci_categories WHERE code=$1 AND active', ['HARDWARE']);
  if (!root.rows[0]) throw new Error('Falta la categoría Hardware activa.');
  for (const category of classes) {
    await client.query(`INSERT INTO ci_categories(code,name,parent_id,source_kind,source_reference)
      VALUES($1,$2,$3,'PROJECT','Subcategoría sintética; decisión del proyecto')
      ON CONFLICT(code) DO NOTHING`, [category.code,category.name,root.rows[0].id]);
  }
  for (const location of locations) {
    await client.query(`INSERT INTO ci_locations(code,name) VALUES($1,$2)
      ON CONFLICT(code) DO NOTHING`, [location.code,location.name]);
  }
  const categoryRows = await client.query<{ id: number; code: string; parent_id: number; source_kind: string }>(
    'SELECT id,code,parent_id,source_kind FROM ci_categories WHERE code=ANY($1::text[]) AND active',
    [classes.map((item) => item.code)],
  );
  if (categoryRows.rowCount !== classes.length) throw new Error('Falta alguna subcategoría activa.');
  if (categoryRows.rows.some((row) => row.parent_id !== root.rows[0].id || row.source_kind !== 'PROJECT')) {
    throw new Error('Las subcategorías sintéticas existentes no coinciden con la jerarquía Hardware → clase.');
  }
  const locationRows = await client.query<{ id: number; code: string; name: string }>(
    'SELECT id,code,name FROM ci_locations WHERE code=ANY($1::text[]) AND active',
    [locations.map((item) => item.code)],
  );
  if (locationRows.rowCount !== locations.length) throw new Error('Falta alguna ubicación activa.');
  if (locationRows.rows.some((row) => locations.find((location) => location.code === row.code)?.name !== row.name)) {
    throw new Error('Una ubicación sintética existente tiene un nombre distinto al definido para esta semilla.');
  }
  const users = await client.query<{ id: number }>("SELECT id FROM users WHERE active AND username='admin.demo'");
  const services = await client.query<{ id: number }>('SELECT id FROM service_level_2 ORDER BY id');
  if (!users.rows.length || !services.rows.length) throw new Error('Ejecuta seed-demo e import-catalog antes de generar la CMDB; la carga sintética requiere la cuenta de demostración admin.demo.');
  return {
    categories: new Map(categoryRows.rows.map((row) => [row.code,row.id])),
    locations: new Map(locationRows.rows.map((row) => [row.code,row])),
    users: users.rows,
    services: services.rows,
  };
}

function technical(index: number, categoryCode: string) {
  if (categoryCode === 'HW-SERVER') return { cpuCores: 4 + (index % 8) * 2, memoryGb: 16 + (index % 8) * 8, rackUnit: 1 + (index % 4) };
  if (categoryCode === 'HW-WORKSTATION') return { cpuCores: 4 + (index % 4) * 2, memoryGb: 8 + (index % 4) * 8, formFactor: 'desktop' };
  if (categoryCode === 'HW-NETWORK') return { ports: 8 + (index % 6) * 8, managed: true, protocol: 'ethernet' };
  return { capacityTb: 2 + (index % 12) * 2, driveCount: 2 + (index % 6) * 2 };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  try {
    await client.query('BEGIN');
    const references = await prepare(client);
    let seedOffset = 0;
    for (const char of seed) seedOffset = (seedOffset * 31 + char.charCodeAt(0)) >>> 0;
    for (let start = 1; start <= count; start += 250) {
      const end = Math.min(count, start + 249);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      const serviceLinks: Array<[string,number]> = [];
      const codes: string[] = [];
      for (let index = start; index <= end; index++) {
        const classIndex = (index + seedOffset) % classes.length;
        const category = classes[classIndex];
        const location = locations[(Math.floor(index / 4) + seedOffset) % locations.length];
        const selectedLocation = references.locations.get(location.code)!;
        const code = `SYN-${seed}-${String(index).padStart(6,'0')}`;
        codes.push(code);
        const serialNumber = `SN-${seed}-${String(index).padStart(7,'0')}`;
        const offset = values.length;
        values.push(code, `${category.name} ${index}`, references.categories.get(category.code),
          selectedLocation.name, selectedLocation.id, references.users[index % references.users.length].id,
          serialNumber, JSON.stringify(technical(index,category.code)), seed);
        placeholders.push(`(${Array.from({ length: 9 }, (_, part) => '$' + (offset + part + 1)).join(',')})`);
        serviceLinks.push([code, references.services[index % references.services.length].id]);
      }
      const inserted = await client.query(`INSERT INTO configuration_items
        (code,name,category_id,location,location_id,responsible_user_id,serial_number,technical_attributes,synthetic_seed)
        VALUES ${placeholders.join(',')}
        ON CONFLICT(code) DO NOTHING RETURNING id`, values);
      const createdInBatch = inserted.rowCount ?? 0;
      created += createdInBatch;
      const normalizedOwners = await client.query(`WITH candidates AS MATERIALIZED (
          SELECT id,code,responsible_user_id AS old_owner FROM configuration_items
          WHERE synthetic_seed=$2 AND is_device AND code=ANY($3::text[])
          FOR UPDATE
        ), changed AS (
          UPDATE configuration_items ci SET responsible_user_id=$1,updated_at=NOW()
          FROM candidates candidate
          WHERE ci.id=candidate.id AND ci.responsible_user_id IS DISTINCT FROM $1
          RETURNING ci.id
        ), audit AS (
          INSERT INTO ci_history(ci_id,actor_id,action,old_values,new_values,description)
          SELECT changed.id,$1,'SYNTHETIC_OWNER_NORMALIZE',
            jsonb_build_object('responsible_user_id',candidate.old_owner),
            jsonb_build_object('responsible_user_id',$1),
            'Responsable de dispositivo sintético normalizado a la cuenta de demostración admin.demo.'
          FROM changed JOIN candidates candidate ON candidate.id=changed.id
          RETURNING ci_id
        ) SELECT COUNT(*)::int AS count FROM audit`, [references.users[0].id,seed,codes]);
      const updatedInBatch = normalizedOwners.rows[0].count as number;
      updated += updatedInBatch;
      skipped += end - start + 1 - createdInBatch - updatedInBatch;
      const linkValues: unknown[] = [];
      const linkPlaceholders: string[] = [];
      for (const [code, serviceId] of serviceLinks) {
        const offset = linkValues.length;
        linkValues.push(code, serviceId);
        linkPlaceholders.push(`($${offset + 1}::text,$${offset + 2}::integer)`);
      }
      await client.query(`INSERT INTO ci_services(ci_id,service_id)
        SELECT ci.id,v.service_id FROM (VALUES ${linkPlaceholders.join(',')}) AS v(code,service_id)
        JOIN configuration_items ci ON ci.code=v.code
        ON CONFLICT DO NOTHING`, linkValues);
    }
    const totals = await client.query<{ total: number }>(`SELECT COUNT(*)::int AS total
      FROM configuration_items WHERE synthetic_seed=$1 AND is_device`, [seed]);
    const categories = await client.query(`SELECT cc.code,COUNT(*)::int AS count
      FROM configuration_items ci JOIN ci_categories cc ON cc.id=ci.category_id
      WHERE ci.synthetic_seed=$1 AND ci.is_device GROUP BY cc.code ORDER BY cc.code`, [seed]);
    const levelAndCategory = await client.query(`WITH RECURSIVE category_tree(id,code,name,level_no,path) AS (
        SELECT id,code,name,0,ARRAY[id] FROM ci_categories WHERE parent_id IS NULL AND active
        UNION ALL
        SELECT child.id,child.code,child.name,parent.level_no+1,parent.path||child.id
        FROM ci_categories child JOIN category_tree parent ON child.parent_id=parent.id WHERE child.active
      )
      SELECT ancestor.level_no AS level,ancestor.code AS category_code,ancestor.name AS category_name,
        COUNT(DISTINCT ci.id)::int AS count
      FROM category_tree ancestor
      LEFT JOIN category_tree leaf ON ancestor.id=ANY(leaf.path)
      LEFT JOIN configuration_items ci ON ci.category_id=leaf.id AND ci.synthetic_seed=$1 AND ci.is_device
      WHERE ancestor.code=ANY($2::text[])
      GROUP BY ancestor.level_no,ancestor.code,ancestor.name
      ORDER BY ancestor.level_no,ancestor.code`, [seed,['HARDWARE','SOFTWARE',...classes.map((item) => item.code)]]);
    if (totals.rows[0].total < count) throw new Error(`Solo hay ${totals.rows[0].total} dispositivos de ${count} esperados.`);
    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: true, seed, requested: count, created, updated, skipped,
      totalForSeed: totals.rows[0].total, byCategory: categories.rows,
      byLevelAndCategory: levelAndCategory.rows }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
