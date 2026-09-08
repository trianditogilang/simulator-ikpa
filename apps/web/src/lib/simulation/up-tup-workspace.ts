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

/** Map tipe DB → UpTupTransaction type. */
export function normalizeUpTupType(
	type: string,
): UpTupTransaction["type"] {
	if (
		type === "UP" ||
		type === "GUP" ||
		type === "GUP_NIHIL" ||
		type === "TUP" ||
		type === "PTUP" ||
		type === "SETORAN_TUP"
	) {
		return type;
	}
	return "UP";
}

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
	const sortedUpTup = [...upTupList].sort((a, b) =>
		(a.sp2dAt || "").localeCompare(b.sp2dAt || ""),
	);

	for (let i = 0; i < sortedUpTup.length; i++) {
		const u = sortedUpTup[i];
		const sp2d = isoDate(u.sp2dAt);
		if (!sp2d) continue;

		let refDate = isoDate(u.referenceSp2dAt);
		if (
			!refDate &&
			(u.type === "GUP" ||
				u.type === "GUP_NIHIL" ||
				u.type === "PTUP" ||
				u.type === "SETORAN_TUP")
		) {
			for (let j = i - 1; j >= 0; j--) {
				const prev = sortedUpTup[j];
				if (
					prev.type === "UP" ||
					prev.type === "GUP" ||
					prev.type === "GUP_NIHIL" ||
					prev.type === "TUP"
				) {
					refDate = isoDate(prev.sp2dAt);
					break;
				}
			}
		}

		const finalRefDate = refDate ?? sp2d;
		const finalSettlementDate = isoDate(u.settlementDate) ?? sp2d;

		transactions.push({
			id: u.id,
			type: normalizeUpTupType(u.type),
			amount: decimalString(parseAmount(u.amount)),
			date: finalRefDate,
			settlementDate: finalSettlementDate,
			isSettled: true,
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
	timeliness: number | null;
	monthlyGup: number | null;
	tupDeposit: number | null;
	status: string;
}

export function isThr2026FairnessApplied(referenceSp2dAt?: string | null): boolean {
	if (!referenceSp2dAt) return false;
	const date = referenceSp2dAt.slice(0, 10);
	return date >= "2026-02-18" && date <= "2026-03-17";
}

export function calcUpTupScore(
	transactions: UpTupTransaction[],
	kkpTransactions: KkpTransaction[],
	currentMonth: number,
	config: RuleSetConfig = default2026RuleSet,
	hasKkp?: boolean,
): UpTupScore {
	if (transactions.length === 0 && kkpTransactions.length === 0) {
		return {
			score: null,
			contribution: null,
			tunai: null,
			kkp: null,
			timeliness: null,
			monthlyGup: null,
			tupDeposit: null,
			status: "incomplete",
		};
	}
	const month = Number.isFinite(currentMonth)
		? Math.min(Math.max(Math.floor(currentMonth), 1), 12)
		: 12;
	const result = calculateUpTup(
		{ transactions, kkpTransactions, hasKkp } as never,
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
	const timeliness = Number(
		result.subComponents?.find((s) => s.key === "timeliness")?.score,
	);
	const monthlyGup = Number(
		result.subComponents?.find((s) => s.key === "monthlyGup")?.score,
	);
	const tupDeposit = Number(
		result.subComponents?.find((s) => s.key === "tupDeposit")?.score,
	);
	return {
		score: Number.isFinite(score) ? score : null,
		contribution: Number.isFinite(contribution) ? contribution : null,
		tunai: Number.isFinite(tunai) ? tunai : null,
		kkp: Number.isFinite(kkp) ? kkp : null,
		timeliness: Number.isFinite(timeliness) ? timeliness : null,
		monthlyGup: Number.isFinite(monthlyGup) ? monthlyGup : null,
		tupDeposit: Number.isFinite(tupDeposit) ? tupDeposit : null,
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

import { formatDateDDMMYYYY } from "../format";

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
					? `Dipertanggungjawabkan ${formatDateDDMMYYYY(settled)} (maks. ${formatDateDDMMYYYY(dueDate)}).`
					: `Terlambat — dipertanggungjawabkan ${formatDateDDMMYYYY(settled)}, maks. ${formatDateDDMMYYYY(dueDate)}.`;
		} else if (dueDate) {
			const left = diffDays(today, dueDate);
			if (left === null) {
				detail = `Jatuh tempo ${formatDateDDMMYYYY(dueDate)}. Segera pertanggungjawabkan.`;
			} else if (left < 0) {
				status = "Terlambat";
				detail = `Lewat ${Math.abs(left)} hari dari maks. ${formatDateDDMMYYYY(dueDate)}. Segera pertanggungjawabkan.`;
			} else if (left === 0) {
				detail = `Jatuh tempo hari ini (${formatDateDDMMYYYY(dueDate)}).`;
			} else {
				detail = `Jatuh tempo ${formatDateDDMMYYYY(dueDate)} (H−${left}).`;
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
