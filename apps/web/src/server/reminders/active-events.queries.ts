import type { DbClient } from "@simulator-ikpa/db";
import {
	contracts,
	spmLs,
	workdays,
} from "@simulator-ikpa/db/schema";
import {
	addWorkdays,
	countWorkdays,
	type WorkdayCalendar,
} from "@simulator-ikpa/policy-reminder";
import { and, eq, isNull, sql } from "drizzle-orm";
import { failIfProduction } from "../runtime-guards";

export interface ActiveReminderEvent {
	id: string;
	indicatorKey: string;
	indicatorLabel: string;
	eventType: string;
	eventTitle: string;
	entityType: string;
	entityNumber: string;
	entityDetail?: string;
	baseDateLabel: string;
	baseDate: string;
	deadlineDate: string;
	daysRemaining: number;
	dayType: "workday" | "calendar_day" | "schedule";
	status: "safe" | "warning" | "urgent" | "overdue" | "completed";
	statusLabel: string;
	nextMilestone: string;
	nextScheduledTime: string;
	recipients: string[];
	actionUrl: string;
	notes?: string;
}

export interface ReminderRecipientItem {
	id: string;
	name: string;
	email: string;
	role: string;
	isSystemUser: boolean;
	isVerified: boolean;
	allocatedPolicies: string[];
	status: "active" | "custom";
}

export interface ReminderDeliveryLogItem {
	id: string;
	indicatorLabel: string;
	eventType: string;
	eventTitle: string;
	entityNumber: string;
	recipientName: string;
	recipientEmail: string;
	channel: "email" | "in_app";
	scheduledFor: string;
	sentAt?: string | null;
	status:
		| "pending_provider"
		| "scheduled"
		| "queued"
		| "sent"
		| "failed"
		| "skipped"
		| "missed"
		| "cancelled";
	statusLabel: string;
	attemptCount: number;
	idempotencyKey: string;
	errorMessage?: string | null;
	payloadJson?: Record<string, string | number | boolean | null>;
}

const DEFAULT_CALENDAR: WorkdayCalendar = {
	holidays: [
		"2026-01-01",
		"2026-01-16",
		"2026-02-17",
		"2026-03-20",
		"2026-03-21",
		"2026-04-03",
		"2026-04-05",
		"2026-05-01",
		"2026-05-14",
		"2026-05-27",
		"2026-05-31",
		"2026-06-01",
		"2026-06-16",
		"2026-08-17",
		"2026-08-25",
		"2026-12-25",
	],
	workdays: [],
};

const OFFICIAL_2026_OUTPUT_DEADLINES: Record<number, string> = {
	1: "2026-04-30",
	2: "2026-04-30",
	3: "2026-04-30",
	4: "2026-05-12",
	5: "2026-06-10",
	6: "2026-07-09",
	7: "2026-08-11",
	8: "2026-09-09",
	9: "2026-10-09",
	10: "2026-11-10",
	11: "2026-12-09",
	12: "2027-01-13",
};

export async function getWorkdayCalendar(
	db: DbClient,
	year = 2026,
): Promise<WorkdayCalendar> {
	try {
		const rows = await db
			.select()
			.from(workdays)
			.where(eq(workdays.year, year));
		const holidays = rows.filter((r) => r.isHoliday).map((r) => r.date);
		const customWorkdays = rows.filter((r) => !r.isHoliday).map((r) => r.date);
		return {
			holidays: holidays.length > 0 ? holidays : DEFAULT_CALENDAR.holidays,
			workdays: customWorkdays,
		};
	} catch {
		return DEFAULT_CALENDAR;
	}
}

