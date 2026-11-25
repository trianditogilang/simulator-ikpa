import { expect, test } from "vitest";
import { createDbClient, createPoolDbClient } from "./client";

// pg.Pool connects lazily, so no database is needed here.
test("clients for the same connection string share one pool", () => {
	const url = "postgresql://user:pass@127.0.0.1:1/none";
	const pool = createDbClient(url).$client;

	expect(createDbClient(url).$client).toBe(pool);
	expect(createPoolDbClient(url).$client).toBe(pool);
	expect(createDbClient(`${url}-other`).$client).not.toBe(pool);
});
