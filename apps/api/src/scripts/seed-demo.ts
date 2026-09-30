import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';

async function upsert(client: { query: <T = unknown>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> }, sql: string, values: unknown[]) {
  const result = await client.query<{ id: number }>(sql, values);
  return result.rows[0].id;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const classes = ['A DEMANDA', 'RECURRENTE'];
    const criticalities = ['Very Low', 'Low', 'Normal', 'High', 'Very High'];
    const types = ['Back End', 'Demostration', 'End User Service', 'Front End', 'IT Management', 'IT Operational', 'Other', 'Project', 'Reporting', 'Training', 'Underpinning Contract'];
    for (const label of classes) await client.query('INSERT INTO service_classes(label) VALUES($1) ON CONFLICT(label) DO NOTHING', [label]);
    for (const label of criticalities) await client.query('INSERT INTO criticalities(label) VALUES($1) ON CONFLICT(label) DO NOTHING', [label]);
    for (const label of types) await client.query('INSERT INTO service_types(label) VALUES($1) ON CONFLICT(label) DO NOTHING', [label]);
    const companyId = await upsert(client, `INSERT INTO companies(code,name) VALUES($1,$2) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name RETURNING id`, ['EMP-DEMO', 'Empresa demostración']);
    const areaId = await upsert(client, `INSERT INTO areas(company_id,code,name) VALUES($1,$2,$3) ON CONFLICT(company_id,code) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [companyId, 'AREA-TI', 'Tecnología de Información']);
    const departmentId = await upsert(client, `INSERT INTO departments(area_id,code,name) VALUES($1,$2,$3) ON CONFLICT(area_id,code) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [areaId, 'DEP-SERV', 'Servicios TI']);
    const sectionId = await upsert(client, `INSERT INTO sections(department_id,code,name) VALUES($1,$2,$3) ON CONFLICT(department_id,code) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [departmentId, 'SEC-SOP', 'Soporte y operación']);
    const positionId = await upsert(client, `INSERT INTO positions(section_id,code,name) VALUES($1,$2,$3) ON CONFLICT(section_id,code) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [sectionId, 'PUESTO-ADM', 'Administrador de catálogo']);
    const queryPositionId = await upsert(client, `INSERT INTO positions(section_id,code,name) VALUES($1,$2,$3) ON CONFLICT(section_id,code) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [sectionId, 'PUESTO-CONS', 'Consulta de servicios']);
    const adminHash = await bcrypt.hash(process.env.DEMO_ADMIN_PASSWORD ?? 'Admin123!', 12);
    const queryHash = await bcrypt.hash(process.env.DEMO_QUERY_PASSWORD ?? 'Consulta123!', 12);
    await client.query(`INSERT INTO users(name,username,email,password_hash,role,position_id) VALUES($1,$2,$3,$4,'ADMIN',$5)
      ON CONFLICT(username) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,role='ADMIN',active=TRUE,position_id=EXCLUDED.position_id`, ['Administrador demo', process.env.DEMO_ADMIN_USERNAME ?? 'admin.demo', 'admin.demo@example.local', adminHash, positionId]);
    await client.query(`INSERT INTO users(name,username,email,password_hash,role,position_id) VALUES($1,$2,$3,$4,'CONSULTA',$5)
      ON CONFLICT(username) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,role='CONSULTA',active=TRUE,position_id=EXCLUDED.position_id`, ['Usuario consulta demo', process.env.DEMO_QUERY_USERNAME ?? 'consulta.demo', 'consulta.demo@example.local', queryHash, queryPositionId]);
    console.log(JSON.stringify({ ok: true, companyId, areaId, departmentId, sectionId, demoUsers: [process.env.DEMO_ADMIN_USERNAME ?? 'admin.demo', process.env.DEMO_QUERY_USERNAME ?? 'consulta.demo'] }));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
