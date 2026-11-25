import { test, expect } from "./operator-auth.fixture";

const fixtureTag = process.env.F13_04_E2E_TAG ?? `local-${Date.now()}`;

const indicatorDestinations = [
	{ path: "/operator/data/budget-revisions", label: "Revisi DIPA" },
	{ path: "/operator/deviasi", label: "Deviasi Halaman III DIPA" },
	{ path: "/operator/penyerapan", label: "Penyerapan Anggaran" },
	{
		path: "/operator/data/contracts-invoices?tab=contracts",
		label: "Belanja Kontraktual",
	},
	{
		path: "/operator/data/contracts-invoices?tab=invoices",
		label: "Penyelesaian Tagihan",
	},
	{ path: "/operator/up-tup", label: "Pengelolaan UP / TUP" },
	{ path: "/operator/data/output-achievement", label: "Capaian Output" },
	{ path: "/operator/data/spm-dispensation", label: "SPM Dispensasi" },
] as const;

const serverErrorPattern = /Error connecting to database|Internal Server Error|Application error/i;

async function gotoOperatorPage(
	page: import("@playwright/test").Page,
	path: string,
) {
	let lastError: unknown;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			const response = await page.goto(path, { waitUntil: "domcontentloaded" });
			await expect
				.poll(() => page.locator("main").count(), { timeout: 15_000 })
				.toBeGreaterThan(0);
			await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
			await page.waitForTimeout(250);
			return response;
		} catch (error) {
			lastError = error;
			if (attempt < 2) await page.waitForTimeout(1_000);
		}
	}
	throw lastError instanceof Error ? lastError : new Error("Operator page did not load.");
}

async function expectOperatorPageHealthy(page: import("@playwright/test").Page) {
	await expect(page.locator("main")).toBeVisible();
	await expect(page.locator("main")).not.toContainText(serverErrorPattern);
}

