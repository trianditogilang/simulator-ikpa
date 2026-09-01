import {
	AlertTriangle,
	ArrowRight,
	Building2,
	Calendar,
	CheckCircle2,
	Clock,
	FileText,
	MailWarning,
	ShieldAlert,
} from "lucide-react";
import type {
	AdminAggregateTrendItem,
	AdminKpiOverview,
	AdminPolicyStatus,
	AdminUpcomingDeadlinesItem,
	RiskySatkerItem,
} from "@/mocks/admin-dashboard";

interface RiskOverviewProps {
	kpi: AdminKpiOverview;
	riskySatkers: RiskySatkerItem[];
	upcomingDeadlines: AdminUpcomingDeadlinesItem[];
	policyStatus: AdminPolicyStatus;
	monthlyTrend: AdminAggregateTrendItem[];
}

export function AdminKpiCards({ kpi }: { kpi: AdminKpiOverview }) {
	const gap = kpi.averageScore > 0 ? kpi.averageScore - kpi.targetScore : 0;
	const isNegativeGap = gap < 0;

	return (
		<div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
			{/* Rata-rata IKPA */}
			<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold text-muted-foreground">
						Rata-rata IKPA
					</span>
					<Building2 className="size-4 text-primary" />
				</div>
				<div className="mt-2 flex items-baseline gap-2">
					<span className="text-2xl font-semibold tracking-tight text-foreground">
						{kpi.averageScore > 0 ? kpi.averageScore.toFixed(2).replace(".", ",") : "—"}
					</span>
					<span className="text-xs text-muted-foreground">
						/ {kpi.targetScore.toFixed(2).replace(".", ",")}
					</span>
				</div>
				<p
					className={`mt-1 text-xs font-medium ${
						isNegativeGap ? "text-danger" : "text-success"
					}`}
				>
					{isNegativeGap
						? `Gap ${gap.toFixed(2).replace(".", ",")} poin`
						: `Melampaui target +${gap.toFixed(2).replace(".", ",")}`}
				</p>
			</div>

			{/* Satker Berisiko */}
			<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold text-muted-foreground">
						Satker Berisiko
					</span>
					<ShieldAlert className="size-4 text-danger" />
				</div>
				<div className="mt-2 flex items-baseline gap-2">
					<span className="text-2xl font-semibold tracking-tight text-danger">
						{kpi.riskyCount}
					</span>
					<span className="text-xs text-muted-foreground">
						/ {kpi.totalOrganizations} satker
					</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground">Skor &lt; 90 atau deviasi tinggi</p>
			</div>

			{/* Data Belum Lengkap */}
			<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold text-muted-foreground">
						Data Belum Lengkap
					</span>
					<AlertTriangle className="size-4 text-warning" />
				</div>
				<div className="mt-2 flex items-baseline gap-2">
					<span className="text-2xl font-semibold tracking-tight text-warning">
						{kpi.incompleteDataCount}
					</span>
					<span className="text-xs text-muted-foreground">satker</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground">Memerlukan input operator</p>
			</div>

			{/* Deadline < 7 Hari */}
			<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold text-muted-foreground">
						Deadline &lt; 7 Hari
					</span>
					<Clock className="size-4 text-primary" />
				</div>
				<div className="mt-2 flex items-baseline gap-2">
					<span className="text-2xl font-semibold tracking-tight text-foreground">
						{kpi.deadlinesUpcomingCount}
					</span>
					<span className="text-xs text-muted-foreground">agenda</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground">Tagihan, RO, & UP/TUP</p>
			</div>

			{/* Delivery Gagal */}
			<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold text-muted-foreground">
						Delivery Reminder
					</span>
					<MailWarning
						className={`size-4 ${kpi.failedDeliveriesCount > 0 ? "text-danger" : "text-success"}`}
					/>
				</div>
				<div className="mt-2 flex items-baseline gap-2">
					<span
						className={`text-2xl font-semibold tracking-tight ${
							kpi.failedDeliveriesCount > 0 ? "text-danger" : "text-success"
						}`}
					>
						{kpi.failedDeliveriesCount}
					</span>
					<span className="text-xs text-muted-foreground">gagal kirim</span>
				</div>
				<p className="mt-1 text-xs text-muted-foreground">
					{kpi.failedDeliveriesCount > 0 ? "Perlu kirim ulang" : "Semua notifikasi terkirim"}
				</p>
			</div>
		</div>
	);
}

