import { createFileRoute } from "@tanstack/react-router";
import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import { useActiveContext } from "@/components/layout/active-context";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatPercent, formatRupiah } from "@/lib/format";
import {
	DEVIASI_ACCOUNTS,
	buildDeviationInput,
	calcDeviasiScore,
	deviationOf,
	paguWeights,
	type DeviasiAccount,
	type MonthlyAmounts,
	type PaguMap,
} from "@/lib/simulation/deviasi-workspace";
import { fetchBudgetAndRevisions } from "@/services/budget-revisions-service";
import { fetchRpdAndRealizations } from "@/services/rpd-realization-service";

export const Route = createFileRoute("/operator/deviasi")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		const [budgetData, rpdData] = await Promise.all([
			fetchBudgetAndRevisions(activeOrgId),
			fetchRpdAndRealizations(activeOrgId),
		]);
		return { budgetData, rpdData };
	},
	component: DeviasiPage,
});

const MONTH_NAMES = [
	"Januari",
	"Februari",
	"Maret",
	"April",
	"Mei",
	"Juni",
	"Juli",
	"Agustus",
	"September",
	"Oktober",
	"November",
	"Desember",
];

const ACCOUNT_LABELS: Record<DeviasiAccount, string> = {
	"51": "Belanja Pegawai (51)",
	"52": "Belanja Barang (52)",
	"53": "Belanja Modal (53)",
	"57": "Bansos (57)",
};

function parseAmount(value: string | undefined): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function toMonthly(
	rows: Array<{ month: number; accountCode: string; amount: string }>,
): MonthlyAmounts {
	const map: MonthlyAmounts = {};
	for (const r of rows) {
		const code = r.accountCode as DeviasiAccount;
		if (!DEVIASI_ACCOUNTS.includes(code)) continue;
		if (r.month < 1 || r.month > 12) continue;
		const slot = map[r.month] ?? {};
		if (slot[code] === undefined) slot[code] = parseAmount(r.amount);
		map[r.month] = slot;
	}
	return map;
}

