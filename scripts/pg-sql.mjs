import pg from "pg";

/**
 * Tagged-template query helper for the F13 runner scripts:
 * sql`SELECT ... WHERE id = ${id}` resolves to the result rows, with every
 * interpolated value sent as a bound parameter.
 */
export function createSql(connectionString) {
	const pool = new pg.Pool({ connectionString, allowExitOnIdle: true });
	return (strings, ...values) =>
		pool
			.query(
				strings.reduce((text, part, i) => `${text}$${i}${part}`),
				values,
			)
			.then((result) => result.rows);
}
