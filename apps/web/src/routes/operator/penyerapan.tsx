import { createFileRoute } from "@tanstack/react-router";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import { useActiveContext } from "@/components/layout/active-context";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatPercent, formatRupiah } from "@/lib/format";
import {
	PENYERAPAN_ACCOUNTS,
	QUARTER_MONTHS,
	accountQuarterScore,
	buildAbsorptionQuarters,
	calcPenyerapanScore,
	quarterOfMonth,
	quarterTarget,
	type MonthlyAmounts,
	type PaguMap,
	type PenyerapanAccount,
} from "@/lib/simulation/penyerapan-workspace";
import { fetchBudgetAndRevisions } from "@/services/budget-revisions-service";
import { fetchRpdAndRealizations } from "@/services/rpd-realization-service";
import { fetchSatkerSettings } from "@/services/settings-service";

export const Route = createFileRoute("/operator/penyerapan")({
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
		let isBlu = false;
		try {
			const settings = await fetchSatkerSettings(activeOrgId);
			isBlu = settings.isBlu;
		} catch {
			isBlu = false;
		}
		return { budgetData, rpdData, isBlu };
	},
	component: PenyerapanPage,
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

const ACCOUNT_LABELS: Record<PenyerapanAccount, string> = {
	"51": "Belanja Pegawai (51)",
	"52": "Belanja Barang (52)",
	"53": "Belanja Modal (53)",
	"57": "Bansos (57)",
};

function parseAmount(value: string | undefined): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function PenyerapanPage() {
	const { budgetData, rpdData, isBlu } = Route.useLoaderData();
	const activeContext = useActiveContext();
	const currentMonth =
		activeContext?.context.period.kind === "month"
			? activeContext.context.period.value
			: new Date().getMonth() + 1;
	const currentQuarter = quarterOfMonth(currentMonth);
	const [plan, setPlan] = useState<Record<string, string>>({});
	const [isHelpOpen, setIsHelpOpen] = useState(false);

	const pagu: PaguMap = useMemo(() => {
		const map: PaguMap = {};
		for (const b of budgetData.budgets) {
			const code = b.accountCode as PenyerapanAccount;
			if (PENYERAPAN_ACCOUNTS.includes(code)) map[code] = parseAmount(b.amount);
		}
		return map;
	}, [budgetData]);

	const actual: MonthlyAmounts = useMemo(() => {
		const map: MonthlyAmounts = {};
		for (const r of rpdData.realizations) {
			const code = r.accountCode as PenyerapanAccount;
			if (!PENYERAPAN_ACCOUNTS.includes(code)) continue;
			if (r.month < 1 || r.month > 12) continue;
			const slot = map[r.month] ?? {};
			if (slot[code] === undefined) slot[code] = parseAmount(r.amount);
			map[r.month] = slot;
		}
		return map;
	}, [rpdData]);

	const planAmounts: MonthlyAmounts = useMemo(() => {
		const map: MonthlyAmounts = {};
		for (const key of Object.keys(plan)) {
			const sep = key.indexOf(":");
			const month = Number(key.slice(0, sep));
			const code = key.slice(sep + 1) as PenyerapanAccount;
			if (!PENYERAPAN_ACCOUNTS.includes(code)) continue;
			if (!Number.isInteger(month) || month < 1 || month > 12) continue;
			const raw = Number(plan[key]);
			const slot = map[month] ?? {};
			slot[code] = Number.isFinite(raw) && raw > 0 ? raw : 0;
			map[month] = slot;
		}
		return map;
	}, [plan]);

	const planMonths = useMemo(() => {
		const months: number[] = [];
		for (let m = currentMonth + 1; m <= 12; m++) months.push(m);
		return months;
	}, [currentMonth]);

	const score = useMemo(
		() =>
			calcPenyerapanScore(
				buildAbsorptionQuarters(pagu, actual, planAmounts, currentMonth),
				isBlu,
			),
		[pagu, actual, planAmounts, currentMonth, isBlu],
	);

	const actualScore = useMemo(
		() =>
			calcPenyerapanScore(
				buildAbsorptionQuarters(pagu, actual, {}, currentMonth),
				isBlu,
			),
		[pagu, actual, currentMonth, isBlu],
	);

	const planDelta =
		score.score !== null && actualScore.score !== null
			? score.score - actualScore.score
			: null;
	const gap = score.score !== null ? Math.max(0, 100 - score.score) : null;

	const accountRows = useMemo(() => {
		const qMonths: readonly number[] = QUARTER_MONTHS[currentQuarter];
		return PENYERAPAN_ACCOUNTS.map((acc) => {
			const paguAcc = pagu[acc] ?? 0;
			let ytd = 0;
			let qtd = 0;
			for (let m = 1; m <= currentMonth; m++) {
				const v = actual[m]?.[acc] ?? 0;
				ytd += v;
				if (qMonths.includes(m)) qtd += v;
			}
			const target = quarterTarget(default2026RuleSet, acc, currentQuarter);
			return {
				acc,
				paguAcc,
				ytd,
				target,
				pa: accountQuarterScore(qtd, paguAcc, target),
			};
		});
	}, [pagu, actual, currentMonth, currentQuarter]);

	const hasPagu = accountRows.some((r) => r.paguAcc > 0);
	const hasPlan = Object.keys(plan).length > 0;

	const setPlanValue = (month: number, acc: PenyerapanAccount, raw: string) => {
		const key = `${month}:${acc}`;
		setPlan((prev) => {
			const next = { ...prev };
			if (raw === "") delete next[key];
			else next[key] = raw;
			return next;
		});
	};

	return (
		<OperatorShell currentPath="/operator/penyerapan">
			<div className="space-y-5">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold text-foreground">
							Penyerapan Anggaran
						</h1>
						<p className="mt-1 text-body-small text-muted-foreground">
							Aktual s.d. {MONTH_NAMES[currentMonth - 1]} terkunci · rencana
							sisa tahun dapat disimulasikan · skor terhitung otomatis
						</p>
					</div>
					<Dialog.Root open={isHelpOpen} onOpenChange={setIsHelpOpen}>
						<Dialog.Trigger asChild>
							<button
								type="button"
								aria-label="Lihat rumus singkat Penyerapan Anggaran"
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
										Rumus singkat Penyerapan
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
									<li>Target Rp per akun = Pagu Netto × Target TW ÷ 100</li>
									<li>
										PA akun = min(100, Realisasi TW ÷ Pagu × 100 ÷ Target
										TW × 100)
									</li>
									<li>Nilai TW = Σ(PA akun × Pagu akun) ÷ Σ Pagu</li>
									<li>Nilai indikator = rata-rata TW1–TW4, cap 100</li>
									<li>
										Target 2026 — 51: 20/50/75/95 · 52: 15/50/70/90 · 53:
										10/40/70/90 · 57: 25/50/75/95
									</li>
									<li>
										Aktual = data DB s.d. bulan berjalan, tak tertimpa
										rencana
									</li>
								</ul>
							</Dialog.Content>
						</Dialog.Portal>
					</Dialog.Root>
				</div>

				{isBlu ? (
					<p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-body-small text-muted-foreground">
						Satker BLU: Penyerapan Anggaran dikecualikan baseline
						PER-5/PB/2024 — nilai 100.
					</p>
				) : null}

				{!hasPagu ? (
					<div className="rounded-xl border border-border bg-background p-4">
						<p className="text-label text-foreground">
							Belum ada pagu tahun berjalan
						</p>
						<p className="mt-1 text-body-small text-muted-foreground">
							Isi pagu dulu agar skor bisa dihitung.{" "}
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
							· bobot 20%
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
							Gap ke 100
						</p>
						<p className="mt-1 text-2xl font-bold text-foreground">
							{gap !== null ? formatPercent(gap) : "—"}
						</p>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Target TW{currentQuarter} per akun di tabel
						</p>
					</div>
				</div>

				<section
					aria-label="Aktual tahun berjalan terkunci"
					className="space-y-3 rounded-2xl border border-border bg-background p-4 sm:p-5"
				>
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-sm font-semibold text-foreground">
							Aktual s.d. {MONTH_NAMES[currentMonth - 1]} · terkunci
						</h2>
						<a
							href="/operator/data/rpd-realization"
							className="shrink-0 text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
						>
							Ubah aktual
						</a>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[560px] text-left text-body-small">
							<thead>
								<tr className="text-muted-foreground">
									<th className="px-2 py-1.5 font-semibold">Akun</th>
									<th className="px-2 py-1.5 text-right font-semibold">
										Pagu Netto
									</th>
									<th className="px-2 py-1.5 text-right font-semibold">
										Realisasi s.d. {MONTH_NAMES[currentMonth - 1]}
									</th>
									<th className="px-2 py-1.5 text-right font-semibold">
										Target TW{currentQuarter}
									</th>
									<th className="px-2 py-1.5 text-right font-semibold">
										PA TW{currentQuarter}
									</th>
								</tr>
							</thead>
							<tbody>
								{accountRows.map((r) => (
									<tr key={r.acc} className="border-t border-border">
										<td className="px-2 py-2 font-semibold text-foreground">
											{ACCOUNT_LABELS[r.acc]}
										</td>
										<td className="px-2 py-2 text-right text-foreground">
											{formatRupiah(r.paguAcc)}
										</td>
										<td className="px-2 py-2 text-right">
											<span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2 py-1 text-foreground">
												{formatRupiah(r.ytd)}
												<span
													aria-label="Terkunci"
													title="Aktual dari database, tak bisa diubah di sini"
													className="text-[10px] text-muted-foreground"
												>
													🔒
												</span>
											</span>
										</td>
										<td className="px-2 py-2 text-right text-muted-foreground">
											{formatPercent(r.target)}
										</td>
										<td className="px-2 py-2 text-right font-semibold text-foreground">
											{formatPercent(r.pa)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>

				<section
					aria-label="Rencana sisa tahun"
					className="space-y-3 rounded-2xl border border-border bg-background p-4 sm:p-5"
				>
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-sm font-semibold text-foreground">
							Rencana sisa tahun · Dapat diedit
						</h2>
						{hasPlan ? (
							<button
								type="button"
								onClick={() => setPlan({})}
								className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
							>
								Reset
							</button>
						) : null}
					</div>
					{planMonths.length === 0 ? (
						<p className="text-body-small text-muted-foreground">
							Sudah Desember — tak ada sisa bulan untuk direncanakan.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full min-w-[560px] text-left text-body-small">
								<thead>
									<tr className="text-muted-foreground">
										<th className="px-2 py-1.5 font-semibold">Bulan</th>
										{PENYERAPAN_ACCOUNTS.map((acc) => (
											<th
												key={acc}
												className="px-2 py-1.5 text-right font-semibold"
											>
												{acc}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{planMonths.map((m) => (
										<tr key={m} className="border-t border-border">
											<td className="px-2 py-2 font-semibold text-foreground">
												{MONTH_NAMES[m - 1]}
											</td>
											{PENYERAPAN_ACCOUNTS.map((acc) => {
												const key = `${m}:${acc}`;
												return (
													<td key={key} className="px-2 py-1.5">
														<label
															htmlFor={`rencana-${key}`}
															className="sr-only"
														>
															Rencana {ACCOUNT_LABELS[acc]} bulan{" "}
															{MONTH_NAMES[m - 1]} (Rp)
														</label>
														<FormattedNumberInput
															id={`rencana-${key}`}
															value={plan[key] ?? ""}
															placeholder="0"
															onChange={(raw) =>
																setPlanValue(m, acc, raw)
															}
															className="w-full rounded-lg border border-yellow-300 bg-yellow-50 px-2.5 py-1.5 text-right text-xs text-foreground"
														/>
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					<p className="text-[11px] text-muted-foreground">
						Sel kuning = boleh diubah (pola Excel). Rencana hanya
						memengaruhi skor di halaman ini, aktual di database tak
						tertimpa. Pagu:{" "}
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