function DeviasiPage() {
	const { budgetData, rpdData } = Route.useLoaderData();
	const activeContext = useActiveContext();
	const currentMonth =
		activeContext?.context.period.kind === "month"
			? activeContext.context.period.value
			: new Date().getMonth() + 1;
	const [planRpd, setPlanRpd] = useState<Record<string, string>>({});
	const [planReal, setPlanReal] = useState<Record<string, string>>({});
	const [isHelpOpen, setIsHelpOpen] = useState(false);

	const pagu: PaguMap = useMemo(() => {
		const map: PaguMap = {};
		for (const b of budgetData.budgets) {
			const code = b.accountCode as DeviasiAccount;
			if (DEVIASI_ACCOUNTS.includes(code)) map[code] = parseAmount(b.amount);
		}
		return map;
	}, [budgetData]);

	const rpd: MonthlyAmounts = useMemo(
		() => toMonthly(rpdData.rpdLines),
		[rpdData],
	);
	const actual: MonthlyAmounts = useMemo(
		() => toMonthly(rpdData.realizations),
		[rpdData],
	);

	const planRpdAmounts: MonthlyAmounts = useMemo(() => {
		const map: MonthlyAmounts = {};
		for (const key of Object.keys(planRpd)) {
			const sep = key.indexOf(":");
			const month = Number(key.slice(0, sep));
			const code = key.slice(sep + 1) as DeviasiAccount;
			if (!DEVIASI_ACCOUNTS.includes(code)) continue;
			if (!Number.isInteger(month) || month < 1 || month > 11) continue;
			const raw = Number(planRpd[key]);
			const slot = map[month] ?? {};
			slot[code] = Number.isFinite(raw) && raw > 0 ? raw : 0;
			map[month] = slot;
		}
		return map;
	}, [planRpd]);

	const planRealAmounts: MonthlyAmounts = useMemo(() => {
		const map: MonthlyAmounts = {};
		for (const key of Object.keys(planReal)) {
			const sep = key.indexOf(":");
			const month = Number(key.slice(0, sep));
			const code = key.slice(sep + 1) as DeviasiAccount;
			if (!DEVIASI_ACCOUNTS.includes(code)) continue;
			if (!Number.isInteger(month) || month < 1 || month > 11) continue;
			const raw = Number(planReal[key]);
			const slot = map[month] ?? {};
			slot[code] = Number.isFinite(raw) && raw > 0 ? raw : 0;
			map[month] = slot;
		}
		return map;
	}, [planReal]);

	const planMonths = useMemo(() => {
		const months: number[] = [];
		for (let m = currentMonth + 1; m <= 11; m++) months.push(m);
		return months;
	}, [currentMonth]);

	const actualMonths = useMemo(() => {
		const last = Math.min(currentMonth, 11);
		const months: number[] = [];
		for (let m = 1; m <= last; m++) months.push(m);
		return months;
	}, [currentMonth]);

	const score = useMemo(
		() =>
			calcDeviasiScore(
				buildDeviationInput(
					pagu,
					rpd,
					actual,
					planRpdAmounts,
					planRealAmounts,
					currentMonth,
				),
			),
		[pagu, rpd, actual, planRpdAmounts, planRealAmounts, currentMonth],
	);

	const actualScore = useMemo(
		() =>
			calcDeviasiScore(
				buildDeviationInput(pagu, rpd, actual, {}, {}, currentMonth),
			),
		[pagu, rpd, actual, currentMonth],
	);

	const planDelta =
		score.score !== null && actualScore.score !== null
			? score.score - actualScore.score
			: null;

	const weights = useMemo(() => paguWeights(pagu), [pagu]);
	const hasPagu = DEVIASI_ACCOUNTS.some((a) => (pagu[a] ?? 0) > 0);
	const hasPlan = Object.keys(planRpd).length + Object.keys(planReal).length > 0;

	const monthRows = useMemo(() => {
		return actualMonths.map((m) => {
			let weighted = 0;
			const perAcc = DEVIASI_ACCOUNTS.map((acc) => {
				const planned = rpd[m]?.[acc] ?? 0;
				const realized = actual[m]?.[acc] ?? 0;
				const dev = deviationOf(planned, realized);
				weighted += dev * (weights[acc] ?? 0);
				return { acc, planned, realized, dev };
			});
			return { month: m, perAcc, weighted };
		});
	}, [actualMonths, rpd, actual, weights]);

	const setRpdValue = (month: number, acc: DeviasiAccount, raw: string) => {
		const key = `${month}:${acc}`;
		setPlanRpd((prev) => {
			const next = { ...prev };
			if (raw === "") delete next[key];
			else next[key] = raw;
			return next;
		});
	};

	const setRealValue = (month: number, acc: DeviasiAccount, raw: string) => {
		const key = `${month}:${acc}`;
		setPlanReal((prev) => {
			const next = { ...prev };
			if (raw === "") delete next[key];
			else next[key] = raw;
			return next;
		});
	};

	return (
		<OperatorShell currentPath="/operator/deviasi">
			<div className="space-y-5">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold text-foreground">
							Deviasi Halaman III
						</h1>
						<p className="mt-1 text-body-small text-muted-foreground">
							Aktual s.d. {MONTH_NAMES[Math.min(currentMonth, 11) - 1]} terkunci
							· rencana sisa tahun (Jan–Nov) dapat disimulasikan · skor
							terhitung otomatis
						</p>
					</div>
					<Dialog.Root open={isHelpOpen} onOpenChange={setIsHelpOpen}>
						<Dialog.Trigger asChild>
							<button
								type="button"
								aria-label="Lihat rumus singkat Deviasi Halaman III"
								className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-sm font-bold text-muted-foreground hover:bg-surface-muted hover:text-foreground"
							>
								?
							</button>
						</Dialog.Trigger>
						<Dialog.Portal>
							<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
							<Dialog.Content className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-lg rounded-xl border border-border bg-background p-5 shadow-lg outline-none">
								<div className="flex items-center justify-between gap-4">
									<Dialog.Title className="text-h3">
										Rumus singkat Deviasi
									</Dialog.Title>
									<Dialog.Close asChild>
										<button
											type="button"
											className="min-h-10 rounded-md px-3 py-2 text-label text-muted-foreground hover:bg-surface-muted hover:text-foreground"
										>
											Tutup
										</button>
									</Dialog.Close>
								</div>
								<Dialog.Description className="mt-1 text-body-small text-muted-foreground">
									Rule set 2026 · sumber angka = rumus aplikasi
								</Dialog.Description>
								<ul className="mt-3 list-disc space-y-1.5 pl-5 text-body-small text-foreground">
									<li>Deviasi akun = |Realisasi − RPD| ÷ RPD × 100, cap 100</li>
									<li>Deviasi bulan = Σ(deviasi akun × pagu akun ÷ total pagu)</li>
									<li>Rata-rata = Σ deviasi bulan ÷ 11 bulan (Jan–Nov)</li>
									<li>Nilai = 100 bila rata-rata ≤ 5, selain itu 100 − rata-rata</li>
									<li>Pagu = Pagu Netto, sumber yang sama dengan Penyerapan</li>
									<li>Desember tak dihitung</li>
								</ul>
							</Dialog.Content>
						</Dialog.Portal>
					</Dialog.Root>
				</div>

				{!hasPagu ? (
					<div className="rounded-xl border border-border bg-background p-4">
						<p className="text-label text-foreground">
							Belum ada pagu tahun berjalan
						</p>
						<p className="mt-1 text-body-small text-muted-foreground">
							Isi pagu dulu agar proporsi bisa dihitung.{" "}
							<a
								href="/operator/data/budget-revisions"
								className="text-primary underline-offset-4 hover:underline"
							>
								Buka Pagu & Revisi
							</a>
						</p>
					</div>
				) : null}

				<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					<div className="rounded-xl border border-border bg-background p-4">
						<p className="text-body-small text-muted-foreground">
							Skor indikator
						</p>
						<p className="mt-1 text-2xl font-bold text-foreground">
							{score.score !== null ? formatPercent(score.score) : "—"}
						</p>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Kontribusi{" "}
							{score.contribution !== null
								? formatPercent(score.contribution)
								: "—"}{" "}
							· bobot 15%
						</p>
					</div>
					<div className="rounded-xl border border-border bg-background p-4">
						<p className="text-body-small text-muted-foreground">Skor aktual</p>
						<p className="mt-1 text-2xl font-bold text-foreground">
							{actualScore.score !== null
								? formatPercent(actualScore.score)
								: "—"}
						</p>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Tanpa rencana · terkunci
						</p>
					</div>
					<div className="rounded-xl border border-border bg-background p-4">
						<p className="text-body-small text-muted-foreground">
							Dampak rencana
						</p>
						<p className="mt-1 text-2xl font-bold text-foreground">
							{planDelta !== null
								? `${planDelta >= 0 ? "+" : ""}${formatPercent(planDelta)}`
								: "—"}
						</p>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Selisih vs aktual
						</p>
					</div>
					<div className="rounded-xl border border-border bg-background p-4">
						<p className="text-body-small text-muted-foreground">
							Rata-rata deviasi
						</p>
						<p className="mt-1 text-2xl font-bold text-foreground">
							{score.avgDeviation !== null
								? formatPercent(score.avgDeviation)
								: "—"}
						</p>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Ambang 5% · Jan–Nov
						</p>
					</div>
				</div>

				<section
					aria-label="Aktual tahun berjalan terkunci"
					className="space-y-3 rounded-2xl border border-border bg-background p-4 sm:p-5"
				>
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-sm font-semibold text-foreground">
							Aktual s.d. {MONTH_NAMES[Math.min(currentMonth, 11) - 1]} ·
							terkunci
						</h2>
						<a
							href="/operator/data/rpd-realization"
							className="shrink-0 text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
						>
							Ubah aktual
						</a>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[640px] text-left text-body-small">
							<thead>
								<tr className="text-muted-foreground">
									<th className="px-2 py-1.5 font-semibold">Bulan</th>
									{DEVIASI_ACCOUNTS.map((acc) => (
										<th
											key={acc}
											className="px-2 py-1.5 text-right font-semibold"
										>
											Dev {acc}
										</th>
									))}
									<th className="px-2 py-1.5 text-right font-semibold">
										Tertimbang
									</th>
								</tr>
							</thead>
							<tbody>
								{monthRows.map((row) => (
									<tr key={row.month} className="border-t border-border">
										<td className="px-2 py-2 font-semibold text-foreground">
											{MONTH_NAMES[row.month - 1]}
										</td>
										{row.perAcc.map((c) => (
											<td
												key={c.acc}
												className="px-2 py-2 text-right text-foreground"
												title={`${ACCOUNT_LABELS[c.acc]} · RPD ${formatRupiah(c.planned)} · Realisasi ${formatRupiah(c.realized)}`}
											>
												{formatPercent(c.dev)}{" "}
												<span
													aria-label="Terkunci"
													title="Aktual dari database, tak bisa diubah di sini"
													className="text-[10px] text-muted-foreground"
												>
													🔒
												</span>
											</td>
										))}
										<td className="px-2 py-2 text-right font-semibold text-foreground">
											{formatPercent(row.weighted)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p className="text-[11px] text-muted-foreground">
						Deviasi per akun = |Realisasi − RPD| ÷ RPD. Arahkan kursor untuk
						lihat nominal. Proporsi pagu:{" "}
						{DEVIASI_ACCOUNTS.map(
							(a) => `${a} ${formatPercent((weights[a] ?? 0) * 100)}`,
						).join(" · ")}
					</p>
				</section>

				<section
					aria-label="Rencana sisa tahun"
					className="space-y-3 rounded-2xl border border-border bg-background p-4 sm:p-5"
				>
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-sm font-semibold text-foreground">
							Rencana sisa tahun (Jan–Nov) · Dapat diedit
						</h2>
						{hasPlan ? (
							<button
								type="button"
								onClick={() => {
									setPlanRpd({});
									setPlanReal({});
								}}
								className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
							>
								Reset
							</button>
						) : null}
					</div>
					{planMonths.length === 0 ? (
						<p className="text-body-small text-muted-foreground">
							Sudah November/Desember — tak ada sisa bulan Jan–Nov untuk
							direncanakan.
						</p>
					) : (
						<div className="space-y-4">
							{planMonths.map((m) => (
								<div key={m} className="rounded-xl border border-border p-3">
									<p className="text-label text-foreground">
										{MONTH_NAMES[m - 1]}
									</p>
									<div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
										{DEVIASI_ACCOUNTS.map((acc) => (
											<div key={acc} className="space-y-1.5">
												<p className="text-[11px] font-semibold text-muted-foreground">
													Akun {acc}
												</p>
												<label
													htmlFor={`rpd-${m}-${acc}`}
													className="sr-only"
												>
													Rencana RPD akun {acc} bulan {MONTH_NAMES[m - 1]}{" "}
													(Rp)
												</label>
												<FormattedNumberInput
													id={`rpd-${m}-${acc}`}
													value={planRpd[`${m}:${acc}`] ?? ""}
													placeholder={`RPD ${acc}`}
													onChange={(raw) => setRpdValue(m, acc, raw)}
													className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-2.5 py-1.5 text-right text-xs text-foreground"
												/>
												<label
													htmlFor={`real-${m}-${acc}`}
													className="sr-only"
												>
													Rencana realisasi akun {acc} bulan{" "}
													{MONTH_NAMES[m - 1]} (Rp)
												</label>
												<FormattedNumberInput
													id={`real-${m}-${acc}`}
													value={planReal[`${m}:${acc}`] ?? ""}
													placeholder={`Real ${acc}`}
													onChange={(raw) => setRealValue(m, acc, raw)}
													className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-2.5 py-1.5 text-right text-xs text-foreground"
												/>
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					)}
					<p className="text-[11px] text-muted-foreground">
						Sel kuning = boleh diubah. Rencana hanya memengaruhi skor di
						halaman ini, aktual di database tak tertimpa. Desember tak
						dihitung. Pagu:{" "}
						<a
							href="/operator/data/budget-revisions"
							className="text-primary underline-offset-4 hover:underline"
						>
							Pagu & Revisi
						</a>
					</p>
				</section>
			</div>
		</OperatorShell>
	);
}
