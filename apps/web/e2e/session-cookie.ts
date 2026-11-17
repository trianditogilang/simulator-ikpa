import type { BrowserContext } from "@playwright/test";

/**
 * Installs the session cookie the runner obtained through the real sign-in
 * flow. Nothing is written to disk; the session lives in the test database.
 */
export async function addSessionCookie(
	context: BrowserContext,
	cookieHeader: string,
	baseURL: string,
) {
	await context.addCookies(
		cookieHeader.split("; ").map((pair) => {
			const separator = pair.indexOf("=");
			return {
				name: pair.slice(0, separator),
				value: pair.slice(separator + 1),
				url: baseURL,
			};
		}),
	);
}
