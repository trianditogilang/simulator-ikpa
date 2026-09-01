import { createFileRoute } from "@tanstack/react-router";
import { OperatorShell } from "@/components/layout/operator-shell";
import { mockReports } from "@/mocks/reports";

export const Route = createFileRoute("/operator/reports")({
	component: OperatorReportsPage,
});

function OperatorReportsPage() {
	return (
		<OperatorShell currentPath="/operator/reports">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Laporan & Ekspor Simulasi IKPA
						</h1>
						<p className="text-xs text-muted-foreground">
							Cetak laporan proyeksi resmi internal atau ekspor data tabel ke
							format Excel (XLSX) dan PDF.
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					{mockReports.map((rep) => (
						<div
							key={rep.id}
							className="flex flex-col justify-between rounded-2xl border border-border bg-background p-6 shadow-xs"
						>
							<div>
								<div className="flex items-center justify-between">
									<span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
										Format {rep.format}
									</span>
									<span className="text-xs text-muted-foreground">
										{rep.period}
									</span>
								</div>

								<h3 className="mt-4 text-base font-bold text-foreground">
									{rep.title}
								</h3>
								<p className="mt-1 text-xs text-muted-foreground">
									{rep.description}
								</p>
							</div>

							<div className="mt-6 border-t border-border/80 pt-4">
								<button
									type="button"
									onClick={() => alert(`Mengunduh laporan ${rep.format}...`)}
									className="w-full rounded-xl bg-primary py-2 text-center text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover"
								>
									Unduh Laporan ({rep.format})
								</button>
							</div>
						</div>
					))}
				</div>
			</div>
		</OperatorShell>
	);
}
