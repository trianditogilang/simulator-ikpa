import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowRight,
	CheckCircle2,
	Clock,
	Coins,
	CreditCard,
	HelpCircle,
	Info,
	RotateCw,
	Scale,
	ShieldCheck,
	Sparkles,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";
import { useActiveContext } from "@/components/layout/active-context";
import { OperatorShell } from "@/components/layout/operator-shell";
import { UpTupAssumptionPanel } from "@/components/operator/up-tup-assumption-panel";
import {
	formatDateDDMMYYYY,
	formatNumber,
	formatRupiah,
} from "@/lib/format";
import {
	DEFAULT_UP_TUP_ASSUMPTIONS,
	type UpTupAssumptions,
} from "@/lib/simulation/up-tup-assumptions";
import {
	buildGupReminders,
	calcUpTupScore,
	isThr2026FairnessApplied,
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
	UP: "Uang Persediaan (UP Awal)",
	TUP: "Tambahan UP (TUP)",
	GUP: "Ganti UP (Revolving GUP)",
	GUP_NIHIL: "GUP Nihil",
	PTUP: "Pertanggungjawaban TUP (PTUP)",
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

	// Status kepemilikan KKP satker (Default: none / Tidak Memiliki UP KKP)
	const [kkpConfigStatus] = useState<"active" | "pending" | "none">(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("ikpa_satker_kkp_status");
			if (saved === "active" || saved === "pending" || saved === "none") {
				return saved;
			}
		}
		return data.kkpList.length > 0 ? "active" : "none";
	});

	const hasKkp = kkpConfigStatus === "active" || data.kkpList.length > 0;

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
				undefined,
				hasKkp,
			),
		[mergedEngine, currentMonth, hasKkp],
	);

	const actualScore = useMemo(
		() =>
			calcUpTupScore(
				actualEngine.transactions,
				actualEngine.kkpTransactions,
				currentMonth,
				undefined,
				hasKkp,
			),
		[actualEngine, currentMonth, hasKkp],
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

	// Deteksi transaksi yang memenuhi Fairness THR 2026 (SP2D referensi: 18 Feb - 17 Mar 2026)
	const thrFairnessTxCount = useMemo(() => {
		return data.upTupList.filter((u) =>
			isThr2026FairnessApplied(u.referenceSp2dAt),
		).length;
	}, [data.upTupList]);

	// Rekomendasi dinamis berdasarkan kondisi aktual
	const recommendations = useMemo(() => {
		const list: { title: string; desc: string; type: "good" | "warn" | "info" }[] = [];

		if (urgentCount > 0) {
			list.push({
				title: "Percepat Pengajuan Revolving GUP / PTUP",
				desc: `Terdapat ${urgentCount} transaksi GUP/PTUP yang mendekati atau telah melewati batas waktu 1 bulan. Segera sampaikan SPP/SPM ke KPPN.`,
				type: "warn",
			});
		} else {
			list.push({
				title: "Ketepatan Waktu GUP/PTUP Terkendali",
				desc: "Seluruh transaksi pertanggungjawaban UP/TUP berstatus tepat waktu (≤ 1 bulan dari SP2D referensi).",
				type: "good",
			});
		}

		if (data.kkpList.length === 0) {
			list.push({
				title: "Optimalkan Realisasi Belanja KKP",
				desc: "Belum tercatat transaksi KKP pada tahun anggaran ini. Belanja operasional non-tunai via KKP dapat mendongkrak skor KKP hingga 110.",
				type: "info",
			});
		} else {
			list.push({
				title: "Monitoring Target Kumulatif KKP Triwulanan",
				desc: "Pastikan proporsi akumulatif belanja KKP memenuhi target triwulanan (TW I: 1%, TW II: 5%, TW III: 9%, TW IV: 12,5%) untuk memperoleh nilai maksimal 110.",
				type: "good",
			});
		}

		list.push({
			title: "Perencanaan TUP Tanpa Setoran Kembali",
			desc: "Nilai kinerja setoran TUP maksimal 100 dan berkurang proporsional jika terdapat setoran TUP kembali. Rencanakan kebutuhan TUP secara presisi.",
			type: "info",
		});

		return list;
	}, [urgentCount, data.kkpList.length]);

	return (
		<OperatorShell currentPath="/operator/up-tup">
			<div className="space-y-6">
				{/* Top Header Banner */}
				<div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<div className="flex items-center gap-2">
							<span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
								Bobot 10% IKPA
							</span>
							<span className="text-[11px] font-medium text-muted-foreground">
								PER-5/PB/2024 · TA {data.year}
							</span>
						</div>
						<h1 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
							Pengelolaan UP / TUP &amp; KKP
						</h1>
						<p className="mt-1 text-xs text-muted-foreground sm:text-sm">
							Aktual s.d. {MONTH_NAMES[currentMonth - 1]} terkunci · Rencana sisa tahun
							dapat disimulasikan · Skor terhitung otomatis secara transparan.
						</p>
					</div>

					<div className="flex items-center gap-2">
						<a
							href="/operator/data/up-tup-kkp"
							className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-surface-muted"
						>
							<Coins className="size-3.5 text-primary" />
							<span>Kelola Data UP/TUP</span>
							<ArrowRight className="size-3 text-muted-foreground" />
						</a>

						<Dialog.Root open={isHelpOpen} onOpenChange={setIsHelpOpen}>
							<Dialog.Trigger asChild>
								<button
									type="button"
									aria-label="Lihat rumus singkat UP/TUP & KKP"
									className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
								>
									<HelpCircle className="size-4" />
									<span>Panduan Rumus</span>
								</button>
							</Dialog.Trigger>
							<Dialog.Portal>
								<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-xs" />
								<Dialog.Content className="fixed inset-x-4 top-[8%] z-50 mx-auto max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl outline-none">
									<div className="flex items-center justify-between gap-4 border-b border-border pb-4">
										<div>
											<Dialog.Title className="text-base font-bold text-foreground sm:text-lg">
												Panduan &amp; Rumus Indikator UP/TUP &amp; KKP
											</Dialog.Title>
											<Dialog.Description className="text-xs text-muted-foreground">
												Regulasi PER-5/PB/2024 &amp; Kebijakan Penyesuaian 2026
											</Dialog.Description>
										</div>
										<Dialog.Close asChild>
											<button
												type="button"
												className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-foreground"
											>
												Tutup
											</button>
										</Dialog.Close>
									</div>

									<div className="mt-4 space-y-4 text-xs text-foreground">
										<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
											<p className="font-bold text-primary">
												1. Formula Indikator Utama (Bobot 10% IKPA)
											</p>
											<p className="font-mono text-[11px] text-foreground font-semibold">
												Nilai UP/TUP = (90% × NK Tunai) + (10% × NK KKP)
											</p>
											<p className="text-muted-foreground">
												Kontribusi IKPA = Nilai Akhir Indikator × 10%
											</p>
										</div>

										<div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
											<p className="font-bold text-foreground">
												2. Komponen UP/TUP Tunai (Bobot 90%)
											</p>
											<p className="font-mono text-[11px] text-primary font-semibold">
												NK Tunai = (50% × NK Ketepatan Waktu) + (25% × %GUP Sebulan) + (25% × NK Setoran TUP)
											</p>
											<ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
												<li>
													<strong className="text-foreground">Ketepatan Waktu GUP/PTUP (50%):</strong> Nilai 100 jika SP2D GUP/PTUP diterbitkan ≤ 1 bulan dari SP2D sebelumnya. Nilai 0 jika terlambat.
												</li>
												<li>
													<strong className="text-foreground">%GUP Disebulankan (25%):</strong> %GUP × (Jumlah hari kalender / Selisih hari antar SP2D). Maksimal dinilai 100.
												</li>
												<li>
													<strong className="text-foreground">Kinerja Setoran TUP (25%):</strong> 100 − (%Setoran TUP terhadap Total TUP dalam setahun). Atur TUP seperlunya dengan cermat agar meminimalisasi Setoran TUP di kemudian hari.
												</li>
											</ul>
										</div>

										<div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
											<p className="font-bold text-foreground">
												3. Komponen Penggunaan KKP (Bobot 10%)
											</p>
											<p className="text-muted-foreground">
												Dievaluasi secara kumulatif per triwulan terhadap target tahunan (Plafon Bulanan × 12):
											</p>
											<div className="grid grid-cols-2 gap-2 text-[11px] font-mono sm:grid-cols-4">
												<div className="rounded-lg border border-border bg-background p-2 text-center">
													<p className="font-bold text-primary">TW I</p>
													<p className="text-foreground">1% (Skor 110)</p>
												</div>
												<div className="rounded-lg border border-border bg-background p-2 text-center">
													<p className="font-bold text-primary">TW II</p>
													<p className="text-foreground">5% (Skor 110)</p>
												</div>
												<div className="rounded-lg border border-border bg-background p-2 text-center">
													<p className="font-bold text-primary">TW III</p>
													<p className="text-foreground">9% (Skor 110)</p>
												</div>
												<div className="rounded-lg border border-border bg-background p-2 text-center">
													<p className="font-bold text-primary">TW IV</p>
													<p className="text-foreground">12,5% (Skor 110)</p>
												</div>
											</div>
											<p className="text-[11px] text-muted-foreground">
												* Jika belum ada KKP / belum ada transaksi KKP: diberlakukan konversi 90% Tunai (bukan 100 otomatis).
											</p>
										</div>

										<div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-1.5">
											<div className="flex items-center gap-2 text-warning font-bold">
												<ShieldCheck className="size-4" />
												<span>4. Kebijakan Fairness THR 2026</span>
											</div>
											<p className="text-muted-foreground">
												Untuk transaksi dengan SP2D referensi tanggal <strong className="text-foreground">18 Februari s.d. 17 Maret 2026</strong>, jumlah hari sebulan dihitung menjadi <strong className="text-foreground">7 hari kalender</strong> pada komponen Ketepatan Waktu dan %GUP Disebulankan untuk memberikan fleksibilitas operasional libur nasional/cuti bersama.
											</p>
										</div>
									</div>
								</Dialog.Content>
							</Dialog.Portal>
						</Dialog.Root>
					</div>
				</div>

				{/* Fairness Treatment Banner */}
				<div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs text-foreground shadow-xs">
					<ShieldCheck className="size-4.5 shrink-0 text-primary mt-0.5" />
					<div className="space-y-0.5">
						<p className="font-bold text-primary">
							Kebijakan Penyesuaian Penilaian THR 2026 Aktif
						</p>
						<p className="text-muted-foreground">
							Sesuai ketentuan, transaksi dengan SP2D referensi dalam rentang 18 Februari s.d. 17 Maret 2026 diperlakukan dengan basis 7 hari kalender pada komponen Ketepatan Waktu dan %GUP Disebulankan.
							{thrFairnessTxCount > 0 ? (
								<strong className="ml-1 text-primary">
									({thrFairnessTxCount} transaksi aktual memenuhi kriteria kebijakan).
								</strong>
							) : null}
						</p>
					</div>
				</div>

				{/* Tanpa KKP Notification Banner */}
				{!hasKkp && (
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-xs shadow-xs">
						<div className="flex items-start gap-2.5">
							<AlertCircle className="size-4.5 shrink-0 text-warning mt-0.5" />
							<div className="space-y-0.5">
								<p className="font-bold text-foreground">
									Status Konfigurasi Satker: Tidak Memiliki UP KKP (Maks. Nilai 90,00)
								</p>
								<p className="text-muted-foreground">
									Secara default satker tanpa UP KKP hanya dinilai dari 90% komponen Tunai (Maksimal nilai indikator 90,00 / Kontribusi 9,00 pts). Aktifkan status KKP pada menu konfigurasi jika satker memiliki kartu &amp; plafon KKP untuk membuka peluang nilai 100,00.
								</p>
							</div>
						</div>
						<a
							href="/operator/data/up-tup-kkp"
							className="shrink-0 rounded-lg bg-warning/20 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-warning/30 transition"
						>
							Atur Status KKP →
						</a>
					</div>
				)}

				{/* 4 Top Score Cards (Ponytail Style) */}
				<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					{/* Card 1: Nilai Indikator UP/TUP */}
					<div className="rounded-2xl border-2 border-primary/40 bg-surface p-4 sm:p-5 shadow-xs space-y-1.5">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Nilai Indikator UP/TUP</span>
							<Wallet className="size-4 text-primary" />
						</div>
						<p className="text-2xl font-extrabold text-foreground sm:text-3xl">
							{score.score !== null ? formatNumber(score.score) : "—"}
						</p>
						<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
							<span>Formula {hasKkp ? "Gabungan" : "Tanpa KKP"}</span>
							<span
								className={
									hasKkp
										? "font-semibold text-primary"
										: "font-semibold text-warning"
								}
							>
								{hasKkp ? "90% Tunai + 10% KKP" : "90% Tunai (Maks. 90,00)"}
							</span>
						</div>
					</div>

					{/* Card 2: NK Tunai */}
					<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs space-y-1.5">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">NK Tunai (Bobot 90%)</span>
							<Coins className="size-4 text-foreground" />
						</div>
						<p className="text-2xl font-bold text-foreground sm:text-3xl">
							{score.tunai !== null ? formatNumber(score.tunai) : "—"}
						</p>
						<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
							<span>3 Komponen</span>
							<span className="font-medium text-foreground">50% + 25% + 25%</span>
						</div>
					</div>

					{/* Card 3: NK KKP */}
					<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs space-y-1.5">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">NK KKP (Bobot 10%)</span>
							<CreditCard className="size-4 text-warning" />
						</div>
						<p className="text-2xl font-bold text-foreground sm:text-3xl">
							{hasKkp
								? score.kkp !== null
									? formatNumber(score.kkp)
									: "—"
								: "0,00"}
						</p>
						<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
							<span>{hasKkp ? "Target Triwulanan" : "Status Satker"}</span>
							<span className="font-medium text-foreground">
								{hasKkp ? "1% · 5% · 9% · 12,5%" : "Tanpa UP KKP"}
							</span>
						</div>
					</div>

					{/* Card 4: Kontribusi IKPA */}
					<div className="rounded-2xl border border-success/30 bg-success/5 p-4 sm:p-5 shadow-xs space-y-1.5">
						<div className="flex items-center justify-between text-success font-semibold">
							<span className="text-xs">Kontribusi IKPA (10%)</span>
							<Sparkles className="size-4 text-success" />
						</div>
						<p className="text-2xl font-extrabold text-success sm:text-3xl">
							{score.contribution !== null ? formatNumber(score.contribution) : "—"}
						</p>
						<div className="flex items-center justify-between text-[11px] text-success/80 pt-1 border-t border-success/20 font-medium">
							<span>Poin Tertimbang</span>
							<span>{hasKkp ? "Maks. 10.00 Poin" : "Maks. 9.00 Poin"}</span>
						</div>
					</div>
				</div>

				{/* 3 Rincian Komponen Tunai */}
				<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-sm font-bold text-foreground sm:text-base">
								Rincian 3 Komponen UP/TUP Tunai
							</h2>
							<p className="text-xs text-muted-foreground">
								Struktur pembentuk Nilai Kinerja Tunai (Bobot 90% dari Indikator UP/TUP)
							</p>
						</div>
						<span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-foreground border border-border">
							Total Tunai: {score.tunai !== null ? formatNumber(score.tunai) : "—"}
						</span>
					</div>

					<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
						{/* Subcard 1: Ketepatan Waktu */}
						<div className="rounded-xl border border-border bg-surface p-3.5 space-y-1.5">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-medium">Ketepatan Waktu (50%)</span>
								<Clock className="size-3.5 text-primary" />
							</div>
							<p className="text-xl font-bold text-foreground">
								{score.timeliness !== null ? formatNumber(score.timeliness) : "—"}
							</p>
							<p className="text-[11px] text-muted-foreground">
								GUP/PTUP diterbitkan ≤ 1 bulan dari SP2D referensi asal.
							</p>
						</div>

						{/* Subcard 2: %GUP Disebulankan */}
						<div className="rounded-xl border border-border bg-surface p-3.5 space-y-1.5">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-medium">%GUP Disebulankan (25%)</span>
								<RotateCw className="size-3.5 text-success" />
							</div>
							<p className="text-xl font-bold text-foreground">
								{score.monthlyGup !== null ? formatNumber(score.monthlyGup) : "—"}
							</p>
							<p className="text-[11px] text-muted-foreground">
								Rasio revolving GUP bulanan berbasis nominal dan interval hari.
							</p>
						</div>

						{/* Subcard 3: Kinerja Setoran TUP */}
						<div className="rounded-xl border border-border bg-surface p-3.5 space-y-1.5">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-medium">Kinerja Setoran TUP (25%)</span>
								<Scale className="size-3.5 text-warning" />
							</div>
							<p className="text-xl font-bold text-foreground">
								{score.tupDeposit !== null ? formatNumber(score.tupDeposit) : "—"}
							</p>
							<p className="text-[11px] text-muted-foreground">
								100 − % Setoran Sisa TUP. Nilai maksimal jika seluruh TUP habis terbelanja.
							</p>
						</div>
					</div>
				</div>

				{/* Strip Reminder GUP/PTUP Wajib */}
				<section
					aria-label="Reminder GUP dan PTUP wajib"
					className="space-y-3 rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs"
				>
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Clock className="size-4 text-primary" />
							<h2 className="text-sm font-bold text-foreground sm:text-base">
								Reminder Jatuh Tempo GUP &amp; PTUP
								{urgentCount > 0 ? (
									<span className="ml-2 rounded-full bg-danger/10 px-2.5 py-0.5 text-[11px] font-semibold text-danger">
										{urgentCount} Perlu Perhatian
									</span>
								) : (
									<span className="ml-2 rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success">
										Tepat Waktu
									</span>
								)}
							</h2>
						</div>
						<div className="flex items-center gap-3">
							<a
								href="/operator/reminders"
								className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
							>
								Reminder Center →
							</a>
						</div>
					</div>

					{reminders.length === 0 ? (
						<div className="rounded-xl border border-dashed border-border p-4 text-center">
							<p className="text-xs text-muted-foreground">
								Belum ada transaksi GUP/PTUP. Catat transaksi aktual agar jatuh tempo
								pertanggungjawaban terpantau otomatis.{" "}
								<a
									href="/operator/data/up-tup-kkp"
									className="text-primary font-semibold underline-offset-4 hover:underline"
								>
									Tambah Data UP/TUP
								</a>
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{reminders.map((r) => (
								<div
									key={r.id}
									className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-surface p-3 text-xs"
								>
									<div className="space-y-0.5">
										<p className="font-semibold text-foreground">
											{TYPE_LABELS[r.type] ?? r.type} · {formatRupiah(r.amount)}
										</p>
										<p className="text-muted-foreground text-[11px]">
											SP2D: {formatDateDDMMYYYY(r.sp2dAt)} · {r.detail}
										</p>
									</div>
									<span
										className={
											r.status === "Tepat Waktu"
												? "shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success"
												: r.status === "Terlambat"
													? "shrink-0 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger"
													: "shrink-0 rounded-full bg-yellow-100 dark:bg-yellow-950/40 px-2.5 py-1 text-[11px] font-semibold text-yellow-800 dark:text-yellow-200"
										}
									>
										{r.status}
									</span>
								</div>
							))}
						</div>
					)}
				</section>

				{/* Tabel Objek Transaksi Pembentuk Nilai */}
				<section
					aria-label="Aktual tahun berjalan terkunci"
					className="space-y-3 rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs"
				>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 className="text-sm font-bold text-foreground sm:text-base">
								Objek Transaksi Aktual Pembentuk Nilai · Terkunci 🔒
							</h2>
							<p className="text-xs text-muted-foreground">
								Data transaksi riil tahun anggaran {data.year} s.d. bulan {MONTH_NAMES[currentMonth - 1]}
							</p>
						</div>
						<a
							href="/operator/data/up-tup-kkp"
							className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
						>
							<span>Ubah Data Transaksi</span>
							<ArrowRight className="size-3" />
						</a>
					</div>

					{!hasActual ? (
						<div className="rounded-xl border border-dashed border-border p-6 text-center">
							<p className="text-xs text-muted-foreground">
								Belum ada transaksi UP/TUP/KKP pada database tahun {data.year}.{" "}
								<a
									href="/operator/data/up-tup-kkp"
									className="text-primary font-semibold underline-offset-4 hover:underline"
								>
									Tambah Data Aktual Sekarang
								</a>
							</p>
						</div>
					) : (
						<div className="overflow-x-auto rounded-xl border border-border">
							<table className="w-full min-w-[650px] text-left text-xs">
								<thead className="bg-surface text-muted-foreground border-b border-border">
									<tr>
										<th className="px-3.5 py-2.5 font-semibold">Jenis Transaksi</th>
										<th className="px-3.5 py-2.5 text-right font-semibold">Nominal (Rp)</th>
										<th className="px-3.5 py-2.5 text-center font-semibold">Tanggal SP2D</th>
										<th className="px-3.5 py-2.5 text-center font-semibold">SP2D Asal / Referensi</th>
										<th className="px-3.5 py-2.5 text-center font-semibold">Pertanggungjawaban</th>
										<th className="px-3.5 py-2.5 text-center font-semibold">Status / Policy</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{data.upTupList.map((u) => {
										const isFairness = isThr2026FairnessApplied(u.referenceSp2dAt);
										return (
											<tr key={u.id} className="hover:bg-surface/50 transition">
												<td className="px-3.5 py-2.5 font-semibold text-foreground">
													<div className="flex items-center gap-1.5">
														<span>{TYPE_LABELS[u.type] ?? u.type}</span>
														<span
															aria-label="Terkunci"
															title="Aktual dari database, tak bisa diubah di sini"
															className="text-[10px] text-muted-foreground"
														>
															🔒
														</span>
													</div>
												</td>
												<td className="px-3.5 py-2.5 text-right font-mono font-medium text-foreground">
													{formatRupiah(Number(u.amount) || 0)}
												</td>
												<td className="px-3.5 py-2.5 text-center text-muted-foreground">
													{formatDateDDMMYYYY(u.sp2dAt)}
												</td>
												<td className="px-3.5 py-2.5 text-center text-muted-foreground">
													{u.referenceSp2dAt ? formatDateDDMMYYYY(u.referenceSp2dAt) : "—"}
												</td>
												<td className="px-3.5 py-2.5 text-center text-muted-foreground">
													{u.settlementDate ? formatDateDDMMYYYY(u.settlementDate) : "—"}
												</td>
												<td className="px-3.5 py-2.5 text-center">
													<div className="inline-flex flex-col items-center gap-1">
														<span
															className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
																u.isSettled
																	? "bg-success/10 text-success"
																	: "bg-surface text-muted-foreground border border-border"
															}`}
														>
															{u.isSettled ? "Lunas" : "Berjalan"}
														</span>
														{isFairness ? (
															<span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
																Fairness THR (7 Hari)
															</span>
														) : null}
													</div>
												</td>
											</tr>
										);
									})}
									{data.kkpList.map((k) => (
										<tr key={k.id} className="hover:bg-surface/50 transition bg-surface/20">
											<td className="px-3.5 py-2.5 font-semibold text-foreground">
												<div className="flex items-center gap-1.5">
													<span>Penggunaan KKP {MONTH_NAMES[k.month - 1]}</span>
													<span
														aria-label="Terkunci"
														title="Aktual dari database"
														className="text-[10px] text-muted-foreground"
													>
														🔒
													</span>
												</div>
											</td>
											<td className="px-3.5 py-2.5 text-right font-mono font-medium text-foreground">
												{formatRupiah(Number(k.amount) || 0)}
											</td>
											<td className="px-3.5 py-2.5 text-center text-muted-foreground">
												{k.usageDate ? formatDateDDMMYYYY(k.usageDate) : `Rekap Bulan ${k.month}`}
											</td>
											<td className="px-3.5 py-2.5 text-center text-muted-foreground">—</td>
											<td className="px-3.5 py-2.5 text-center text-muted-foreground">—</td>
											<td className="px-3.5 py-2.5 text-center">
												<span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
													KKP Q{Math.ceil(k.month / 3)}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>

				{/* Panel Simulasi Rencana Sisa Tahun (Preserving Existing Format) */}
				<section
					aria-label="Rencana sisa tahun"
					className="space-y-4 rounded-2xl border border-yellow-300/80 bg-yellow-50/40 dark:bg-yellow-950/20 dark:border-yellow-800/60 p-4 sm:p-5 shadow-xs"
				>
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-yellow-200 dark:border-yellow-900/60 pb-3">
						<div>
							<h2 className="text-sm font-bold text-foreground sm:text-base">
								Simulasi Rencana Sisa Tahun (GUP + KKP) · Interaktif
							</h2>
							<p className="text-xs text-muted-foreground">
								Uji coba skenario pengajuan GUP (nominal, tanggal, frekuensi) dan porsi belanja KKP tanpa mengubah data aktual DB.
							</p>
						</div>

						{assumptions ? (
							<div className="flex items-center gap-2">
								<div className="rounded-lg bg-background px-3 py-1 text-xs border border-border">
									<span className="text-muted-foreground">Dampak Rencana: </span>
									<strong
										className={
											(planDelta ?? 0) >= 0 ? "text-success" : "text-danger"
										}
									>
										{(planDelta ?? 0) >= 0 ? "+" : ""}
										{planDelta !== null ? formatNumber(planDelta) : "0,00"} poin
									</strong>
								</div>
								<button
									type="button"
									onClick={() => setAssumptions(null)}
									className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-foreground transition"
								>
									Reset Simulasi
								</button>
							</div>
						) : (
							<button
								type="button"
								onClick={() =>
									setAssumptions({ ...DEFAULT_UP_TUP_ASSUMPTIONS })
								}
								className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
							>
								<Sparkles className="size-3.5" />
								<span>Mulai Simulasi Rencana</span>
							</button>
						)}
					</div>

					{assumptions ? (
						<UpTupAssumptionPanel
							value={assumptions}
							actualUpTupContrib={actualScore.contribution}
							onChange={setAssumptions}
							onReset={() => setAssumptions(null)}
						/>
					) : (
						<div className="rounded-xl bg-background/60 p-4 text-xs text-muted-foreground border border-yellow-200/60 dark:border-yellow-900/40">
							<p>
								Tekan <strong>Mulai Simulasi Rencana</strong> untuk mengatur asumsi revolving GUP sisa tahun (nominal GUP, selisih hari SP2D, rasio perputaran) serta estimasi tambahan belanja KKP. Hasil nilai akan terproyeksi secara instan di atas data aktual.
							</p>
						</div>
					)}
				</section>

				{/* Tactical Recommendations */}
				<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-xs space-y-3">
					<div className="flex items-center gap-2">
						<TrendingUp className="size-4 text-primary" />
						<h2 className="text-sm font-bold text-foreground">
							Strategi &amp; Rekomendasi Pengendalian UP/TUP
						</h2>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						{recommendations.map((rec, idx) => (
							<div
								key={idx}
								className={`rounded-xl border p-3.5 space-y-1 ${
									rec.type === "warn"
										? "border-danger/30 bg-danger/5 text-danger"
										: rec.type === "good"
											? "border-success/30 bg-success/5 text-success"
											: "border-border bg-background text-foreground"
								}`}
							>
								<div className="flex items-center gap-1.5 font-bold text-xs">
									{rec.type === "warn" ? (
										<AlertCircle className="size-3.5 shrink-0" />
									) : rec.type === "good" ? (
										<CheckCircle2 className="size-3.5 shrink-0" />
									) : (
										<Info className="size-3.5 shrink-0 text-primary" />
									)}
									<span>{rec.title}</span>
								</div>
								<p className="text-[11px] text-muted-foreground leading-relaxed">
									{rec.desc}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>
		</OperatorShell>
	);
}

