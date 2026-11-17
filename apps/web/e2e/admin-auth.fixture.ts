import { test as base, expect, type Page } from "@playwright/test";
import { addSessionCookie } from "./session-cookie";

type AdminFixtures = {
	adminPage: Page;
};

/** Admin KPPN session for F13-05; the runner owns session creation. */
export const test = base.extend<AdminFixtures>({
	adminPage: async ({ page, baseURL }, use) => {
		const sessionCookie = process.env.F13_05_SESSION_COOKIE;
		if (!sessionCookie || !baseURL) {
			throw new Error(
				"F13-05 requires the authenticated runner; use node scripts/run-f13-05-e2e.mjs.",
			);
		}

		await addSessionCookie(page.context(), sessionCookie, baseURL);
		await use(page);
	},
});

export { expect };
