import {
	calculateUpTup,
	default2026RuleSet,
	type KkpTransaction,
	type RuleSetConfig,
	type UpTupTransaction,
} from "@simulator-ikpa/ikpa-engine";
import type {
	KkpRecord,
	UpTupRecord,
} from "@/services/up-tup-kkp-service";
import {
	buildUpTupEngineInput,
	calcTanggalMaksimal,
	type UpTupAssumptions,
} from "./up-tup-assumptions";

function decimalString(value: number | undefined): string {
	const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
	return n.toFixed(2);
}

function parseAmount(value: string | undefined): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function isoDate(value: string | null | undefined): string | null {
	if (!value || typeof value !== "string") return null;
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
	return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Collapse tipe DB → UP/TUP persis server calculate.ts. */
export function collapseDbType(
	type: string,
): "UP" | "TUP" {
	return type === "UP" || type === "TUP" ? type : "UP";
}

export function mapActualToEngine(
	upTupList: UpTupRecord[],
	kkpList: KkpRecord[],
	year: number,
): { transactions: UpTupTransaction[]; kkpTransactions: KkpTransaction[] } {
	const transactions: UpTupTransaction[] = [];
	for (const u of upTupList) {
		const date = isoDate(u.sp2dAt);
		if (!date) continue;
		transactions.push({
			id: u.id,
			type: collapseDbType(u.type),
			amount: decimalString(parseAmount(u.amount)),
			date,
			settlementDate: isoDate(u.settlementDate),
			isSettled: u.isSettled,
		});
	}
	const kkpTransactions: KkpTransaction[] = [];
	for (const k of kkpList) {
		const date =
			isoDate(k.usageDate) ??
			`${year}-${String(Math.min(Math.max(k.month, 1), 12)).padStart(2, "0")}-15`;
		kkpTransactions.push({
			id: k.id,
			amount: decimalString(parseAmount(k.amount)),
			date,
		});
	}
	return { transactions, kkpTransactions };
}

export interface UpTupScore {
	score: number | null;
	contribution: number | null;
	tunai: number | null;
	kkp: number | null;
	status: string;
}

export function calcUpTupScore(
	transactions: UpTupTransaction[],
	kkpTransactions: KkpTransaction[],
	currentMonth: number,
	config: RuleSetConfig = default2026RuleSet,
): UpTupScore {
	if (transactions.length === 0 && kkpTransactions.length === 0) {
		return { score: null, contribution: null, tunai: null, kkp: null, status: "incomplete" };
	}
	const month = Number.isFinite(currentMonth)
		? Math.min(Math.max(Math.floor(currentMonth), 1), 12)
		: 12;
	const result = calculateUpTup(
		{ transactions, kkpTransactions } as never,
		{ kind: "month", value: month } as never,
		config,
	);
	const score = Number(result.score);
	const contribution = Number(result.weightedContribution);
	const tunai = Number(
		result.subComponents?.find((s) => s.key === "tunai")?.score,
	);
	const kkp = Number(
		result.subComponents?.find((s) => s.key === "kkp")?.score,
	);
	return {
		score: Number.isFinite(score) ? score : null,
		contribution: Number.isFinite(contribution) ? contribution : null,
		tunai: Number.isFinite(tunai) ? tunai : null,
		kkp: Number.isFinite(kkp) ? kkp : null,
		status: result.status,
	};
}

/** Gabung actual DB + asumsi rencana (asumsi tak menimpa actual). */
export function mergeWithAssumptions(
	actual: { transactions: UpTupTransaction[]; kkpTransactions: KkpTransaction[] },
	assumptions: UpTupAssumptions | null,
): { transactions: UpTupTransaction[]; kkpTransactions: KkpTransaction[] } {
	if (!assumptions) return actual;
	const built = buildUpTupEngineInput(assumptions);
	return {
		transactions: [
			...actual.transactions,
			...(built.transactions as unknown as UpTupTransaction[]),
		],
		kkpTransactions: [
			...actual.kkpTransactions,
			...(built.kkpTransactions as unknown as KkpTransaction[]),
		],
	};
}

export interface GupReminder {
	id: string;
	type: string;
	amount: number;
	sp2dAt: string;
	dueDate: string | null;
	settlementDate: string | null;
	status: "Tepat Waktu" | "Terlambat" | "Menunggu";
	detail: string;
}

function diffDays(fromISO: string, toISO: string): number | null {
	const a = new Date(`${fromISO}T00:00:00Z`).getTime();
	const b = new Date(`${toISO}T00:00:00Z`).getTime();
	if (Number.isNaN(a) || Number.isNaN(b)) return null;
	return Math.floor((b - a) / 86400000);
}

/** Reminder wajib GUP/PTUP dari tanggal actual. */
export function buildGupReminders(
	upTupList: UpTupRecord[],
	todayISO?: string,
): GupReminder[] {
	const today =
		todayISO ?? new Date().toISOString().slice(0, 10);
	const out: GupReminder[] = [];
	for (const u of upTupList) {
		if (u.type !== "GUP" && u.type !== "GUP_NIHIL" && u.type !== "PTUP") continue;
		const sp2d = isoDate(u.sp2dAt);
		if (!sp2d) continue;
		const dueDate = calcTanggalMaksimal(sp2d);
		const settled = isoDate(u.settlementDate);
		let status: GupReminder["status"] = "Menunggu";
		let detail: string;
		if (u.isSettled && settled && dueDate) {
			status = settled <= dueDate ? "Tepat Waktu" : "Terlambat";
			detail =
				status === "Tepat Waktu"
					? `Dipertanggungjawabkan ${settled} (maks. ${dueDate}).`
					: `Terlambat — dipertanggungjawabkan ${settled}, maks. ${dueDate}.`;
		} else if (dueDate) {
			const left = diffDays(today, dueDate);
			if (left === null) {
				detail = `Jatuh tempo ${dueDate}. Segera pertanggungjawabkan.`;
			} else if (left < 0) {
				status = "Terlambat";
				detail = `Lewat ${Math.abs(left)} hari dari maks. ${dueDate}. Segera pertanggungjawabkan.`;
			} else if (left === 0) {
				detail = `Jatuh tempo hari ini (${dueDate}).`;
			} else {
				detail = `Jatuh tempo ${dueDate} (H−${left}).`;
			}
		} else {
			detail = "Tanggal SP2D tak valid — periksa data.";
		}
		out.push({
			id: u.id,
			type: u.type,
			amount: parseAmount(u.amount),
			sp2dAt: sp2d,
			dueDate,
			settlementDate: settled,
			status,
			detail,
		});
	}
	return out;
}
