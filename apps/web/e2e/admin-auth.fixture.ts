import { test as base, expect, type Page } from "@playwright/test";

type AdminFixtures = {
	adminPage: Page;
};

/**
 * Adds the short-lived Clerk Admin session to browser requests. The runner
 * owns session creation and revocation; no token is written to disk.
 */
export const test = base.extend<AdminFixtures>({
	adminPage: async ({ page }, use) => {
		const sessionToken = process.env.F13_05_CLERK_SESSION_TOKEN;
		if (!sessionToken) {
			throw new Error(
				"F13-05 requires the authenticated runner; use node scripts/run-f13-05-e2e.mjs.",
			);
		}

		await page.context().setExtraHTTPHeaders({
			authorization: `Bearer ${sessionToken}`,
		});
		await use(page);
	},
});

export { expect };
