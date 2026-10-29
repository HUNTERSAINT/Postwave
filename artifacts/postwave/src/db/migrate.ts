import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { logger } from "@/lib/logger";

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }
  if (
    process.env.REPLIT_ENVIRONMENT &&
    process.env.POSTWAVE_ALLOW_EXTERNAL_DATABASE !== "true"
  ) {
    throw new Error(
      "Migrations are blocked here until an external PostgreSQL URL is explicitly enabled.",
    );
  }

  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 8_000 });
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query("SELECT pg_advisory_lock(8124130000001)");
    locked = true;
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    logger.info("Postwave database migrations completed");
  } finally {
    if (locked) {
      await client.query("SELECT pg_advisory_unlock(8124130000001)").catch(() => undefined);
    }
    client.release();
    await pool.end();
  }
}

runMigrations().catch((error: unknown) => {
  logger.error(
    { errorName: error instanceof Error ? error.name : "UnknownError" },
    "Postwave database migrations failed",
  );
  process.exitCode = 1;
});
