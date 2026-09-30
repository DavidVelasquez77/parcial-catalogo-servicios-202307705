import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const migrationDir = path.resolve(__dirname, '../../../../database/migrations');
    const files = fs.readdirSync(migrationDir).filter((file) => file.endsWith('.sql')).sort();
    const table = await client.query<{ table: string | null }>(`SELECT to_regclass('public.schema_migrations') AS table`);
    const applied = table.rows[0]?.table ? await client.query<{ version: number }>('SELECT version FROM schema_migrations') : { rows: [] };
    const versions = new Set(applied.rows.map((row) => Number(row.version)));
    for (const file of files) {
      const version = Number(file.split('_')[0]);
      if (versions.has(version)) continue;
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(migrationDir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
        await client.query('COMMIT');
        console.log(`migration ${file}: applied`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