/**
 * Mengambil seluruh event pengingat aktif dari database untuk Satker tertentu
 * Mengikuti spesifikasi context guard:
 * 1. Belanja Kontraktual dan Penyelesaian Tagihan dipisah secara tegas.
 * 2. Penyelesaian Tagihan: BAST/BAPP pada SPM-LS kontraktual non-pegawai, H+17 hari kerja kanonis, selesai saat receivedAtKppn terisi.
 * 3. Belanja Kontraktual: 3 sub-event (Kontrak Dini TW I, Distribusi TW II, Akselerasi 53 TW I).
 * 4. Capaian Output: Open Period Reguler HK-7 M+1 dan Target Windows 10 HK.
 * 5. UP/TUP: Revolving GUP 30 Hari Kalender.
 * 6. Dispensasi SPM: Pengajuan SPM TW IV.
 */
export async function getActiveReminderEvents(
	db: DbClient | null,
	_orgId: string,
	fiscalYearId?: string,
	currentDateIso = "2026-09-08",
): Promise<ActiveReminderEvent[]> {
	const events: ActiveReminderEvent[] = [];
	const today = currentDateIso;

	if (!db) {
		failIfProduction(true, "Production database is not configured for active reminders.");
		return getMockActiveReminderEvents(today);
	}

	const calendar = await getWorkdayCalendar(db, 2026);

	try {
		// 1. Tagihan SPM-LS (Penyelesaian Tagihan - 10%)
		const spmRows = await db
			.select({
				id: spmLs.id,
				referenceNumber: spmLs.referenceNumber,
				bastBappDate: spmLs.bastBappDate,
				receivedAtKppn: spmLs.receivedAtKppn,
				isPegawai: spmLs.isPegawai,
				contractId: spmLs.contractId,
				contractNumber: contracts.contractNumber,
				accountCode: contracts.accountCode,
				contractValue: contracts.value,
			})
			.from(spmLs)
			.leftJoin(contracts, eq(spmLs.contractId, contracts.id))
			.where(
				and(
					fiscalYearId ? eq(spmLs.fiscalYearId, fiscalYearId) : sql`1=1`,
					isNull(spmLs.deletedAt),
				),
			);

		for (const spm of spmRows) {
			if (spm.isPegawai) continue; // Pengecualian belanja pegawai sesuai PER-5/PB/2024

			const bast = spm.bastBappDate;
			const deadline = addWorkdays(bast, 17, calendar);
			const isConverted = Boolean(spm.receivedAtKppn);

			if (isConverted && spm.receivedAtKppn) {
				const elapsed = countWorkdays(bast, spm.receivedAtKppn, calendar);
				const onTime = elapsed <= 17;
				events.push({
					id: `spm-done-${spm.id}`,
					indicatorKey: "invoice_timeliness",
					indicatorLabel: "Penyelesaian Tagihan",
					eventType: "spm_ls_contract_17d",
					eventTitle: "Penyelesaian Tagihan SPM-LS Kontraktual (17 Hari Kerja)",
					entityType: "spm_ls",
					entityNumber: spm.referenceNumber,
					entityDetail: `Kontrak ${spm.contractNumber ?? "-"} • Nilai Rp ${Number(spm.contractValue ?? 0).toLocaleString("id-ID")}`,
					baseDateLabel: "Tanggal BAST/BAPP",
					baseDate: bast,
					deadlineDate: deadline,
					daysRemaining: 0,
					dayType: "workday",
					status: "completed",
					statusLabel: onTime
						? `Selesai Tepat Waktu (H+${elapsed} HK)`
						: `Selesai Terlambat (H+${elapsed} HK)`,
					nextMilestone: "-",
					nextScheduledTime: "Konversi KPPN Tercatat",
					recipients: ["Operator Satker", "PPK Satker"],
					actionUrl: "/operator/data/contracts-invoices?tab=invoices",
					notes: `Konversi KPPN tercatat pada ${spm.receivedAtKppn}. Reminder ditutup secara otomatis.`,
				});
			} else {
				// Belum konversi KPPN - hitung remaining workdays
				let workdaysLeft = 0;
				let status: ActiveReminderEvent["status"] = "safe";
				let statusLabel = "";

				if (today > deadline) {
					const lateDays = countWorkdays(deadline, today, calendar);
					workdaysLeft = -lateDays;
					status = "overdue";
					statusLabel = `Terlambat (${lateDays} Hari Kerja Lewat H+17)`;
				} else {
					workdaysLeft = countWorkdays(today, deadline, calendar);
					if (workdaysLeft === 0) {
						status = "urgent";
						statusLabel = "H-0 Batas Hari Ini";
					} else if (workdaysLeft <= 2) {
						status = "urgent";
						statusLabel = `H-${workdaysLeft} Hari Kerja (Mendesak)`;
					} else if (workdaysLeft <= 5) {
						status = "warning";
						statusLabel = `H-${workdaysLeft} Hari Kerja (Perhatian)`;
					} else {
						status = "safe";
						statusLabel = `Aman (H-${workdaysLeft} Hari Kerja)`;
					}
				}

				const nextMilestone =
					workdaysLeft > 5
						? "H-5 Hari Kerja"
						: workdaysLeft > 2
							? "H-2 Hari Kerja"
							: workdaysLeft > 0
								? "H-0 Hari Kerja"
								: "Eskalasi Terlambat";

				events.push({
					id: `spm-active-${spm.id}`,
					indicatorKey: "invoice_timeliness",
					indicatorLabel: "Penyelesaian Tagihan",
					eventType: "spm_ls_contract_17d",
					eventTitle: "Penyelesaian Tagihan SPM-LS Kontraktual (17 Hari Kerja)",
					entityType: "spm_ls",
					entityNumber: spm.referenceNumber,
					entityDetail: `Kontrak ${spm.contractNumber ?? "-"} • Akun ${spm.accountCode ?? "-"} • Rp ${Number(spm.contractValue ?? 0).toLocaleString("id-ID")}`,
					baseDateLabel: "Tanggal BAST/BAPP",
					baseDate: bast,
					deadlineDate: deadline,
					daysRemaining: workdaysLeft,
					dayType: "workday",
					status,
					statusLabel,
					nextMilestone,
					nextScheduledTime: `${deadline} 08:00 WIB`,
					recipients: ["Operator Satker", "PPK Satker"],
					actionUrl: "/operator/data/contracts-invoices?tab=invoices",
					notes:
						"Ajukan SPM-LS dan pantau penerbitan SP2D sebelum batas 17 hari kerja sejak BAST/BAPP.",
				});
			}
		}

		// 2. Belanja Kontraktual (10% - 3 Event Terpisah)
		const contractRows = await db
			.select()
			.from(contracts)
			.where(
				and(
					fiscalYearId ? eq(contracts.fiscalYearId, fiscalYearId) : sql`1=1`,
					isNull(contracts.deletedAt),
				),
			);

		for (const c of contractRows) {
			const numVal = Number(c.value);
			const isEligible50Jt = numVal >= 50000000;
			const isAccount53 = c.accountCode.startsWith("53");
			const is53Eligible =
				isAccount53 &&
				numVal >= 50000000 &&
				numVal <= 200000000 &&
				c.paymentType === "sekaligus";

			// 2A. Kontrak Dini / Pra-DIPA (Target 31 Maret)
			if (isEligible50Jt) {
				const signedDate = c.signedAt;
				let status: ActiveReminderEvent["status"] = "completed";
				let statusLabel = "TTD Selesai";

				if (signedDate < "2026-01-01") {
					status = "completed";
					statusLabel = "Pra-DIPA (120 Poin KD)";
				} else if (signedDate <= "2026-03-31") {
					status = "completed";
					statusLabel = "Kontrak TW I (110 Poin KD)";
				} else if (signedDate > "2026-03-31") {
					status = "warning";
					statusLabel = "Lewat TW I (Tanpa Poin KD)";
				}

				events.push({
					id: `ctr-kd-${c.id}`,
					indicatorKey: "contractual",
					indicatorLabel: "Belanja Kontraktual",
					eventType: "early_contract_due",
					eventTitle: "Penyelesaian Kontrak Dini / Pra-DIPA (TW I)",
					entityType: "contract",
					entityNumber: c.contractNumber,
					entityDetail: `Akun ${c.accountCode} • Nilai Rp ${numVal.toLocaleString("id-ID")} • Tipe: ${c.paymentType}`,
					baseDateLabel: "Tanggal Kontrak",
					baseDate: signedDate,
					deadlineDate: "2026-03-31",
					daysRemaining: 0,
					dayType: "calendar_day",
					status,
					statusLabel,
					nextMilestone: "-",
					nextScheduledTime: "Evaluasi Triwulan I Selesai",
					recipients: ["Operator Satker", "PPK Satker"],
					actionUrl: "/operator/data/contracts-invoices?tab=contracts",
					notes:
						"Target pendaftaran dan penandatanganan kontrak sebelum akhir Triwulan I (31 Maret).",
				});
			}

			// 2B. Akselerasi Kontrak 53 TW I (Target SP2D TW I s.d. 31 Maret)
			if (is53Eligible) {
				const hasSp2d = Boolean(c.sp2dAt);
				let status: ActiveReminderEvent["status"] = "urgent";
				let statusLabel = "Belum Terbit SP2D";

				if (c.sp2dAt) {
					if (c.sp2dAt <= "2026-03-31") {
						status = "completed";
						statusLabel = "SP2D TW I (100 Poin)";
					} else if (c.sp2dAt <= "2026-06-30") {
						status = "completed";
						statusLabel = "SP2D TW II (90 Poin)";
					} else if (c.sp2dAt <= "2026-09-30") {
						status = "completed";
						statusLabel = "SP2D TW III (80 Poin)";
					} else {
						status = "warning";
						statusLabel = "SP2D TW IV (70 Poin)";
					}
				}

				events.push({
					id: `ctr-53-${c.id}`,
					indicatorKey: "contractual",
					indicatorLabel: "Belanja Kontraktual",
					eventType: "capital_53_contract_due",
					eventTitle: "Akselerasi Kontrak Belanja Modal 53 Rp50–200 Juta (TW I)",
					entityType: "contract",
					entityNumber: c.contractNumber,
					entityDetail: `Akun 53 Sekaligus • Nilai Rp ${numVal.toLocaleString("id-ID")} • SP2D: ${c.sp2dAt ?? "Menunggu"}`,
					baseDateLabel: c.sp2dAt ? "Tanggal SP2D" : "Tanggal Kontrak",
					baseDate: c.sp2dAt ?? c.signedAt,
					deadlineDate: "2026-03-31",
					daysRemaining: 0,
					dayType: "calendar_day",
					status,
					statusLabel,
					nextMilestone: hasSp2d ? "-" : "H-14 Kalender",
					nextScheduledTime: hasSp2d
						? "SP2D Terbit"
						: "Jadwal Evaluasi Triwulanan",
					recipients: ["Operator Satker", "PPK Satker"],
					actionUrl: "/operator/data/contracts-invoices?tab=contracts",
					notes:
						"Khusus kontrak akun 53 nilai Rp50–200 juta sekaligus dinilai dari tanggal SP2D TW I untuk meraih nilai 100.",
				});
			}
		}

		// 3. Capaian Output (25% - Open Period 7 HK & Target 10 HK)
		const currentMonth = 8; // Agustus 2026
		const openPeriodDeadlineAug = OFFICIAL_2026_OUTPUT_DEADLINES[currentMonth]; // 2026-09-09
		const workdaysToAugDeadline = countWorkdays(
			today,
			openPeriodDeadlineAug,
			calendar,
		);

		events.push({
			id: "evt-co-realization-aug",
			indicatorKey: "output_achievement",
			indicatorLabel: "Capaian Output",
			eventType: "output_report_monthly",
			eventTitle:
				"Pelaporan & Konfirmasi Capaian Output (Open Period Reguler 7 HK)",
			entityType: "output_report",
			entityNumber: "Realisasi Kinerja Bulan Agustus 2026",
			entityDetail:
				"Batas Open Period Reguler Nasional: 09 September 2026 (7 Hari Kerja Awal M+1)",
			baseDateLabel: "Akhir Bulan Pelaporan",
			baseDate: "2026-08-31",
			deadlineDate: openPeriodDeadlineAug,
			daysRemaining: workdaysToAugDeadline,
			dayType: "workday",
			status:
				workdaysToAugDeadline <= 0
					? "urgent"
					: workdaysToAugDeadline <= 2
						? "urgent"
						: "warning",
			statusLabel:
				workdaysToAugDeadline <= 0
					? "H-0 Batas Hari Ini"
					: `H-${workdaysToAugDeadline} Hari Kerja`,
			nextMilestone: "H-0 Hari Kerja",
			nextScheduledTime: `${openPeriodDeadlineAug} 08:00 WIB`,
			recipients: ["Operator Satker", "PPK Satker"],
			actionUrl: "/operator/data/output-achievement",
			notes:
				"Laporkan progres PCRO dan RVRO serta pastikan konfirmasi PPK telah dilakukan sebelum open period ditutup.",
		});

		events.push({
			id: "evt-co-target-q4",
			indicatorKey: "output_achievement",
			indicatorLabel: "Capaian Output",
			eventType: "output_target_update_due",
			eventTitle:
				"Pemutakhiran Proyeksi Target Triwulanan (10 Hari Kerja Awal TW)",
			entityType: "target_window",
			entityNumber: "Target Kinerja Triwulan IV TA 2026",
			entityDetail:
				"Jendela Terjadwal: 01 Oktober 2026 s.d. 14 Oktober 2026 (10 HK Awal Triwulan)",
			baseDateLabel: "Awal Triwulan IV",
			baseDate: "2026-10-01",
			deadlineDate: "2026-10-14",
			daysRemaining: 26,
			dayType: "workday",
			status: "safe",
			statusLabel: "Terjadwal (Buka 01 Okt 2026)",
			nextMilestone: "H-10 Hari Kerja",
			nextScheduledTime: "2026-10-01 08:00 WIB",
			recipients: ["Operator Satker", "PPK Satker"],
			actionUrl: "/operator/data/output-achievement",
			notes:
				"Pemutakhiran target triwulanan dapat disesuaikan fleksibel jika terdapat perubahan DIPA resmi.",
		});

		// 4. Pengelolaan UP/TUP (10% - Revolving GUP 30 Hari Kalender)
		events.push({
			id: "evt-up-tup-revolving",
			indicatorKey: "up_tup",
			indicatorLabel: "Pengelolaan UP & TUP",
			eventType: "up_tup_revolving_monthly",
			eventTitle: "Batas Revolving GUP Bulanan (30 Hari Kalender)",
			entityType: "up_tup",
			entityNumber: "Rekening UP Tunai Satker",
			entityDetail:
				"SP2D GUP Terakhir: 15 Agustus 2026 • Batas 30 Hari: 14 September 2026",
			baseDateLabel: "Tanggal SP2D Terakhir",
			baseDate: "2026-08-15",
			deadlineDate: "2026-09-14",
			daysRemaining: 6,
			dayType: "calendar_day",
			status: "warning",
			statusLabel: "H-6 Hari Kalender",
			nextMilestone: "H-3 Hari Kalender",
			nextScheduledTime: "2026-09-11 08:00 WIB",
			recipients: ["Operator Satker", "Bendahara Pengeluaran"],
			actionUrl: "/operator/up-tup",
			notes:
				"Lakukan revolving GUP minimal 1 kali dalam rentang 30 hari kalender dengan nominal optimal >= 50% UP.",
		});

		// 5. Dispensasi SPM (Pengurang Nilai - Langkah Akhir Tahun TW IV)
		events.push({
			id: "evt-spm-disp-q4",
			indicatorKey: "spm_dispensation",
			indicatorLabel: "Dispensasi SPM",
			eventType: "spm_dispensation_q4",
			eventTitle: "Batas Pengajuan SPM Dispensasi Akhir Tahun (TW IV)",
			entityType: "spm_q4",
			entityNumber: "Pengajuan SPM Triwulan IV TA 2026",
			entityDetail:
				"Langkah-Langkah Akhir Tahun (LLAT) 2026 • Batas: 31 Desember 2026",
			baseDateLabel: "Awal Triwulan IV",
			baseDate: "2026-10-01",
			deadlineDate: "2026-12-31",
			daysRemaining: 114,
			dayType: "calendar_day",
			status: "safe",
			statusLabel: "Aman (Target Rasio < 5.00‰)",
			nextMilestone: "H-21 Hari Kalender",
			nextScheduledTime: "2026-12-10 08:00 WIB",
			recipients: ["Operator Satker", "PPK Satker"],
			actionUrl: "/operator/data/spm-dispensation",
			notes:
				"Kendalikan jumlah SPM Dispensasi agar tidak melebihi rasio permil pengurang nilai IKPA.",
		});

		// 6. Revisi DIPA (Batas Akhir Triwulan III)
		events.push({
			id: "evt-dipa-rev-q3",
			indicatorKey: "dipa_revision",
			indicatorLabel: "Revisi DIPA",
			eventType: "dipa_revision_quarterly",
			eventTitle: "Batas Akhir Revisi DIPA Triwulanan (TW III)",
			entityType: "dipa",
			entityNumber: "DIPA Petikan Satker TA 2026",
			entityDetail:
				"Batas Pengajuan Revisi Triwulan III: 30 September 2026 (1 Hari Kerja sebelum TW Berakhir)",
			baseDateLabel: "Awal Triwulan III",
			baseDate: "2026-07-01",
			deadlineDate: "2026-09-30",
			daysRemaining: 22,
			dayType: "calendar_day",
			status: "warning",
			statusLabel: "H-22 Hari Kalender (Akhir TW III)",
			nextMilestone: "H-14 Hari Kalender",
			nextScheduledTime: "2026-09-16 08:00 WIB",
			recipients: ["Operator Satker", "PPK Satker"],
			actionUrl: "/operator/dipa-revision",
			notes:
				"Pastikan revisi anggaran telah diajukan sebelum batas akhir triwulan untuk menjaga akurasi RPD.",
		});
	} catch (err) {
		console.error("Error fetching active reminder events from DB:", err);
		failIfProduction(true, `Active reminder query failed: ${(err as Error).message}`);
		return getMockActiveReminderEvents(today);
	}

	return events;
}

