import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { HttpError } from "@/lib/http";

type PostwaveDatabase = ReturnType<typeof drizzle>;
type DatabaseGlobals = typeof globalThis & {
  __postwavePool?: Pool;
  __postwaveDb?: PostwaveDatabase;
};

const globals = globalThis as DatabaseGlobals;

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new HttpError(503, "PostgreSQL is not configured for this deployment.");
  }

  if (
    process.env.REPLIT_ENVIRONMENT &&
    process.env.POSTWAVE_ALLOW_EXTERNAL_DATABASE !== "true"
  ) {
    throw new HttpError(
      503,
      "Configure an external PostgreSQL URL and set POSTWAVE_ALLOW_EXTERNAL_DATABASE=true before using Postwave data features here.",
    );
  }

  const pool =
    globals.__postwavePool ??
    (globals.__postwavePool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    }));
  const db =
    globals.__postwaveDb ?? (globals.__postwaveDb = drizzle(pool, { schema }));

  return { db, pool };
}
