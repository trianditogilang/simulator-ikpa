function parseISO(value: string | null | undefined): Date | null {
	if (!value || typeof value !== "string") return null;
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
	if (!m) return null;
	const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
	return Number.isNaN(dt.getTime()) ? null : dt;
}

function toISO(dt: Date): string {
	return dt.toISOString().slice(0, 10);
}

/**
 * Hitung hari kerja Senin–Jumat, start-exclusive end-inclusive.
 * Estimasi tanpa tabel libur nasional (engine memakai kalender libur penuh).
 */
export function countWorkdaysMonFri(startISO: string, endISO: string): number | null {
	const start = parseISO(startISO);
	const end = parseISO(endISO);
	if (!start || !end || end < start) return null;
	let count = 0;
	const cur = new Date(start.getTime() + 86400000);
	while (cur <= end) {
		const dow = cur.getUTCDay();
		if (dow !== 0 && dow !== 6) count++;
		cur.setUTCDate(cur.getUTCDate() + 1);
	}
	return count;
}

/** Tambah N hari kerja Senin–Jumat dari tanggal awal. */
export function addWorkdaysMonFri(startISO: string, n: number): string | null {
	const start = parseISO(startISO);
	if (!start || n < 0) return null;
	const cur = new Date(start.getTime());
	let added = 0;
	while (added < n) {
		cur.setUTCDate(cur.getUTCDate() + 1);
		const dow = cur.getUTCDay();
		if (dow !== 0 && dow !== 6) added++;
	}
	return toISO(cur);
}

export type DeadlineStatus = "Tepat Waktu" | "Terlambat" | "Menunggu";

export interface SpmReminder {
	id: string;
	referenceNumber: string;
	bastDate: string;
	receivedDate: string | null;
	elapsedWorkdays: number | null;
	status: DeadlineStatus;
	isPegawai: boolean;
}

/** Strip H+17 per berkas SPM-LS (non-pegawai dinilai, pegawai info). */
export function buildSpmReminders(
	list: Array<{
		id: string;
		referenceNumber: string;
		bastBappDate: string;
		receivedAtKppn: string | null;
		isPegawai: boolean;
	}>,
): SpmReminder[] {
	return list.map((s) => {
		const bast = parseISO(s.bastBappDate) ? s.bastBappDate.slice(0, 10) : "";
		const received = parseISO(s.receivedAtKppn)
			? (s.receivedAtKppn as string).slice(0, 10)
			: null;
		const elapsed =
			bast && received ? countWorkdaysMonFri(bast, received) : null;
		const status: DeadlineStatus =
			elapsed === null ? "Menunggu" : elapsed <= 17 ? "Tepat Waktu" : "Terlambat";
		return {
			id: s.id,
			referenceNumber: s.referenceNumber,
			bastDate: bast,
			receivedDate: received,
			elapsedWorkdays: elapsed,
			status,
			isPegawai: s.isPegawai,
		};
	});
}

export function tagihanAdvice(reminders: SpmReminder[]): string {
	const scored = reminders.filter((r) => !r.isPegawai);
	if (scored.length === 0)
		return "Belum ada SPM-LS non-pegawai. Setiap tagihan wajib sampai ke KPPN maksimal H+17 hari kerja setelah BAST/BAPP.";
	const late = scored.filter((r) => r.status === "Terlambat");
	if (late.length === 0)
		return `Semua ${scored.length} berkas tepat waktu (≤ H+17). Pertahankan pengajuan segera setelah BAST terbit.`;
	return `${late.length} dari ${scored.length} berkas melewati H+17 — ajukan SPM selambat 17 hari kerja setelah BAST; prioritaskan berkas ${late
		.slice(0, 3)
		.map((r) => r.referenceNumber)
		.join(", ")}.`;
}

/** Tenggat lapor capaian output = 5 hari kerja setelah akhir bulan. */
export function outputDeadline(year: number, month: number): string | null {
	if (month < 1 || month > 12) return null;
	const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
	const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
	return addWorkdaysMonFri(monthEnd, 5);
}

export interface OutputReminderSummary {
	deadline: string | null;
	tepat: number;
	terlambat: number;
	belum: number;
	advice: string;
}

export function buildOutputSummary(
	reports: Array<{
		roCode: string;
		reportedAt?: Date | string | null;
		confirmed: boolean;
	}>,
	year: number,
	month: number,
	todayISO?: string,
): OutputReminderSummary {
	const deadline = outputDeadline(year, month);
	const today = todayISO ?? new Date().toISOString().slice(0, 10);
	let tepat = 0;
	let terlambat = 0;
	let belum = 0;
	for (const r of reports) {
		const reported = parseISO(
			r.reportedAt instanceof Date
				? r.reportedAt.toISOString()
				: (r.reportedAt ?? undefined),
		);
		if (!reported || !r.confirmed) {
			belum++;
			continue;
		}
		const repISO = toISO(reported);
		if (deadline && repISO <= deadline) tepat++;
		else terlambat++;
	}
	const total = reports.length;
	let advice: string;
	if (total === 0) {
		advice = `Belum ada RO bulan ini. Lapor dan konfirmasi sebelum ${deadline ?? "batas 5 hari kerja"} (5 hari kerja setelah akhir bulan).`;
	} else if (belum === 0 && terlambat === 0) {
		advice = `Semua ${total} RO tepat waktu. Pertahankan konfirmasi sebelum ${deadline}.`;
	} else {
		const parts: string[] = [];
		if (belum > 0) parts.push(`${belum} RO belum dikonfirmasi`);
		if (terlambat > 0) parts.push(`${terlambat} RO terlambat`);
		advice = `${parts.join(", ")} dari ${total} RO — konfirmasi sebelum ${deadline ?? "batas"}.`;
		if (deadline && today > deadline && belum > 0)
			advice += " Tenggat sudah lewat, segera konfirmasi.";
	}
	return { deadline, tepat, terlambat, belum, advice };
}
