import { createFileRoute } from "@tanstack/react-router";
import { OperatorShell } from "@/components/layout/operator-shell";
import { mockGuides } from "@/mocks/guides";

export const Route = createFileRoute("/operator/guides")({
	component: OperatorGuidesPage,
});

function OperatorGuidesPage() {
	return (
		<OperatorShell currentPath="/operator/guides">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Panduan & Formulasi 8 Indikator IKPA
						</h1>
						<p className="text-xs text-muted-foreground">
							Referensi lengkap dasar hukum PER-5/PB/2024, formula matematis,
							dan tips pengawalan nilai indikator.
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					{mockGuides.map((guide) => (
						<div
							key={guide.id}
							className="flex flex-col justify-between rounded-2xl border border-border bg-background p-6 shadow-xs"
						>
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
										{guide.weightLabel}
									</span>
									<span className="text-[11px] font-semibold text-muted-foreground">
										{guide.regulationSource}
									</span>
								</div>

								<h3 className="text-base font-bold text-foreground">
									{guide.title}
								</h3>
								<p className="text-xs text-muted-foreground">{guide.summary}</p>

								<div className="rounded-xl border border-border/80 bg-surface p-3 text-xs">
									<span className="font-semibold text-foreground">
										Formula Regulasi:
									</span>
									<p className="mt-1 font-mono text-[11px] text-primary">
										{guide.formula}
									</p>
								</div>

								<div className="rounded-xl bg-success/5 p-3 text-xs text-success-foreground">
									<span className="font-semibold text-success">
										Tips Sukses:
									</span>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{guide.tips}
									</p>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</OperatorShell>
	);
}
