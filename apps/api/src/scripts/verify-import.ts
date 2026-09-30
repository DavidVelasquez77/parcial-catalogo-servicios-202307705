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
    const expectedLevel1 = Number(process.env.EXPECTED_LEVEL1_COUNT ?? 12);
    const expectedLevel2 = Number(process.env.EXPECTED_LEVEL2_COUNT ?? 46);
    const expectedReview = Number(process.env.EXPECTED_REVIEW_COUNT ?? 3);
    const ok = result.level1 === expectedLevel1 && result.level2 === expectedLevel2 && result.duplicates === 0 && result.review === expectedReview;
    console.log(JSON.stringify({ ok, ...result, expected: { level1: expectedLevel1, level2: expectedLevel2, review: expectedReview } }));
    if (!ok) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
