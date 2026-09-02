import { createFileRoute } from "@tanstack/react-router";
import { LineChart, Sparkles } from "lucide-react";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatPointDelta } from "@/lib/format";
import { fetchOperatorDashboard } from "@/services/dashboard-service";

export const Route = createFileRoute("/operator/analysis")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchOperatorDashboard(activeOrgId);
	},
	component: OperatorAnalysisPage,
});

function OperatorAnalysisPage() {
	const dashboardData = Route.useLoaderData();
	const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

	const markReviewed = (id: string) => {
		setReviewedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const recommendations = dashboardData.priorityActions;

	return (
		<OperatorShell currentPath="/operator/analysis">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<LineChart className="size-5" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-foreground sm:text-xl">
								Analisis Kinerja &amp; Rekomendasi Tindakan
							</h1>
							<p className="text-xs text-muted-foreground">
								Prioritas rekomendasi berbasis perhitungan weight × gap ×
								urgensi untuk memaksimalkan kenaikan nilai IKPA satker.
							</p>
						</div>
					</div>
					<div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-right">
						<span className="text-[11px] text-muted-foreground">
							Total Rekomendasi
						</span>
						<p className="text-base font-bold text-primary">
							{recommendations.length} Tindakan
						</p>
					</div>
				</div>

				<div className="space-y-3">
					{recommendations.length === 0 ? (
						<div className="rounded-2xl border border-border bg-background p-8 text-center space-y-2">
							<Sparkles className="size-8 text-success mx-auto" />
							<h3 className="text-sm font-bold text-foreground">
								Kinerja IKPA Berada pada Kategori Sangat Baik!
							</h3>
							<p className="text-xs text-muted-foreground max-w-md mx-auto">
								Seluruh indikator telah mencapai nilai optimal di atas target.
								Pertahankan ritme pengelolaan anggaran dan kepatuhan transaksi.
							</p>
						</div>
					) : (
						recommendations.map((item, index) => {
							const isReviewed = reviewedIds.has(item.id);
							const isHigh = item.urgency === "high";

							return (
								<div
									key={item.id}
									className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 shadow-xs transition sm:flex-row sm:items-center ${
										isHigh
											? "border-warning/40 bg-warning/[0.02]"
											: "border-border bg-background"
									}`}
								>
									<div className="space-y-1.5">
										<div className="flex items-center gap-2">
											<span
												className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
													isHigh
														? "bg-warning/20 text-warning"
														: "bg-surface text-foreground"
												}`}
											>
												Prioritas {index + 1} ({item.urgencyLabel})
											</span>
											<span className="text-xs font-semibold text-primary">
												{item.indicatorName}
											</span>
											<span className="text-xs text-muted-foreground">·</span>
											<span className="text-xs text-muted-foreground">
												Tenggat: {item.deadlineDays} Hari Lagi ({item.deadlineDate})
											</span>
										</div>

										<h3 className="text-sm font-bold text-foreground sm:text-base">
											{item.title}
										</h3>
										<p className="text-xs text-muted-foreground">
											Lakukan penyesuaian data pada modul {item.domain} sebelum
											batas waktu penilaian.
										</p>

										<div className="pt-1">
											<span className="text-xs font-semibold text-success">
												Potensi Peningkatan Nilai:{" "}
												{formatPointDelta(item.impactPoints)}
											</span>
										</div>
									</div>

									<div className="flex shrink-0 items-center gap-2">
										<button
											type="button"
											onClick={() => markReviewed(item.id)}
											className={`rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition ${
												isReviewed
													? "bg-success/10 text-success border-success/30"
													: "bg-background text-foreground hover:bg-surface-muted"
											}`}
										>
											{isReviewed ? "✓ Telah Direview" : "Tandai Selesai"}
										</button>

										<button
											type="button"
											onClick={() => {
												window.location.href = item.route;
											}}
											className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
										>
											Tindak Lanjuti
										</button>
									</div>
								</div>
							);
						})
					)}
				</div>
			</div>
		</OperatorShell>
	);
}
