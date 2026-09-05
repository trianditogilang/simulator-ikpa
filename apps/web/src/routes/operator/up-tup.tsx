import { createFileRoute } from "@tanstack/react-router";
import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";
import { useActiveContext } from "@/components/layout/active-context";
import { OperatorShell } from "@/components/layout/operator-shell";
import { UpTupAssumptionPanel } from "@/components/operator/up-tup-assumption-panel";
import { formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import {
	DEFAULT_UP_TUP_ASSUMPTIONS,
	type UpTupAssumptions,
} from "@/lib/simulation/up-tup-assumptions";
import {
	buildGupReminders,
	calcUpTupScore,
	mapActualToEngine,
	mergeWithAssumptions,
} from "@/lib/simulation/up-tup-workspace";
import { fetchUpTupAndKkp } from "@/services/up-tup-kkp-service";

export const Route = createFileRoute("/operator/up-tup")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchUpTupAndKkp(activeOrgId);
	},
	component: UpTupPage,
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

const TYPE_LABELS: Record<string, string> = {
	UP: "UP",
	TUP: "TUP",
	GUP: "GUP",
	GUP_NIHIL: "GUP Nihil",
	PTUP: "PTUP",
	SETORAN_TUP: "Setoran TUP",
};

function UpTupPage() {
	const data = Route.useLoaderData();
	const activeContext = useActiveContext();
	const currentMonth =
		activeContext?.context.period.kind === "month"
			? activeContext.context.period.value
			: new Date().getMonth() + 1;
	const [assumptions, setAssumptions] = useState<UpTupAssumptions | null>(null);
	const [isHelpOpen, setIsHelpOpen] = useState(false);

	const actualEngine = useMemo(
		() => mapActualToEngine(data.upTupList, data.kkpList, data.year),
		[data],
	);

	const mergedEngine = useMemo(
		() => mergeWithAssumptions(actualEngine, assumptions),
		[actualEngine, assumptions],
	);

	const score = useMemo(
		() =>
			calcUpTupScore(
				mergedEngine.transactions,
				mergedEngine.kkpTransactions,
				currentMonth,
			),
		[mergedEngine, currentMonth],
	);

	const actualScore = useMemo(
		() =>
			calcUpTupScore(
				actualEngine.transactions,
				actualEngine.kkpTransactions,
				currentMonth,
			),
		[actualEngine, currentMonth],
	);

	const planDelta =
		score.score !== null && actualScore.score !== null
			? score.score - actualScore.score
			: null;

	const reminders = useMemo(
		() => buildGupReminders(data.upTupList),
		[data.upTupList],
	);
	const urgentCount = reminders.filter((r) => r.status !== "Tepat Waktu").length;
	const hasActual =
		actualEngine.transactions.length + actualEngine.kkpTransactions.length > 0;

	return (
		<OperatorShell currentPath="/operator/up-tup">
			<div className="space-y-5">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold text-foreground">UP/TUP & KKP</h1>
						<p className="mt-1 text-body-small text-muted-foreground">
							Aktual s.d. {MONTH_NAMES[currentMonth - 1]} terkunci · rencana
							GUP sisa tahun dapat disimulasikan · skor terhitung otomatis
						</p>
					</div>
					<Dialog.Root open={isHelpOpen} onOpenChange={setIsHelpOpen}>
						<Dialog.Trigger asChild>
							<button
								type="button"
								aria-label="Lihat rumus singkat UP/TUP & KKP"
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
										Rumus singkat UP/TUP & KKP
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
									<li>Tunai = Ketepatan 50% + GUP sebulan 25% + Setoran TUP 25%</li>
									<li>Nilai = Tunai 90% + KKP 10%</li>
									<li>Target KKP per triwulan: Q1 1% · Q2 5% · Q3 9% · Q4 12,5% (capai = 110)</li>
									<li>GUP tepat waktu bila SP2D ≤ hari yang sama bulan depan</li>
									<li>Aktual = data DB, tak tertimpa rencana</li>
								</ul>
							</Dialog.Content>
						</Dialog.Portal>
					</Dialog.Root>
				</div>

				<section
					aria-label="Reminder GUP dan PTUP wajib"
					className="space-y-2 rounded-2xl border border-border bg-background p-4 sm:p-5"
				>
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-sm font-semibold text-foreground">
							Reminder GUP/PTUP wajib
							{urgentCount > 0 ? ` · ${urgentCount} perlu perhatian` : null}
						</h2>
						<a
							href="/operator/reminders"
							className="shrink-0 text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
						>
							Reminder Center
						</a>
					</div>
					{reminders.length === 0 ? (
						<p className="text-body-small text-muted-foreground">
							Belum ada transaksi GUP/PTUP. Isi aktual dulu agar jatuh tempo
							pertanggungjawaban terpantau.{" "}
							<a
								href="/operator/data/up-tup-kkp"
								className="text-primary underline-offset-4 hover:underline"
							>
								Buka data UP/TUP
							</a>
						</p>
					) : (
						<ul className="space-y-1.5">
							{reminders.map((r) => (
								<li
									key={r.id}
									className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-body-small"
								>
									<div>
										<p className="font-semibold text-foreground">
											{TYPE_LABELS[r.type] ?? r.type} · {formatRupiah(r.amount)}
										</p>
										<p className="text-muted-foreground">
											SP2D {r.sp2dAt} · {r.detail}
										</p>
									</div>
									<span
										className={
											r.status === "Tepat Waktu"
												? "shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success"
												: r.status === "Terlambat"
													? "shrink-0 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger"
													: "shrink-0 rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-semibold text-yellow-800"
										}
									>
										{r.status}
									</span>
								</li>
							))}
						</ul>
					)}
				</section>

				<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					<div className="rounded-xl border border-border bg-background p-4">
						<p className="text-body-small text-muted-foreground">
							Skor indikator
						</p>
						<p className="mt-1 text-2xl font-bold text-foreground">
							{score.score !== null ? formatNumber(score.score) : "—"}
						</p>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Kontribusi{" "}
							{score.contribution !== null
								? formatNumber(score.contribution)
								: "—"}{" "}
							· bobot 10%
						</p>
					</div>
					<div className="rounded-xl border border-border bg-background p-4">
						<p className="text-body-small text-muted-foreground">Skor aktual</p>
						<p className="mt-1 text-2xl font-bold text-foreground">
							{actualScore.score !== null
								? formatNumber(actualScore.score)
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
								? `${planDelta >= 0 ? "+" : ""}${formatNumber(planDelta)}`
								: "—"}
						</p>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Selisih vs aktual
						</p>
					</div>
					<div className="rounded-xl border border-border bg-background p-4">
						<p className="text-body-small text-muted-foreground">Tunai · KKP</p>
						<p className="mt-1 text-2xl font-bold text-foreground">
							{score.tunai !== null ? formatNumber(score.tunai) : "—"}
							<span className="text-sm font-semibold text-muted-foreground">
								{" "}
								· {score.kkp !== null ? formatNumber(score.kkp) : "—"}
							</span>
						</p>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Komponen 90% · 10%
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
							href="/operator/data/up-tup-kkp"
							className="shrink-0 text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
						>
							Ubah aktual
						</a>
					</div>
					{!hasActual ? (
						<p className="text-body-small text-muted-foreground">
							Belum ada transaksi UP/TUP/KKP tahun {data.year}.{" "}
							<a
								href="/operator/data/up-tup-kkp"
								className="text-primary underline-offset-4 hover:underline"
							>
								Tambah actual
							</a>
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full min-w-[560px] text-left text-body-small">
								<thead>
									<tr className="text-muted-foreground">
										<th className="px-2 py-1.5 font-semibold">Transaksi</th>
										<th className="px-2 py-1.5 text-right font-semibold">
											Nominal
										</th>
										<th className="px-2 py-1.5 text-right font-semibold">
											SP2D
										</th>
										<th className="px-2 py-1.5 text-right font-semibold">
											Pertanggungjawaban
										</th>
										<th className="px-2 py-1.5 text-right font-semibold">
											Status
										</th>
									</tr>
								</thead>
								<tbody>
									{data.upTupList.map((u) => (
										<tr key={u.id} className="border-t border-border">
											<td className="px-2 py-2 font-semibold text-foreground">
												{TYPE_LABELS[u.type] ?? u.type}{" "}
												<span
													aria-label="Terkunci"
													title="Aktual dari database, tak bisa diubah di sini"
													className="text-[10px] font-normal text-muted-foreground"
												>
													🔒
												</span>
											</td>
											<td className="px-2 py-2 text-right text-foreground">
												{formatRupiah(Number(u.amount) || 0)}
											</td>
											<td className="px-2 py-2 text-right text-muted-foreground">
												{u.sp2dAt.slice(0, 10)}
											</td>
											<td className="px-2 py-2 text-right text-muted-foreground">
												{u.settlementDate ? u.settlementDate.slice(0, 10) : "—"}
											</td>
											<td className="px-2 py-2 text-right text-foreground">
												{u.isSettled ? "Selesai" : "Belum"}
											</td>
										</tr>
									))}
									{data.kkpList.map((k) => (
										<tr key={k.id} className="border-t border-border">
											<td className="px-2 py-2 font-semibold text-foreground">
												KKP {MONTH_NAMES[k.month - 1]}{" "}
												<span
													aria-label="Terkunci"
													title="Aktual dari database, tak bisa diubah di sini"
													className="text-[10px] font-normal text-muted-foreground"
												>
													🔒
												</span>
											</td>
											<td className="px-2 py-2 text-right text-foreground">
												{formatRupiah(Number(k.amount) || 0)}
											</td>
											<td className="px-2 py-2 text-right text-muted-foreground">
												{k.usageDate ? k.usageDate.slice(0, 10) : "—"}
											</td>
											<td className="px-2 py-2 text-right text-muted-foreground">
												—
											</td>
											<td className="px-2 py-2 text-right text-foreground">
												Custom
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					<p className="text-[11px] text-muted-foreground">
						Skor aktual dihitung via rumus aplikasi dari tabel ini. Tab data
						lengkap (tambah/hapus) tetap di{" "}
						<a
							href="/operator/data/up-tup-kkp"
							className="text-primary underline-offset-4 hover:underline"
						>
							Data UP/TUP & KKP
						</a>
						.
					</p>
				</section>

				<section
					aria-label="Rencana sisa tahun"
					className="space-y-3 rounded-2xl border border-yellow-300/70 bg-yellow-50/40 p-4 sm:p-5"
				>
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-sm font-semibold text-foreground">
							Rencana sisa tahun (GUP + KKP) · Dapat diedit
						</h2>
						{assumptions ? (
							<button
								type="button"
								onClick={() => setAssumptions(null)}
								className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
							>
								Reset
							</button>
						) : (
							<button
								type="button"
								onClick={() =>
									setAssumptions({ ...DEFAULT_UP_TUP_ASSUMPTIONS })
								}
								className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
							>
								Mulai simulasi
							</button>
						)}
					</div>
					{assumptions ? (
						<>
							<UpTupAssumptionPanel
								value={assumptions}
								actualUpTupContrib={actualScore.contribution}
								onChange={setAssumptions}
								onReset={() => setAssumptions(null)}
							/>
						</>
					) : (
						<p className="text-body-small text-muted-foreground">
							Belum ada rencana. Tekan <strong>Mulai simulasi</strong> untuk
							mencoba rencana GUP (nominal, tanggal, disebulankan, tepat
							waktu) + KKP custom — menempel di atas aktual, skor berubah
							instan.
						</p>
					)}
				</section>

				<p className="text-[11px] text-muted-foreground">
					Bobot indikator {formatPercent(10)} · gabungan{" "}
					{score.score !== null ? formatNumber(score.score) : "—"} vs aktual{" "}
					{actualScore.score !== null ? formatNumber(actualScore.score) : "—"}.
					Detail analisis:{" "}
					<a
						href="/operator/analysis"
						className="text-primary underline-offset-4 hover:underline"
					>
						Lihat semua
					</a>
				</p>
			</div>
		</OperatorShell>
	);
}