export function RiskySatkerList({ satkers }: { satkers: RiskySatkerItem[] }) {
	if (satkers.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface p-8 text-center">
				<CheckCircle2 className="size-8 text-success" />
				<h4 className="mt-2 text-sm font-semibold text-foreground">
					Tidak Ada Satker Berisiko Kritis
				</h4>
				<p className="mt-1 max-w-sm text-xs text-muted-foreground">
					Semua satker dalam cakupan KPPN berada di atas batas aman target kinerja IKPA.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{satkers.map((satker) => (
				<div
					key={satker.id}
					className="flex flex-col justify-between gap-3 rounded-xl border border-border/80 bg-surface p-4 transition-all hover:border-primary/40 hover:shadow-xs sm:flex-row sm:items-center"
				>
					<div className="space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
								{satker.code}
							</span>
							<h4 className="text-sm font-semibold text-foreground">{satker.name}</h4>
							<span
								className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
									satker.riskLevel === "danger"
										? "bg-danger/10 text-danger"
										: "bg-warning/10 text-warning"
								}`}
							>
								{satker.primaryIndicator}
							</span>
						</div>
						<p className="text-xs text-muted-foreground">
							Faktor Risiko: <span className="text-foreground">{satker.mainRisk}</span>
						</p>
					</div>

					<div className="flex items-center justify-between gap-4 sm:justify-end">
						<div className="text-left sm:text-right">
							<div className="text-sm font-semibold text-danger">
								IKPA {satker.score.toFixed(2).replace(".", ",")}
							</div>
							<div className="text-xs text-muted-foreground">
								Gap {satker.gap.toFixed(2).replace(".", ",")}
							</div>
						</div>
						<a
							href={satker.route}
							className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
						>
							<span>Detail</span>
							<ArrowRight className="size-3.5" />
						</a>
					</div>
				</div>
			))}
		</div>
	);
}

export function UpcomingDeadlinesPanel({
	deadlines,
}: {
	deadlines: AdminUpcomingDeadlinesItem[];
}) {
	if (deadlines.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface p-8 text-center">
				<Calendar className="size-8 text-muted-foreground" />
				<h4 className="mt-2 text-sm font-semibold text-foreground">
					Tidak Ada Deadline Mendekati
				</h4>
				<p className="mt-1 text-xs text-muted-foreground">
					Tidak ada agenda satker yang jatuh tempo dalam 7 hari kerja ke depan.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{deadlines.map((dl) => (
				<div
					key={dl.id}
					className={`rounded-xl border p-3.5 transition-all ${
						dl.isUrgent
							? "border-danger/40 bg-danger/5"
							: "border-border/80 bg-surface hover:border-primary/40"
					}`}
				>
					<div className="flex items-start justify-between gap-2">
						<div className="space-y-1">
							<div className="flex items-center gap-2">
								<span className="text-xs font-semibold text-foreground">
									{dl.satkerName}
								</span>
								<span className="text-[11px] text-muted-foreground">({dl.satkerCode})</span>
							</div>
							<p className="text-xs text-foreground/90">{dl.eventTitle}</p>
						</div>
						<span
							className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
								dl.workDaysLeft <= 2
									? "bg-danger/10 text-danger"
									: "bg-warning/10 text-warning"
							}`}
						>
							H-{dl.workDaysLeft} kerja
						</span>
					</div>
					<div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
						<span>Jatuh tempo: {dl.dueDate}</span>
						<a
							href={dl.route}
							className="font-semibold text-primary underline-offset-4 hover:underline"
						>
							Periksa →
						</a>
					</div>
				</div>
			))}
		</div>
	);
}

