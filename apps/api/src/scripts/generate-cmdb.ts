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
  const categoryRows = await client.query<{ id: number; code: string }>(
    'SELECT id,code FROM ci_categories WHERE code=ANY($1::text[]) AND active',
    [classes.map((item) => item.code)],
  );
  if (categoryRows.rowCount !== classes.length) throw new Error('Falta alguna subcategoría activa.');
  const locationRows = await client.query<{ id: number; code: string; name: string }>(
    'SELECT id,code,name FROM ci_locations WHERE code=ANY($1::text[]) AND active',
    [locations.map((item) => item.code)],
  );
  if (locationRows.rowCount !== locations.length) throw new Error('Falta alguna ubicación activa.');
  const users = await client.query<{ id: number }>('SELECT id FROM users WHERE active ORDER BY id');
  const services = await client.query<{ id: number }>('SELECT id FROM service_level_2 ORDER BY id');
  if (!users.rows.length || !services.rows.length) throw new Error('Ejecuta seed-demo e import-catalog antes de generar la CMDB.');
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
      for (let index = start; index <= end; index++) {
        const classIndex = (index + seedOffset) % classes.length;
        const category = classes[classIndex];
        const location = locations[(Math.floor(index / 4) + seedOffset) % locations.length];
        const selectedLocation = references.locations.get(location.code)!;
        const code = `SYN-${seed}-${String(index).padStart(6,'0')}`;
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
      created += inserted.rowCount ?? 0;
      skipped += end - start + 1 - (inserted.rowCount ?? 0);
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
    if (totals.rows[0].total < count) throw new Error(`Solo hay ${totals.rows[0].total} dispositivos de ${count} esperados.`);
    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: true, seed, requested: count, created, skipped,
      totalForSeed: totals.rows[0].total, byCategory: categories.rows }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
