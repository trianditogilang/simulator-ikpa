import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index";

export function getDatabaseUrl(): string {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error(
			"[FATAL] DATABASE_URL is not defined in environment variables. Please check your .env configuration.",
		);
	}
	return url;
}

// Server modules call createDbClient() on every request, so the pool must be
// shared per connection string; a new Pool per call would leak connections.
const pools = new Map<string, Pool>();

export function createDbClient(connectionString?: string) {
	const url = connectionString || getDatabaseUrl();
	let pool = pools.get(url);
	if (!pool) {
		// allowExitOnIdle lets seed/CLI scripts exit without an explicit pool.end().
		pool = new Pool({ connectionString: url, allowExitOnIdle: true });
		pools.set(url, pool);
	}
	return drizzle(pool, { schema });
}

/** Kept for existing callers (seed, scripts); same pooled client. */
export const createPoolDbClient = createDbClient;

export type DbClient = ReturnType<typeof createDbClient>;
export type PoolDbClient = DbClient;

export { schema };