export function AdminTrendChart({ trend }: { trend: AdminAggregateTrendItem[] }) {
	if (trend.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface text-xs text-muted-foreground">
				Data tren belum tersedia untuk periode ini.
			</div>
		);
	}

	return (
		<div className="space-y-4 rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-semibold text-foreground">
						Tren Agregat IKPA KPPN (Jan - Agu 2026)
					</h3>
					<p className="text-xs text-muted-foreground">
						Rata-rata capaian seluruh satker terhadap target 95,00
					</p>
				</div>
				<span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
					Target KPPN: 95,00
				</span>
			</div>

			{/* Simple Bar-like visualization */}
			<div className="grid grid-cols-8 gap-2 pt-4">
				{trend.map((item) => {
					const heightPct = Math.max(10, Math.min(100, (item.averageScore / 100) * 100));
					const isTargetAchieved = item.averageScore >= item.target;

					return (
						<div key={item.month} className="flex flex-col items-center gap-1.5">
							<span className="text-[11px] font-semibold text-foreground">
								{item.averageScore.toFixed(1).replace(".", ",")}
							</span>
							<div className="flex h-28 w-full items-end justify-center rounded-md bg-surface-muted p-1">
								<div
									style={{ height: `${heightPct}%` }}
									className={`w-full rounded-sm transition-all ${
										isTargetAchieved ? "bg-success" : "bg-primary"
									}`}
								/>
							</div>
							<span className="text-xs font-medium text-muted-foreground">{item.month}</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function PolicyStatusCard({ policy }: { policy: AdminPolicyStatus }) {
	return (
		<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<FileText className="size-4 text-primary" />
						<h3 className="text-sm font-semibold text-foreground">
							Status Rule Set IKPA
						</h3>
					</div>
					<p className="text-xs text-muted-foreground">
						Regulasi dan formula kalkulasi yang aktif di lingkup KPPN
					</p>
				</div>
				<span
					className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
						policy.status === "published"
							? "bg-success/10 text-success"
							: "bg-warning/10 text-warning"
					}`}
				>
					{policy.status === "published" ? "Published ✓" : "Draft"}
				</span>
			</div>

			<div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-3.5 text-xs">
				<div>
					<span className="text-muted-foreground">Versi Aktif:</span>
					<p className="font-semibold text-foreground">{policy.currentVersion}</p>
				</div>
				<div>
					<span className="text-muted-foreground">Berlaku Sejak:</span>
					<p className="font-semibold text-foreground">{policy.effectiveFrom}</p>
				</div>
				<div className="col-span-2">
					<span className="text-muted-foreground">Dasar Regulasi:</span>
					<p className="font-semibold text-foreground">{policy.sourceRegulation}</p>
				</div>
				{policy.changeSummary && (
					<div className="col-span-2 rounded-lg bg-warning/10 p-2.5 text-xs text-warning">
						<span className="font-semibold">Catatan Draft Perubahan:</span>
						<p className="mt-0.5 text-foreground">{policy.changeSummary}</p>
					</div>
				)}
			</div>

			<div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
				<span className="text-xs text-muted-foreground">Pengaturan Kebijakan</span>
				<a
					href="/admin-kppn/policy/rule-sets"
					className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
				>
					<span>Kelola Rule Set</span>
					<ArrowRight className="size-3.5" />
				</a>
			</div>
		</div>
	);
}

export function RiskOverview({
	kpi,
	riskySatkers,
	upcomingDeadlines,
	policyStatus,
	monthlyTrend,
}: RiskOverviewProps) {
	return (
		<div className="space-y-6">
			<AdminKpiCards kpi={kpi} />
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
				<div className="space-y-4 lg:col-span-7">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<ShieldAlert className="size-4 text-danger" />
							<h3 className="text-sm font-semibold text-foreground">
								Satker Berisiko Prioritas
							</h3>
						</div>
						<a
							href="/admin-kppn/organizations"
							className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
						>
							Lihat Semua Satker →
						</a>
					</div>
					<RiskySatkerList satkers={riskySatkers} />
				</div>

				<div className="space-y-4 lg:col-span-5">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Clock className="size-4 text-primary" />
							<h3 className="text-sm font-semibold text-foreground">
								Deadline &amp; Delivery Monitoring
							</h3>
						</div>
						<a
							href="/admin-kppn/monitoring/reminders"
							className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
						>
							Lihat Agenda →
						</a>
					</div>
					<UpcomingDeadlinesPanel deadlines={upcomingDeadlines} />
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
				<div className="lg:col-span-7">
					<AdminTrendChart trend={monthlyTrend} />
				</div>
				<div className="lg:col-span-5">
					<PolicyStatusCard policy={policyStatus} />
				</div>
			</div>
		</div>
	);
}
