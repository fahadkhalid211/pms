import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";

const dbDir = path.resolve("./.pgdata");
const isFirstRun = !fs.existsSync(dbDir);

const pg = new EmbeddedPostgres({
  databaseDir: dbDir,
  port: 5432,
  user: "postgres",
  password: "postgres",
  persistent: true,
});

if (isFirstRun) {
  console.log("Initialising PostgreSQL cluster...");
  await pg.initialise();
}

console.log("Starting PostgreSQL server on port 5432...");
await pg.start();
console.log("PostgreSQL is running on port 5432 and ready for connections!");

try {
  await pg.createDatabase("lumina_pms");
  console.log("Database 'lumina_pms' ready.");
} catch {
  // Database may already exist
}

const shutdown = async () => {
  console.log("Stopping PostgreSQL...");
  await pg.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep alive
await new Promise(() => {});
