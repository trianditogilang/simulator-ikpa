import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, History, Lock } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import {
	type AdminOrgDetail,
	fetchAdminOrganizationDetail,
	fetchAdminOrgSnapshots,
} from "@/services/admin-monitoring-service";

export const Route = createFileRoute("/admin-kppn/organizations/$orgId")({
	loader: async ({ params }) => {
		const [detail, snapshots] = await Promise.all([
			fetchAdminOrganizationDetail(params.orgId),
			fetchAdminOrgSnapshots(params.orgId, 1, 10),
		]);
		return { detail, snapshots };
	},
	component: AdminOrganizationDetailPage,
});

const INDICATOR_META = [
	{ key: "dipa_revision", label: "Revisi DIPA", weight: 10 },
	{ key: "rpd_deviation", label: "Deviasi Hal III", weight: 15 },
	{ key: "budget_absorption", label: "Penyerapan Anggaran", weight: 20 },
	{ key: "contractual", label: "Belanja Kontraktual", weight: 10 },
	{ key: "invoice_timeliness", label: "Penyelesaian Tagihan", weight: 10 },
	{ key: "up_tup", label: "UP/TUP & KKP", weight: 10 },
	{ key: "output_achievement", label: "Capaian Output", weight: 25 },
	{ key: "spm_dispensasi", label: "Dispensasi SPM", weight: 0 },
];

function simTypeLabel(t: string): string {
	if (t === "actual") return "Aktual";
	if (t === "forecast") return "Proyeksi";
	if (t === "scenario") return "Skenario";
	return t;
}

function statusOf(score: number | null): "safe" | "warning" | "danger" | "empty" {
	if (score === null || !Number.isFinite(score)) return "empty";
	if (score < 75) return "danger";
	if (score < 90) return "warning";
	return "safe";
}

