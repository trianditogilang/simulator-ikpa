import { expect, test } from "@playwright/test";

test("public landing shell loads", async ({ page }) => {
	await page.goto("/");

	await expect(page).toHaveTitle(/Simulator Penilaian IKPA Satker/i);
	await expect(page.locator("body")).toContainText(/Simulator IKPA|IKPA SATKER/i);
});
