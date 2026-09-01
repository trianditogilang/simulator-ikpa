import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getMockAdminOrganizationDetail } from "@/mocks/admin-organization-detail";
import {
	ArrowLeft,
	Download,
	Lock,
	Clock,
	CheckCircle2,
	TrendingUp,
	History,
	Bell,
	FileCode,
	Users,
} from "lucide-react";

export const Route = createFileRoute("/admin-kppn/organizations/$orgId")({
	component: AdminOrganizationDetailPage,
});

function AdminOrganizationDetailPage() {
	const { orgId } = Route.useParams();
	const org = getMockAdminOrganizationDetail(orgId);

	const [activeTab, setActiveTab] = useState<"trend" | "snapshots" | "reminders" | "audit">(
		"trend",
	);

	return (
		<AdminShell currentPath="/admin-kppn/organizations">
			<div className="space-y-6">
				{/* Top Bar: Back Link, Satker Name, Read-Only Badge, Export Action */}
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<a
							href="/admin-kppn/organizations"
							className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline"
						>
							<ArrowLeft className="size-3.5" />
							<span>Kembali ke Daftar Satker</span>
						</a>
						<div className="flex flex-wrap items-center gap-2 pt-1">
							<span className="rounded bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground">
								{org.code}
							</span>
							<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
								{org.name}
							</h1>
							{org.isBlu && (
								<span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
									BLU
								</span>
							)}
							<span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
								<Lock className="size-3 text-muted-foreground" />
								<span>Read-only Mode</span>
							</span>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								alert(`Mengekspor laporan evaluasi detail untuk ${org.name} (PDF)...`);
							}}
							className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs"
						>
							<Download className="size-3.5" />
							<span>Ekspor Detail (PDF)</span>
						</button>
					</div>
				</div>

				{/* Scope & Context Banner */}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-3.5 text-xs">
					<div className="flex flex-wrap items-center gap-3 text-muted-foreground">
						<span>
							KPPN Pembina: <strong className="text-foreground">{org.kppnName} ({org.kppnCode})</strong>
						</span>
						<span>•</span>
						<span>
							Tahun Anggaran: <strong className="text-foreground">{org.fiscalYear}</strong>
						</span>
						<span>•</span>
						<span>
							Periode: <strong className="text-foreground">Agustus (Bulan 8)</strong>
						</span>
						<span>•</span>
						<span>
							Rule Set: <strong className="text-foreground">{org.ruleSetVersion}</strong>
						</span>
					</div>
					<div className="text-muted-foreground">
						Data diperbarui: <span className="text-foreground font-medium">{org.lastUpdated}</span>
					</div>
				</div>

				{/* KPI Cards: Total Score, Target, Gap, Risk Level */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
						<span className="text-xs font-semibold text-muted-foreground">
							Skor IKPA Aktual
						</span>
						<div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
							{org.totalScore.toFixed(2).replace(".", ",")}
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Dari batas maksimal 100,00 poin
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
						<span className="text-xs font-semibold text-muted-foreground">
							Target Nasional IKPA
						</span>
						<div className="mt-2 text-3xl font-semibold tracking-tight text-primary">
							{org.targetScore.toFixed(2).replace(".", ",")}
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Target standar Kemenkeu 2026
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
						<span className="text-xs font-semibold text-muted-foreground">
							Selisih / Gap Target
						</span>
						<div
							className={`mt-2 text-3xl font-semibold tracking-tight ${
								org.gapScore < 0 ? "text-danger" : "text-success"
							}`}
						>
							{org.gapScore.toFixed(2).replace(".", ",")}
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							{org.gapScore < 0 ? "Perlu percepatan perbaikan" : "Di atas target"}
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
						<span className="text-xs font-semibold text-muted-foreground">
							Status Kinerja &amp; Risiko
						</span>
						<div className="mt-2 flex items-center gap-2">
							<span
								className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
									org.riskLevel === "danger"
										? "bg-danger/10 text-danger"
										: org.riskLevel === "warning"
											? "bg-warning/10 text-warning"
											: "bg-success/10 text-success"
								}`}
							>
								{org.riskLevel === "danger"
									? "Risiko Tinggi / Kritis"
									: org.riskLevel === "warning"
										? "Perlu Perhatian"
										: "Kinerja Baik"}
							</span>
						</div>
						<p className="mt-2 text-xs text-muted-foreground line-clamp-2">
							{org.riskSummary}
						</p>
					</div>
				</div>

				{/* 8 Indicators Grid */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-semibold text-foreground sm:text-base">
							Rincian 8 Indikator IKPA (PER-5/PB/2024)
						</h2>
						<span className="text-xs text-muted-foreground">Total Bobot: 100%</span>
					</div>

					<div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
						{org.indicators.map((ind) => (
							<div
								key={ind.id}
								className="flex flex-col justify-between rounded-xl border border-border/80 bg-surface p-4 shadow-xs"
							>
								<div className="space-y-2">
									<div className="flex items-start justify-between gap-2">
										<h3 className="text-xs font-semibold text-foreground">
											{ind.name}
										</h3>
										<span
											className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
												ind.status === "complete"
													? "bg-success/10 text-success"
													: ind.status === "warning"
														? "bg-warning/10 text-warning"
														: "bg-danger/10 text-danger"
											}`}
										>
											{ind.statusLabel}
										</span>
									</div>

									<div className="flex items-baseline justify-between">
										<span className="text-xl font-semibold tracking-tight text-foreground">
											{ind.rawScore.toFixed(2).replace(".", ",")}
										</span>
										<span className="text-xs text-muted-foreground">
											Bobot: {ind.weight}% ({ind.weightedScore.toFixed(2).replace(".", ",")} poin)
										</span>
									</div>

									<p className="text-xs text-muted-foreground line-clamp-2">
										{ind.summary}
									</p>
								</div>

								{ind.warnings.length > 0 && (
									<div className="mt-3 rounded-md bg-danger/5 p-2 text-[11px] text-danger border border-danger/20">
										{ind.warnings[0]}
									</div>
								)}
							</div>
						))}
					</div>
				</div>

				{/* 2 Middle Columns: Risiko & Deadline vs Kelengkapan Data */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
					{/* Left: Risiko & Deadline Satker */}
					<div className="space-y-3 rounded-xl border border-border/80 bg-surface p-5 shadow-xs lg:col-span-6">
						<div className="flex items-center gap-2">
							<Clock className="size-4 text-primary" />
							<h3 className="text-sm font-semibold text-foreground">
								Agenda &amp; Deadline Terdekat Satker
							</h3>
						</div>
						<div className="space-y-2.5 pt-2">
							{org.risksAndDeadlines.map((rd) => (
								<div
									key={rd.id}
									className={`rounded-lg border p-3 text-xs ${
										rd.severity === "danger"
											? "border-danger/30 bg-danger/5"
											: "border-border/80 bg-background"
									}`}
								>
									<div className="flex items-start justify-between gap-2">
										<div className="space-y-0.5">
											<span className="font-semibold text-foreground">
												{rd.title}
											</span>
											<p className="text-muted-foreground">{rd.event}</p>
										</div>
										<span
											className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
												rd.workDaysLeft <= 2
													? "bg-danger text-primary-foreground"
													: "bg-warning/10 text-warning"
											}`}
										>
											H-{rd.workDaysLeft} kerja
										</span>
									</div>
									<div className="mt-2 text-[11px] text-muted-foreground">
										Jatuh tempo: <strong className="text-foreground">{rd.deadline}</strong>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Right: Kelengkapan Data */}
					<div className="space-y-3 rounded-xl border border-border/80 bg-surface p-5 shadow-xs lg:col-span-6">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="size-4 text-primary" />
							<h3 className="text-sm font-semibold text-foreground">
								Status Kelengkapan Data Operasional
							</h3>
						</div>
						<div className="space-y-2 pt-2">
							{org.completeness.map((comp) => (
								<div
									key={comp.domain}
									className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-2.5 text-xs"
								>
									<div>
										<span className="font-semibold text-foreground">{comp.domain}</span>
										<p className="text-[11px] text-muted-foreground">{comp.details}</p>
									</div>
									<span
										className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
											comp.isComplete
												? "bg-success/10 text-success"
												: "bg-danger/10 text-danger"
										}`}
									>
										{comp.label}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>

				{/* Operators Info Banner */}
				<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
					<div className="flex items-center gap-2 text-xs font-semibold text-foreground">
						<Users className="size-4 text-primary" />
						<span>Operator Satker Terdaftar ({org.operators.length} Pengguna)</span>
					</div>
					<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
						{org.operators.map((op) => (
							<div
								key={op.email}
								className="rounded-lg border border-border/60 bg-background p-3 text-xs"
							>
								<p className="font-semibold text-foreground">{op.name}</p>
								<p className="text-muted-foreground">{op.email}</p>
								<div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
									<span>{op.role}</span>
									<span>Aktif: {op.lastActive}</span>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Bottom Tabs: Tren, Snapshot, Reminder, Audit Relevan */}
				<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
					{/* Tab Buttons */}
					<div className="flex flex-wrap items-center gap-1 border-b border-border/80 pb-3">
						<button
							type="button"
							onClick={() => setActiveTab("trend")}
							className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
								activeTab === "trend"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
							}`}
						>
							<TrendingUp className="size-3.5" />
							<span>Tren Skor Bulanan</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("snapshots")}
							className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
								activeTab === "snapshots"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
							}`}
						>
							<History className="size-3.5" />
							<span>Snapshot Simulasi ({org.snapshots.length})</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("reminders")}
							className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
								activeTab === "reminders"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
							}`}
						>
							<Bell className="size-3.5" />
							<span>Jadwal Reminder ({org.reminders.length})</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("audit")}
							className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
								activeTab === "audit"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
							}`}
						>
							<FileCode className="size-3.5" />
							<span>Audit Log Aktivitas ({org.auditLogs.length})</span>
						</button>
					</div>

					{/* Tab Content */}
					<div className="pt-4">
						{activeTab === "trend" && (
							<div className="space-y-4">
								<p className="text-xs text-muted-foreground">
									Histori nilai IKPA bulanan satker dibandingkan dengan target Kemenkeu 95,00
								</p>
								<div className="grid grid-cols-8 gap-2 pt-2">
									{org.trend.map((item) => (
										<div key={item.month} className="flex flex-col items-center gap-1.5">
											<span className="text-xs font-semibold text-foreground">
												{item.score.toFixed(1).replace(".", ",")}
											</span>
											<div className="flex h-28 w-full items-end justify-center rounded-md bg-surface-muted p-1">
												<div
													style={{
														height: `${Math.max(15, Math.min(100, item.score))}%`,
													}}
													className={`w-full rounded-sm ${
														item.score >= item.target ? "bg-success" : "bg-danger"
													}`}
												/>
											</div>
											<span className="text-xs text-muted-foreground">{item.month}</span>
										</div>
									))}
								</div>
							</div>
						)}

						{activeTab === "snapshots" && (
							<div className="space-y-2">
								{org.snapshots.map((snap) => (
									<div
										key={snap.id}
										className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3 text-xs"
									>
										<div>
											<span className="font-semibold text-foreground">{snap.name}</span>
											<div className="flex items-center gap-2 text-muted-foreground">
												<span>Tipe: {snap.type}</span>
												<span>•</span>
												<span>Dibuat: {snap.createdAt}</span>
												<span>•</span>
												<span>Rule Set: {snap.ruleSet}</span>
											</div>
										</div>
										<div className="text-right">
											<div className="font-semibold text-foreground text-sm">
												Skor: {snap.totalScore.toFixed(2).replace(".", ",")}
											</div>
										</div>
									</div>
								))}
							</div>
						)}

						{activeTab === "reminders" && (
							<div className="space-y-2">
								{org.reminders.map((rem) => (
									<div
										key={rem.id}
										className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3 text-xs"
									>
										<div>
											<span className="font-semibold text-foreground">{rem.event}</span>
											<p className="text-muted-foreground">
												Penerima: {rem.recipient} • Jadwal: {rem.scheduledFor}
											</p>
										</div>
										<span
											className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
												rem.status === "sent"
													? "bg-success/10 text-success"
													: rem.status === "scheduled"
														? "bg-primary/10 text-primary"
														: "bg-danger/10 text-danger"
											}`}
										>
											{rem.status === "sent"
												? "Terkirim"
												: rem.status === "scheduled"
													? "Terjadwal"
													: "Gagal"}
										</span>
									</div>
								))}
							</div>
						)}

						{activeTab === "audit" && (
							<div className="space-y-2">
								{org.auditLogs.map((aud) => (
									<div
										key={aud.id}
										className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3 text-xs"
									>
										<div>
											<div className="flex items-center gap-2">
												<span className="font-semibold text-foreground">{aud.actor}</span>
												<span className="rounded bg-surface-muted px-1.5 py-0.2 text-[10px] font-semibold uppercase text-muted-foreground">
													{aud.action}
												</span>
											</div>
											<p className="mt-0.5 text-foreground/80">{aud.summary}</p>
										</div>
										<span className="text-muted-foreground">{aud.timestamp}</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</AdminShell>
	);
}
