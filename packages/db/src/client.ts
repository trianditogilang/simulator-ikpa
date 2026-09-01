import { Pool, neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
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

/**
 * Creates an HTTP-based Neon database client (recommended for serverless functions / request handlers).
 */
export function createDbClient(connectionString?: string) {
	const url = connectionString || getDatabaseUrl();
	const sql = neon(url);
	return drizzleHttp(sql, { schema });
}

/**
 * Creates a WebSocket Pool-based Neon database client (recommended for long-running scripts / migrations / seeds).
 */
export function createPoolDbClient(connectionString?: string) {
	const url = connectionString || getDatabaseUrl();
	const pool = new Pool({ connectionString: url });
	return drizzleServerless(pool, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
export type PoolDbClient = ReturnType<typeof createPoolDbClient>;

export { schema };
