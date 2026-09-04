import { createFileRoute } from "@tanstack/react-router";
import { OperatorShell } from "@/components/layout/operator-shell";

export const Route = createFileRoute("/operator/import")({
	component: OperatorImportDisabledPage,
});

// ponytail: route dipertahankan (agar routeTree.gen.ts tak perlu regenerate),
// hanya UI wizard yang di-stub. Backend import-service/server/parser utuh —
// alur restore lengkap di docs/future_plan.md („Future Plan — Import Data").
function OperatorImportDisabledPage() {
	return (
		<OperatorShell currentPath="/operator/import">
			<div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-background p-6 text-center shadow-xs sm:p-8">
				<h1 className="text-xl font-bold text-foreground sm:text-2xl">
					Import Data Dinonaktifkan Sementara
				</h1>
				<p className="text-xs text-muted-foreground sm:text-sm">
					Fitur import massal CSV/XLSX dihentikan sementara untuk menghemat
					penyimpanan di awal implementasi. Silakan input data manual melalui
					menu Input Data (Pagu, RPD, Kontrak, UP/TUP &amp; KKP, Capaian
					Output, SPM Dispensasi) — seluruh perhitungan IKPA tetap berjalan
					normal.
				</p>
				<p className="text-[11px] text-muted-foreground">
					Alur import (wizard upload → validasi → commit, template 6 domain,
					parser, QStash recovery) diarsipkan di{" "}
					<code>docs/future_plan.md</code> dan dapat diaktifkan kembali kapan
					saja tanpa migrasi database.
				</p>
				<div className="flex flex-wrap items-center justify-center gap-2 pt-2">
					<a
						href="/operator/dashboard"
						className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover"
					>
						Ke Dashboard
					</a>
					<a
						href="/operator/data/budget-revisions"
						className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
					>
						Input Manual
					</a>
				</div>
			</div>
		</OperatorShell>
	);
}
