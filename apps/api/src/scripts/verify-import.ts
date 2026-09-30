import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const counts = await pool.query<{ level1: number; level2: number; duplicates: number; review: number }>(`SELECT
      (SELECT COUNT(*) FROM service_level_1)::INTEGER AS level1,
      (SELECT COUNT(*) FROM service_level_2)::INTEGER AS level2,
      (SELECT COUNT(*) - COUNT(DISTINCT code) FROM service_level_2)::INTEGER AS duplicates,
      (SELECT COUNT(*) FROM service_level_2 WHERE status='REVIEW')::INTEGER AS review`);
    const result = counts.rows[0];
    const ok = result.level1 === 12 && result.level2 === 46 && result.duplicates === 0;
    console.log(JSON.stringify({ ok, ...result }));
    if (!ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
