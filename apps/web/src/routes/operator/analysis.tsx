import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { mockAnalysisList, type AnalysisItem } from "@/mocks/analysis";
import { formatPointDelta } from "@/lib/format";

export const Route = createFileRoute("/operator/analysis")({
	component: OperatorAnalysisPage,
});

function OperatorAnalysisPage() {
	const [data, setData] = useState<AnalysisItem[]>(mockAnalysisList);

	const markReviewed = (id: string) => {
		setData((prev) =>
			prev.map((item) =>
				item.id === id ? { ...item, status: "reviewed" } : item,
			),
		);
	};

	return (
		<OperatorShell currentPath="/operator/analysis">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Analisis Kinerja & Rekomendasi Tindakan
						</h1>
						<p className="text-xs text-muted-foreground">
							Prioritas rekomendasi berbasis perhitungan weight × gap × urgensi
							untuk memaksimalkan kenaikan nilai IKPA satker.
						</p>
					</div>
					<div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-right">
						<span className="text-[11px] text-muted-foreground">
							Total Rekomendasi
						</span>
						<p className="text-base font-bold text-primary">
							{data.length} Tindakan
						</p>
					</div>
				</div>

				<div className="space-y-3">
					{data.map((item) => {
						const isHigh = item.priority === 1;

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
											Prioritas {item.priority}
										</span>
										<span className="text-xs font-semibold text-primary">
											{item.indicatorName}
										</span>
										<span className="text-xs text-muted-foreground">·</span>
										<span className="text-xs text-muted-foreground">
											Tenggat: {item.deadlineLabel}
										</span>
									</div>

									<h3 className="text-sm font-bold text-foreground sm:text-base">
										{item.title}
									</h3>
									<p className="text-xs text-muted-foreground">{item.issue}</p>

									<div className="pt-1">
										<span className="text-xs font-semibold text-success">
											Potensi Peningkatan Nilai:{" "}
											{formatPointDelta(item.potentialImpactPoints)}
										</span>
									</div>
								</div>

								<div className="flex shrink-0 items-center gap-2">
									<button
										type="button"
										onClick={() => markReviewed(item.id)}
										className={`rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition ${
											item.status === "reviewed"
												? "bg-success/10 text-success"
												: "bg-background text-foreground hover:bg-surface-muted"
										}`}
									>
										{item.status === "reviewed"
											? "✓ Ditinjau"
											: "Tandai Ditinjau"}
									</button>
									<a
										href={item.route}
										className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover"
									>
										Buka Modul Input
									</a>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</OperatorShell>
	);
}