export function getMockActiveReminderEvents(
	_today = "2026-09-08",
): ActiveReminderEvent[] {
	return [
		{
			id: "spm-active-mock-1",
			indicatorKey: "invoice_timeliness",
			indicatorLabel: "Penyelesaian Tagihan",
			eventType: "spm_ls_contract_17d",
			eventTitle:
				"Penyelesaian Tagihan SPM-LS Kontraktual (17 Hari Kerja BAST)",
			entityType: "spm_ls",
			entityNumber: "SPM-LS/411782/002",
			entityDetail:
				"Kontrak KTR-2026/411782/02 • Belanja Jasa Konsultansi • Rp 450.000.000",
			baseDateLabel: "Tanggal BAST/BAPP",
			baseDate: "2026-08-12",
			deadlineDate: "2026-09-04",
			daysRemaining: -2,
			dayType: "workday",
			status: "overdue",
			statusLabel: "Terlambat (2 Hari Kerja Lewat H+17)",
			nextMilestone: "Eskalasi Terlambat",
			nextScheduledTime: "Segera Konversi KPPN",
			recipients: ["Operator Satker", "PPK Satker"],
			actionUrl: "/operator/data/contracts-invoices?tab=invoices",
			notes:
				"BAST tanggal 12-08-2026. Batas 17 hari kerja jatuh pada 04-09-2026. Segera koordinasikan konversi dengan KPPN.",
		},
		{
			id: "spm-active-mock-2",
			indicatorKey: "invoice_timeliness",
			indicatorLabel: "Penyelesaian Tagihan",
			eventType: "spm_ls_contract_17d",
			eventTitle:
				"Penyelesaian Tagihan SPM-LS Kontraktual (17 Hari Kerja BAST)",
			entityType: "spm_ls",
			entityNumber: "SPM-LS/411782/003",
			entityDetail:
				"Kontrak KTR-2026/411782/03 • Belanja Modal Peralatan • Rp 75.000.000",
			baseDateLabel: "Tanggal BAST/BAPP",
			baseDate: "2026-08-28",
			deadlineDate: "2026-09-22",
			daysRemaining: 10,
			dayType: "workday",
			status: "safe",
			statusLabel: "Aman (H-10 Hari Kerja)",
			nextMilestone: "H-5 Hari Kerja",
			nextScheduledTime: "2026-09-15 08:00 WIB",
			recipients: ["Operator Satker", "PPK Satker"],
			actionUrl: "/operator/data/contracts-invoices?tab=invoices",
			notes:
				"BAST tanggal 28-08-2026. Batas 17 hari kerja jatuh pada 22-09-2026. Proses penerbitan SPM sedang berjalan.",
		},
		{
			id: "ctr-53-mock-1",
			indicatorKey: "contractual",
			indicatorLabel: "Belanja Kontraktual",
			eventType: "capital_53_contract_due",
			eventTitle: "Akselerasi Kontrak Belanja Modal 53 Rp50–200 Juta (TW I)",
			entityType: "contract",
			entityNumber: "KTR-2026/411782/01",
			entityDetail:
				"Akun 532111 Sekaligus • Gedung Kantor • Rp 185.000.000 • SP2D: 25-03-2026",
			baseDateLabel: "Tanggal SP2D",
			baseDate: "2026-03-25",
			deadlineDate: "2026-03-31",
			daysRemaining: 0,
			dayType: "calendar_day",
			status: "completed",
			statusLabel: "SP2D TW I (100 Poin)",
			nextMilestone: "-",
			nextScheduledTime: "SP2D Terbit",
			recipients: ["Operator Satker", "PPK Satker"],
			actionUrl: "/operator/data/contracts-invoices?tab=contracts",
			notes:
				"SP2D terbit pada 25-03-2026 (Triwulan I) sehingga memperoleh nilai maksimal 100 pada komponen akselerasi 53.",
		},
		{
			id: "evt-co-realization-mock",
			indicatorKey: "output_achievement",
			indicatorLabel: "Capaian Output",
			eventType: "output_report_monthly",
			eventTitle:
				"Pelaporan & Konfirmasi Capaian Output (Open Period Reguler 7 HK)",
			entityType: "output_report",
			entityNumber: "Realisasi Kinerja Bulan Agustus 2026",
			entityDetail:
				"Open Period Reguler Nasional: 09 September 2026 (HK-7 September)",
			baseDateLabel: "Akhir Bulan Pelaporan",
			baseDate: "2026-08-31",
			deadlineDate: "2026-09-09",
			daysRemaining: 1,
			dayType: "workday",
			status: "urgent",
			statusLabel: "H-1 Hari Kerja (Besok Ditutup)",
			nextMilestone: "H-0 Hari Kerja",
			nextScheduledTime: "2026-09-09 08:00 WIB",
			recipients: ["Operator Satker", "PPK Satker"],
			actionUrl: "/operator/data/output-achievement",
			notes:
				"Pastikan seluruh RO telah dilaporkan progres PCRO dan RVRO serta disahkan oleh PPK.",
		},
		{
			id: "evt-co-target-mock",
			indicatorKey: "output_achievement",
			indicatorLabel: "Capaian Output",
			eventType: "output_target_update_due",
			eventTitle:
				"Pemutakhiran Proyeksi Target Triwulanan (10 Hari Kerja Awal TW)",
			entityType: "target_window",
			entityNumber: "Target Kinerja Triwulan IV TA 2026",
			entityDetail: "Jendela Regulasi: 01 Oktober 2026 s.d. 14 Oktober 2026",
			baseDateLabel: "Awal Triwulan IV",
			baseDate: "2026-10-01",
			deadlineDate: "2026-10-14",
			daysRemaining: 26,
			dayType: "workday",
			status: "safe",
			statusLabel: "Terjadwal (Buka 01 Okt 2026)",
			nextMilestone: "H-10 Hari Kerja",
			nextScheduledTime: "2026-10-01 08:00 WIB",
			recipients: ["Operator Satker", "PPK Satker"],
			actionUrl: "/operator/data/output-achievement",
			notes:
				"Jalur pemutakhiran fleksibel tersedia jika satker mengalami perubahan/revisi DIPA.",
		},
		{
			id: "evt-up-tup-mock",
			indicatorKey: "up_tup",
			indicatorLabel: "Pengelolaan UP & TUP",
			eventType: "up_tup_revolving_monthly",
			eventTitle: "Batas Revolving GUP Bulanan (30 Hari Kalender)",
			entityType: "up_tup",
			entityNumber: "Rekening UP Tunai Satker",
			entityDetail:
				"SP2D Terakhir: 15 Agustus 2026 • Batas 30 Hari: 14 September 2026",
			baseDateLabel: "Tanggal SP2D Terakhir",
			baseDate: "2026-08-15",
			deadlineDate: "2026-09-14",
			daysRemaining: 6,
			dayType: "calendar_day",
			status: "warning",
			statusLabel: "H-6 Hari Kalender",
			nextMilestone: "H-3 Hari Kalender",
			nextScheduledTime: "2026-09-11 08:00 WIB",
			recipients: ["Operator Satker", "Bendahara Pengeluaran"],
			actionUrl: "/operator/up-tup",
			notes:
				"Revolving GUP minimal 50% nominal UP untuk menjaga nilai optimal rasio GUP disebulankan.",
		},
		{
			id: "evt-dipa-mock",
			indicatorKey: "dipa_revision",
			indicatorLabel: "Revisi DIPA",
			eventType: "dipa_revision_quarterly",
			eventTitle: "Batas Akhir Revisi DIPA Triwulanan (TW III)",
			entityType: "dipa",
			entityNumber: "DIPA Petikan Satker TA 2026",
			entityDetail: "Batas Akhir Triwulan III: 30 September 2026",
			baseDateLabel: "Awal Triwulan III",
			baseDate: "2026-07-01",
			deadlineDate: "2026-09-30",
			daysRemaining: 22,
			dayType: "calendar_day",
			status: "warning",
			statusLabel: "H-22 Hari Kalender (Akhir TW III)",
			nextMilestone: "H-14 Hari Kalender",
			nextScheduledTime: "2026-09-16 08:00 WIB",
			recipients: ["Operator Satker", "PPK Satker"],
			actionUrl: "/operator/dipa-revision",
			notes: "Pengajuan revisi DIPA triwulan III dibuka sampai akhir September.",
		},
		{
			id: "evt-spm-disp-mock",
			indicatorKey: "spm_dispensation",
			indicatorLabel: "Dispensasi SPM",
			eventType: "spm_dispensation_q4",
			eventTitle: "Batas Pengajuan SPM Dispensasi Akhir Tahun (TW IV)",
			entityType: "spm_q4",
			entityNumber: "Pengajuan SPM Triwulan IV TA 2026",
			entityDetail:
				"Langkah-Langkah Akhir Tahun (LLAT) 2026 • Batas: 31 Desember 2026",
			baseDateLabel: "Awal Triwulan IV",
			baseDate: "2026-10-01",
			deadlineDate: "2026-12-31",
			daysRemaining: 114,
			dayType: "calendar_day",
			status: "safe",
			statusLabel: "Aman (Target < 5.00‰ SPM Q4)",
			nextMilestone: "H-21 Hari Kalender",
			nextScheduledTime: "2026-12-10 08:00 WIB",
			recipients: ["Operator Satker", "PPK Satker"],
			actionUrl: "/operator/data/spm-dispensation",
			notes:
				"Dispensasi SPM dihitung dari rasio permil SPM yang diajukan di luar batas waktu resmi.",
		},
	];
}
