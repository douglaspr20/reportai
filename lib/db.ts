import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://reportai:reportai@localhost:5433/reportai";

// En dev, Next recarga los módulos en cada cambio: reutilizamos el pool.
const globalForDb = globalThis as unknown as { pool?: Pool; readOnlyPool?: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });

/**
 * Conexión con el rol reportai_reader (db/migrations/004_readonly_role.sql):
 * solo lectura y solo sobre las tablas estructuradas. Es la única con la que se
 * ejecuta SQL generado por el modelo.
 */
export const readOnlyPool =
  globalForDb.readOnlyPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_READONLY_URL ??
      "postgresql://reportai_reader:reportai_reader@localhost:5433/reportai",
    max: 3,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
  globalForDb.readOnlyPool = readOnlyPool;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  params?: unknown[]
) {
  const result = await pool.query<T>(text, params as never[]);
  return result.rows;
}