test.describe("F13-04 authenticated Operator", () => {
	test("opens the authenticated dashboard with all eight indicators", async ({ operatorPage }) => {
		const response = await gotoOperatorPage(operatorPage, "/operator/dashboard");
		expect(response?.status()).toBe(200);
		await expectOperatorPageHealthy(operatorPage);
		await expect(operatorPage.locator('[data-slot="score-card"]')).toContainText(
			"Proyeksi Nilai IKPA Satker",
		);
		await expect(operatorPage.getByRole("heading", { name: "8 Indikator IKPA" })).toBeVisible();
		await expect(operatorPage.locator('[data-slot="indicator-card"]')).toHaveCount(8);
		for (const destination of indicatorDestinations) {
			await expect(
				operatorPage
					.locator('[data-slot="indicator-card"]')
					.locator(`a[href^="${destination.path.split("?")[0]}"]`)
					.first(),
			).toBeVisible();
		}
	});

	test("navigates each of the eight indicator workspaces", async ({ operatorPage }) => {
		for (const destination of indicatorDestinations) {
			const response = await gotoOperatorPage(operatorPage, destination.path);
			expect(response?.status(), destination.path).toBe(200);
			await expectOperatorPageHealthy(operatorPage);
			await expect(operatorPage.locator("main")).toContainText(destination.label);
		}
	});

	test("keeps actual data separate while a what-if plan is calculated and saved to a slot", async ({
		operatorPage,
	}, testInfo) => {
		await gotoOperatorPage(operatorPage, "/operator/data/budget-revisions");
		await expectOperatorPageHealthy(operatorPage);

		const whatIfPanel = operatorPage.getByRole("region", {
			name: "Simulasi What-If Rencana Revisi",
		});
		const simInput = whatIfPanel.locator("#sim-add-s1");
		if (!(await simInput.isVisible())) {
			const panelToggle = whatIfPanel.getByRole("button", {
				name: "Maximize panel simulasi",
			});
			for (let attempt = 0; attempt < 3 && !(await simInput.isVisible()); attempt += 1) {
				await panelToggle.click({ force: true });
				await operatorPage.waitForTimeout(500);
			}
			if (!(await simInput.isVisible())) {
				await operatorPage.evaluate(() => window.localStorage.setItem("ikpa-whatif-revisi", "open"));
				await operatorPage.reload({ waitUntil: "domcontentloaded" });
				await expect(operatorPage.locator("main")).toBeVisible();
			}
		}
		await expect(simInput).toBeVisible({ timeout: 30_000 });
		const actualSemesterOne = await whatIfPanel.getByText(/Aktual:/).first().textContent();
		await whatIfPanel.locator("#sim-add-s1").fill("1");
		await expect(whatIfPanel).toContainText("Skor Simulasi");
		await expect(whatIfPanel).toContainText("Dampak Rencana");
		await expect(whatIfPanel.getByText(/Aktual:/).first()).toHaveText(actualSemesterOne ?? "");

		const scenarioName = `Skenario B: F13-04 E2E ${fixtureTag} ${testInfo.project.name}`;
		await whatIfPanel.getByRole("button", { name: "Simpan Skenario (A/B/C)" }).click();
		const dialog = operatorPage.getByRole("dialog");
		await expect(dialog).toContainText("Mode simulasi lokal");
		const slotB = dialog.locator("button").filter({ hasText: /Skenario B/ }).first();
		await expect(slotB).toBeVisible();
		await slotB.click({ force: true });
		await dialog.locator("#scenario-name").fill(scenarioName);
		await dialog.getByRole("button", { name: "Simpan Skenario", exact: true }).click();
		await expect(dialog).toContainText("Skenario Berhasil Disimpan!", { timeout: 30_000 });
		await expect(dialog).toContainText(scenarioName);

		await gotoOperatorPage(operatorPage, "/operator/history");
		await expectOperatorPageHealthy(operatorPage);
		await operatorPage.getByRole("button", { name: "Skenario Simulasi (Slot A, B, C)" }).click();
		await expect(operatorPage.locator("main")).toContainText(scenarioName);
		await expect(operatorPage.locator("main")).toContainText("Slot B");
	});

	test("shows actual-history parity and supports monthly/scenario comparison", async ({ operatorPage }) => {
		await gotoOperatorPage(operatorPage, "/operator/dashboard");
		await expectOperatorPageHealthy(operatorPage);
		const dashboardTotal = await operatorPage
			.locator('[data-slot="score-card"]')
			.locator(".text-3xl, .sm\\:text-4xl")
			.first()
			.textContent();

		await gotoOperatorPage(operatorPage, "/operator/history");
		await expectOperatorPageHealthy(operatorPage);
		await expect(operatorPage.locator("main")).toContainText("Evaluasi Kinerja Aktual 12 Bulan");
		const julyRow = operatorPage.getByRole("row").filter({ hasText: "Bulan 7" }).first();
		const julyCompare = julyRow.getByRole("button", { name: "Bandingkan", exact: true });
		await expect(julyCompare).toBeVisible();
		await julyCompare.click({ force: true });
		await expect(operatorPage.locator("main")).toContainText("Pilih Item Perbandingan (2 s.d. 3 Item)", { timeout: 30_000 });
		const augustCompare = operatorPage.getByRole("button", { name: /Evaluasi Agustus/ }).first();
		await expect(augustCompare).toBeVisible();
		await augustCompare.click({ force: true });
		const scenarioCompare = operatorPage
			.getByRole("button", { name: /Skenario B: F13-04 E2E/ })
			.first();
		await expect(scenarioCompare).toBeVisible();
		await scenarioCompare.click({ force: true });
		await expect(operatorPage.locator("main")).toContainText("Indikator IKPA");
		if (dashboardTotal?.trim()) {
			await expect(operatorPage.locator("main")).toContainText(dashboardTotal.trim());
		}
	});

	test("renders mandatory reminder controls and downloads the authenticated Operator XLSX", async ({ operatorPage }) => {
		await gotoOperatorPage(operatorPage, "/operator/reminders");
		await expectOperatorPageHealthy(operatorPage);
		await expect(operatorPage.locator("main")).toContainText("Reminder Center");
		await expect(operatorPage.locator("main")).toContainText("KPPN Compliance Guard");
		await expect(operatorPage.locator("main")).toContainText(/Mandatory/i);

		await gotoOperatorPage(operatorPage, "/operator/reports");
		await expectOperatorPageHealthy(operatorPage);
		await expect(operatorPage.locator("main")).toContainText("Laporan & Ekspor Simulasi IKPA");
		const downloadPromise = operatorPage.waitForEvent("download");
		await operatorPage.getByRole("button", { name: "Unduh Laporan (XLSX)" }).click();
		const download = await downloadPromise;
		expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
	});
});
