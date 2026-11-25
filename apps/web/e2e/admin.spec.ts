import { test, expect } from "./admin-auth.fixture";
import type { Page } from "@playwright/test";

const ownActualCode = process.env.F13_05_OWN_ACTUAL_CODE ?? "";
const ownForecastCode = process.env.F13_05_OWN_FORECAST_CODE ?? "";
const ownEmptyCode = process.env.F13_05_OWN_EMPTY_CODE ?? "";
const ownActualOrgId = process.env.F13_05_OWN_ACTUAL_ORG_ID ?? "";
const peerOrgId = process.env.F13_05_PEER_ORG_ID ?? "";
const peerMarker = process.env.F13_05_PEER_MARKER ?? "";

const serverErrorPattern =
	/Error connecting to database|Internal Server Error|Application error/i;

async function gotoAdminPage(page: Page, path: string) {
	let lastError: unknown;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			const response = await page.goto(path, { waitUntil: "domcontentloaded" });
			await expect
				.poll(() => page.locator("main").count(), { timeout: 15_000 })
				.toBeGreaterThan(0);
			await page
				.waitForLoadState("networkidle", { timeout: 15_000 })
				.catch(() => undefined);
			await page.waitForTimeout(250);
			return response;
		} catch (error) {
			lastError = error;
			if (attempt < 2) await page.waitForTimeout(1_000);
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error("Admin page did not load.");
}

async function expectAdminPageHealthy(page: Page) {
	await expect(page.locator("main")).toBeVisible();
	await expect(page.locator("main")).not.toContainText(serverErrorPattern);
}

