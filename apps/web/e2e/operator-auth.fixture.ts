import { test as base, expect, type Page } from "@playwright/test";
import { addSessionCookie } from "./session-cookie";

type OperatorFixtures = {
	operatorPage: Page;
};

/** Operator session for F13-04; the runner owns session creation. */
export const test = base.extend<OperatorFixtures>({
	operatorPage: async ({ page, baseURL }, use) => {
		const sessionCookie = process.env.F13_04_SESSION_COOKIE;
		if (!sessionCookie || !baseURL) {
			throw new Error(
				"F13-04 requires the authenticated runner; use node scripts/run-f13-04-e2e.mjs.",
			);
		}

		await addSessionCookie(page.context(), sessionCookie, baseURL);
		await use(page);
	},
});

export { expect };
