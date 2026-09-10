import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/layout/admin-shell";

export const Route = createFileRoute("/admin-kppn/reports")({
	component: AdminReportsPage,
});

function AdminReportsPage() {
	return (
		<AdminShell currentPath="/admin-kppn/reports">
			<div className="space-y-6">
				<div className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<h1 className="text-lg font-bold text-foreground sm:text-xl">Laporan Agregat IKPA</h1>
					<p className="mt-2 text-xs text-muted-foreground sm:text-sm">
						Monitoring agregat dan ekspor Admin dihentikan dari kontrak aktif. Gunakan Dashboard Monitoring untuk membaca data dalam scope KPPN secara read-only.
					</p>
				</div>
				<output className="block rounded-xl border border-border bg-background p-5 text-sm text-muted-foreground">
					<span className="font-semibold text-foreground">Fitur tidak tersedia.</span>{" "}
					Admin tidak menyediakan ekspor XLSX/PDF atau preview data contoh. Route ini dipertahankan hanya agar tautan lama berhenti dengan aman.
				</output>
			</div>
		</AdminShell>
	);
}
