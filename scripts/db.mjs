// Local development/test database: an embedded MySQL server (no Docker required).
// Production uses Hostinger's managed MySQL/MariaDB via DATABASE_URL instead.
import { createDB } from "mysql-memory-server";

const PORT = Number(process.env.MYSQL_PORT || 3306);
const DB_NAME = process.env.MYSQL_DB || "lumina_pms";

console.log(`Starting embedded MySQL on port ${PORT} (first run downloads the server binary)...`);

const db = await createDB({
  dbName: DB_NAME,
  username: "root",
  port: PORT,
  logLevel: "ERROR",
  ignoreUnsupportedSystemVersion: true,
});

console.log(`MySQL is ready. DATABASE_URL=mysql://root@127.0.0.1:${db.port}/${db.dbName}`);

const shutdown = async () => {
  console.log("Stopping MySQL...");
  await db.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep alive
await new Promise(() => {});
