import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({connectionString:process.env.DATABASE_URL});
  try {
    const result = await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM service_level_1) AS level1,
      (SELECT COUNT(*)::int FROM service_level_2) AS level2,
      (SELECT COUNT(*)::int FROM configuration_items WHERE is_device AND synthetic_seed='EVAL2026') AS devices,
      (SELECT COUNT(*)::int FROM configuration_items WHERE code LIKE 'CMDB-XLSX-%') AS source_ci,
      (SELECT COUNT(*)::int FROM tickets) AS tickets,
      (SELECT COUNT(*)::int FROM ticket_history) AS history,
      (SELECT COUNT(*)::int FROM support_queues) AS queues`);
    const row = result.rows[0];
    if (row.level1!==12 || row.level2!==46 || row.devices!==5000 || row.source_ci<2 || row.tickets<35 || row.history<35 || row.queues<7) {
      throw new Error(`Conjunto incompleto tras reinicio: ${JSON.stringify(row)}`);
    }
    console.log(JSON.stringify(row));
  } finally {await pool.end();}
}
main().catch((error) => {console.error(error);process.exitCode=1;});
