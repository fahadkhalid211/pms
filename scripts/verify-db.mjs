import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lumina_pms'
});

async function main() {
  await client.connect();
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log(`Total tables: ${tables.rows.length}`);
  console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));

  const tsvIdx = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%tsv%'");
  console.log('TSV indexes:', tsvIdx.rows);

  const roomNightIdx = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'RoomNight'");
  console.log('RoomNight indexes:', roomNightIdx.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