function AdminOrganizationDetailPage() {
	const { detail, snapshots } = Route.useLoaderData();
	const org: AdminOrgDetail | null = detail.organization;

	if (!org) {
		return (
			<AdminShell currentPath="/admin-kppn/organizations">
				<div className="rounded-xl border border-dashed border-border/80 bg-surface p-8 text-center text-xs text-muted-foreground">
					Satker tidak ditemukan atau di luar lingkup KPPN Anda.
				</div>
			</AdminShell>
		);
	}

	const snap = org.latestSnapshot;
	const total = snap?.totalScore !== null && snap?.totalScore !== undefined
		? parseFloat(snap.totalScore)
		: null;
	const target = snap?.targetScore !== null && snap?.targetScore !== undefined
		? parseFloat(snap.targetScore)
		: null;
	const gap = total !== null && target !== null ? total - target : null;
	const status = statusOf(total);
	const rowsByKey = new Map((snap?.indicators ?? []).map((r) => [r.key, r]));
	const latestYear = org.fiscalYears.length > 0
		? Math.max(...org.fiscalYears.map((f) => f.year))
		: null;

	return (
		<AdminShell currentPath="/admin-kppn/organizations">
			<div className="space-y-6">
				{/* Top Bar */}
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
								{org.kodeSatker}
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
				</div>

				{/* Scope & Context Banner */}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-3.5 text-xs">
					<div className="flex flex-wrap items-center gap-3 text-muted-foreground">
						<span>
							KPPN Pembina:{" "}
							<strong className="text-foreground">{org.kppnName}</strong>
						</span>
						<span>•</span>
						<span>
							Tahun Anggaran:{" "}
							<strong className="text-foreground">{latestYear ?? "—"}</strong>
						</span>
						<span>•</span>
						<span>
							Rule Set:{" "}
							<strong className="text-foreground">
								{snap?.ruleSetVersion ?? "—"}
							</strong>
						</span>
						<span>•</span>
						<span>
							Sumber:{" "}
							<strong className="text-foreground">
								{snap ? simTypeLabel(snap.simType) : "Kosong"}
							</strong>
						</span>
					</div>
				</div>

				{/* KPI Cards */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
						<span className="text-xs font-semibold text-muted-foreground">
							Skor IKPA Aktual
						</span>
						<div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
							{total !== null ? total.toFixed(2).replace(".", ",") : "—"}
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Dari batas maksimal 100,00 poin
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
						<span className="text-xs font-semibold text-muted-foreground">
							Target Simulasi
						</span>
						<div className="mt-2 text-3xl font-semibold tracking-tight text-primary">
							{target !== null ? target.toFixed(2).replace(".", ",") : "—"}
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							{snap ? snap.simName : "Belum ada snapshot"}
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
						<span className="text-xs font-semibold text-muted-foreground">
							Selisih / Gap Target
						</span>
						<div
							className={`mt-2 text-3xl font-semibold tracking-tight ${
								gap !== null && gap < 0 ? "text-danger" : "text-success"
							}`}
						>
							{gap !== null ? gap.toFixed(2).replace(".", ",") : "—"}
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							{gap !== null
								? gap < 0
									? "Perlu percepatan perbaikan"
									: "Di atas target"
								: "Menunggu data snapshot"}
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
						<span className="text-xs font-semibold text-muted-foreground">
							Status Kinerja
						</span>
						<div className="mt-2 flex items-center gap-2">
							<span
								className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
									status === "danger"
										? "bg-danger/10 text-danger"
										: status === "warning"
											? "bg-warning/10 text-warning"
											: status === "safe"
												? "bg-success/10 text-success"
												: "bg-surface-muted text-muted-foreground"
								}`}
							>
								{status === "danger"
									? "Risiko Tinggi / Kritis"
									: status === "warning"
										? "Perlu Perhatian"
										: status === "safe"
											? "Kinerja Baik"
											: "Belum ada data"}
							</span>
						</div>
						<p className="mt-2 text-xs text-muted-foreground line-clamp-2">
							Kelengkapan arsip: {org.completeness}
						</p>
					</div>
				</div>

				{/* 8 Indicators Grid */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-semibold text-foreground sm:text-base">
							Rincian 8 Indikator IKPA (PER-5/PB/2024)
						</h2>
						<span className="text-xs text-muted-foreground">
							Total Bobot: 100%
						</span>
					</div>

					<div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
						{INDICATOR_META.map((meta) => {
							const row = rowsByKey.get(meta.key);
							const raw = row?.rawScore ?? null;
							const contrib = row?.contrib ?? null;
							const st = statusOf(raw);
							return (
								<div
									key={meta.key}
									className="flex flex-col justify-between rounded-xl border border-border/80 bg-surface p-4 shadow-xs"
								>
									<div className="space-y-2">
										<div className="flex items-start justify-between gap-2">
											<h3 className="text-xs font-semibold text-foreground">
												{meta.label}
											</h3>
											<span
												className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
													st === "safe"
														? "bg-success/10 text-success"
														: st === "warning"
															? "bg-warning/10 text-warning"
															: st === "danger"
																? "bg-danger/10 text-danger"
																: "bg-surface-muted text-muted-foreground"
												}`}
											>
												{st === "safe"
													? "Baik"
													: st === "warning"
														? "Perhatian"
														: st === "danger"
															? "Kritis"
															: "Kosong"}
											</span>
										</div>

										<div className="flex items-baseline justify-between">
											<span className="text-xl font-semibold tracking-tight text-foreground">
												{raw !== null ? raw.toFixed(2).replace(".", ",") : "—"}
											</span>
											<span className="text-xs text-muted-foreground">
												Bobot: {meta.weight > 0 ? `${meta.weight}%` : "pengurang"} (
												{contrib !== null
													? contrib.toFixed(2).replace(".", ",")
													: "—"}{" "}
												poin)
											</span>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Snapshot History (read-only) */}
				<div className="space-y-3 rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-2">
						<History className="size-4 text-primary" />
						<h3 className="text-sm font-semibold text-foreground">
							Riwayat Snapshot ({snapshots.totalItems})
						</h3>
					</div>
					{snapshots.items.length === 0 ? (
						<p className="text-xs text-muted-foreground">
							Belum ada snapshot untuk satker ini.
						</p>
					) : (
						<div className="space-y-2">
							{snapshots.items.map((s) => (
								<div
									key={s.id}
									className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3 text-xs"
								>
									<div>
										<span className="font-semibold text-foreground">
											{s.simName}
										</span>
										<div className="flex items-center gap-2 text-muted-foreground">
											<span>Tipe: {simTypeLabel(s.simType)}</span>
											<span>•</span>
											<span>
												Dibuat: {s.createdAt ? s.createdAt.slice(0, 10) : "—"}
											</span>
											<span>•</span>
											<span>Rule Set: {s.ruleSetVersion}</span>
										</div>
									</div>
									<div className="text-right">
										<div className="font-semibold text-foreground text-sm">
											Skor:{" "}
											{s.totalScore !== null && s.totalScore !== undefined
												? parseFloat(s.totalScore).toFixed(2).replace(".", ",")
												: "—"}
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</AdminShell>
	);
}