test.describe("F13-05 authenticated Admin KPPN", () => {
	test("reads the scoped dashboard aggregate and eight indicator sources", async ({
		adminPage,
	}) => {
		const response = await gotoAdminPage(adminPage, "/admin-kppn/dashboard");
		expect(response?.status()).toBe(200);
		await expectAdminPageHealthy(adminPage);
		const main = adminPage.locator("main");

		await expect(
			main.getByRole("heading", { name: "Monitoring Kinerja Satuan Kerja Mitra" }),
		).toBeVisible();
		await expect(
			main.getByRole("heading", { name: "Agregat 8 Indikator Wilayah" }),
		).toBeVisible();
		for (const label of [
			"Revisi DIPA",
			"Deviasi Hal III",
			"Penyerapan Anggaran",
			"Belanja Kontraktual",
			"Penyelesaian Tagihan",
			"UP/TUP & KKP",
			"Capaian Output",
			"Dispensasi SPM",
		]) {
			await expect(main).toContainText(label);
		}
		await expect(main).toContainText(ownActualCode);
		await expect(main).not.toContainText(peerMarker);
	});

	test("lists only its KPPN scope with actual, projection, and empty states", async ({
		adminPage,
	}) => {
		await gotoAdminPage(adminPage, "/admin-kppn/organizations");
		await expectAdminPageHealthy(adminPage);
		const main = adminPage.locator("main");
		await expect(main).toContainText("Daftar Satker Mitra KPPN");
		await expect(main).not.toContainText(peerMarker);

		const search = adminPage.getByRole("textbox", { name: "Cari satker" });
		await search.fill(ownActualCode);
		await expect(main).toContainText(ownActualCode);
		await expect(main).toContainText("Aktual");

		await search.fill(ownForecastCode);
		await expect(main).toContainText(ownForecastCode);
		await expect(main).toContainText("Proyeksi");

		await search.fill(ownEmptyCode);
		await expect(main).toContainText(ownEmptyCode);
		await expect(main).toContainText("Kosong");
		await expect(main).toContainText("Incomplete");
	});

	test("shows own organization detail read-only and rejects a peer detail", async ({
		adminPage,
	}) => {
		const ownResponse = await gotoAdminPage(
			adminPage,
			`/admin-kppn/organizations/${ownActualOrgId}`,
		);
		expect(ownResponse?.status()).toBe(200);
		await expectAdminPageHealthy(adminPage);
		const ownMain = adminPage.locator("main");
		await expect(ownMain).toContainText(ownActualCode);
		await expect(ownMain).toContainText("Read-only Mode");
		await expect(ownMain).toContainText("Rincian 8 Indikator IKPA");
		await expect(ownMain.locator("button")).toHaveCount(0);

		const peerResponse = await adminPage.goto(
			`/admin-kppn/organizations/${peerOrgId}`,
			{ waitUntil: "domcontentloaded" },
		);
		await adminPage
			.waitForLoadState("networkidle", { timeout: 15_000 })
			.catch(() => undefined);
		const peerBody = await adminPage.locator("body").textContent();
		const peerDenied =
			(peerResponse?.status() ?? 0) >= 400 ||
			/di luar|tidak ditemukan|forbidden|unauthorized|error/i.test(peerBody ?? "");
		expect(peerDenied).toBe(true);
		expect(peerBody ?? "").not.toContain(peerOrgId);
		expect(peerBody ?? "").not.toContain(peerMarker);
	});

	test("monitors a failed delivery, retries it, and keeps the action auditable", async ({
		adminPage,
	}, testInfo) => {
		const deliveryKey = testInfo.project.name === "mobile-chrome" ? "MOBILE" : "CHROMIUM";
		const expectedError = process.env[`F13_05_DELIVERY_ERROR_${deliveryKey}`] ?? "";
		const expectedRecipient = process.env[`F13_05_DELIVERY_RECIPIENT_${deliveryKey}`] ?? "";
		await gotoAdminPage(adminPage, "/admin-kppn/monitoring/reminders");
		await expectAdminPageHealthy(adminPage);
		const main = adminPage.locator("main");
		await expect(main).toContainText("Monitoring Risiko & Reminder");
		const row = adminPage
			.getByRole("row")
			.filter({ hasText: ownActualCode })
			.filter({ hasText: expectedRecipient })
			.first();
		await expect(row).toContainText("Gagal");
		await row.getByRole("button", { name: "Detail", exact: true }).click({ force: true });
		await expect(main).toContainText("Pesan Kesalahan Teknis");
		await expect(main).toContainText(expectedError);
		await expect(main).toContainText(expectedRecipient);
		await main
			.getByRole("button", { name: "Coba Kirim Ulang", exact: true })
			.click({ force: true });
		await expect(main).toContainText("Kirim Ulang Notifikasi Reminder?");
		await main
			.getByRole("button", { name: "Ya, Kirim Ulang", exact: true })
			.click({ force: true });
		await expect(main).toContainText("berhasil diantrekan", { timeout: 30_000 });
		await expect(main).toContainText("Terjadwal");
	});

	test("shows admin access protection and keeps policy editor fail-safe", async ({
		adminPage,
	}) => {
		await gotoAdminPage(adminPage, "/admin-kppn/access");
		await expectAdminPageHealthy(adminPage);
		const accessMain = adminPage.locator("main");
		await expect(accessMain).toContainText("Manajemen Akses Pengguna");
		await expect(accessMain).toContainText("minimal 1 Admin KPPN aktif");
		await expect(accessMain).toContainText("Anda");
		const selfDelete = adminPage.locator(
			'button[title="Tidak dapat menghapus akun sendiri"]',
		);
		await expect(selfDelete).toBeVisible();
		await expect(selfDelete).toBeDisabled();

		await gotoAdminPage(adminPage, "/admin-kppn/policy/rule-sets");
		await expectAdminPageHealthy(adminPage);
		const policyMain = adminPage.locator("main");
		const policyText = await policyMain.textContent();
		expect(
			/Rule Set IKPA Berversi|Rule set produksi belum tersedia dari sumber terautentikasi/i.test(
				policyText ?? "",
			),
		).toBe(true);
		if ((policyText ?? "").includes("Rule set produksi belum tersedia")) {
			await expect(policyMain.locator("button")).toHaveCount(0);
		} else {
			await expect(policyMain).toContainText("Rule Set Aktif Nasional");
		}

		await gotoAdminPage(adminPage, "/admin-kppn/policy/reminders");
		await expectAdminPageHealthy(adminPage);
		await expect(adminPage.locator("main")).toContainText(
			"Kebijakan Reminder & Pemutakhiran Target",
		);
		await expect(adminPage.locator("main")).toContainText(/Mandatory|Wajib/i);
	});
});
