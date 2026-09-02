import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { fetchOperatorPdf, fetchOperatorXlsx, triggerDownload } from "@/services/report-service";

export const Route = createFileRoute("/operator/reports")({
	component: OperatorReportsPage,
});

function OperatorReportsPage() {
	const [generating, setGenerating] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleDownload = async (format: "XLSX" | "PDF") => {
		setGenerating(format);
		setError(null);
		try {
			if (format === "XLSX") {
				const res = await fetchOperatorXlsx();
				triggerDownload(res.contentBase64, res.filename, res.mimeType);
			} else {
				const res = await fetchOperatorPdf(undefined, 8);
				triggerDownload(res.contentBase64, res.filename, res.mimeType);
			}
		} catch (e) {
			setError((e as Error).message.slice(0, 300));
		} finally {
			setGenerating(null);
		}
	};

	return (
		<OperatorShell currentPath="/operator/reports">
			<div className="space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">Laporan & Ekspor Simulasi IKPA</h1>
						<p className="text-xs text-muted-foreground">Cetak laporan proyeksi resmi internal atau ekspor data tabel ke format Excel (XLSX) dan PDF. Data scoped per satker, filter tercantum, injection di-netralkan, dan file via download terautentikasi (tanpa URL publik permanen).</p>
					</div>
				</div>

				{error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-xs text-danger">{error}</div>}

				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					<div className="flex flex-col justify-between rounded-2xl border border-border bg-background p-6 shadow-xs">
						<div>
							<div className="flex items-center justify-between">
								<span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Format PDF</span>
								<span className="text-xs text-muted-foreground">Agustus 2026 • Rule 2026.1</span>
							</div>
							<h3 className="mt-4 text-base font-bold text-foreground">Laporan Eksekutif Simulasi IKPA Satker</h3>
							<p className="mt-1 text-xs text-muted-foreground">Rangkuman komprehensif nilai akhir, gap target, breakdown 7 indikator, dan rekomendasi mitigasi risiko. Disclaimer internal & versi rule set tercantum.</p>
						</div>
						<div className="mt-6 border-t border-border/80 pt-4">
							<button type="button" disabled={generating !== null} onClick={() => handleDownload("PDF")} className="w-full rounded-xl bg-primary py-2 text-center text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover disabled:opacity-50">
								{generating === "PDF" ? "Membuat PDF..." : "Unduh Laporan (PDF)"}
							</button>
						</div>
					</div>

					<div className="flex flex-col justify-between rounded-2xl border border-border bg-background p-6 shadow-xs">
						<div>
							<div className="flex items-center justify-between">
								<span className="rounded-md bg-success/10 px-2.5 py-1 text-xs font-bold text-success">Format XLSX</span>
								<span className="text-xs text-muted-foreground">Agustus 2026 • Rule 2026.1</span>
							</div>
							<h3 className="mt-4 text-base font-bold text-foreground">Matriks Rincian Data Transaksional & Deviasi</h3>
							<p className="mt-1 text-xs text-muted-foreground">Ekspor tabel lengkap pagu, RPD bulanan, SPM-LS, UP/TUP, capaian RO, dan SPM dispensasi. Metadata periode & disclaimer di sheet pertama.</p>
						</div>
						<div className="mt-6 border-t border-border/80 pt-4">
							<button type="button" disabled={generating !== null} onClick={() => handleDownload("XLSX")} className="w-full rounded-xl bg-primary py-2 text-center text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover disabled:opacity-50">
								{generating === "XLSX" ? "Membuat XLSX..." : "Unduh Laporan (XLSX)"}
							</button>
						</div>
					</div>
				</div>

				<div className="rounded-xl border border-border/80 bg-surface p-4 text-xs text-muted-foreground">
					<span className="font-semibold text-foreground">Keamanan ekspor:</span> nilai diawali = + - @ dinetralkan (formula injection defense), hanya data satker aktif, filename aman, dan download via blob terautentikasi tanpa link permanen.
				</div>
			</div>
		</OperatorShell>
	);
}
