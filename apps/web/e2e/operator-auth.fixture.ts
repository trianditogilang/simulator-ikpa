import { test as base, expect, type Page } from "@playwright/test";

type OperatorFixtures = {
	operatorPage: Page;
};

/**
 * Adds the short-lived Clerk session to browser requests without writing a
 * storageState file. The runner owns session creation and revocation.
 */
export const test = base.extend<OperatorFixtures>({
	operatorPage: async ({ page }, use) => {
		const sessionToken = process.env.F13_04_CLERK_SESSION_TOKEN;
		if (!sessionToken) {
			throw new Error(
				"F13-04 requires the authenticated runner; use node scripts/run-f13-04-e2e.mjs.",
			);
		}

		await page.context().setExtraHTTPHeaders({
			authorization: `Bearer ${sessionToken}`,
		});
		await use(page);
	},
});

export { expect };
