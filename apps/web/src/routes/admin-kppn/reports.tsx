import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getMockAdminReports } from "@/mocks/admin-reports";
import { FileSpreadsheet, FileText, Filter, Info } from "lucide-react";

export const Route = createFileRoute("/admin-kppn/reports")({
	component: AdminReportsPage,
});

function AdminReportsPage() {
	const { reportTypes, previewData } = getMockAdminReports();

	const [selectedReportId, setSelectedReportId] =
		useState<string>("rekap-nilai");
	const [fiscalYear, setFiscalYear] = useState("2026");
	const [period, setPeriod] = useState("08");
	const [generatingFormat, setGeneratingFormat] = useState<string | null>(null);

	const selectedReport =
		reportTypes.find((r) => r.id === selectedReportId) || reportTypes[0];

	const activePreviewRows = previewData[selectedReport.id] || [];

	const handleExport = (format: "XLSX" | "PDF") => {
		setGeneratingFormat(format);
		setTimeout(() => {
			setGeneratingFormat(null);
			alert(
				`Laporan "${selectedReport.title}" (${format}) periode ${period}/${fiscalYear} berhasil diunduh.`,
			);
		}, 1200);
	};

	return (
		<AdminShell currentPath="/admin-kppn/reports">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Laporan Agregat IKPA
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Pusat pembuatan dan pengunduhan laporan rekapitulasi kinerja
							satker KPPN Malang
						</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							disabled={generatingFormat !== null}
							onClick={() => handleExport("XLSX")}
							className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs disabled:opacity-50"
						>
							<FileSpreadsheet className="size-3.5 text-success" />
							<span>
								{generatingFormat === "XLSX" ? "Membuat..." : "Ekspor XLSX"}
							</span>
						</button>
						<button
							type="button"
							disabled={generatingFormat !== null}
							onClick={() => handleExport("PDF")}
							className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-xs disabled:opacity-50"
						>
							<FileText className="size-3.5" />
							<span>
								{generatingFormat === "PDF" ? "Membuat..." : "Ekspor PDF"}
							</span>
						</button>
					</div>
				</div>

				{/* Selection & Filter Grid */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
					{/* Left: Report Types Selector */}
					<div className="space-y-3 lg:col-span-4">
						<div className="flex items-center gap-2 text-xs font-semibold text-foreground">
							<Filter className="size-4 text-primary" />
							<span>Pilih Jenis Laporan</span>
						</div>

						<div className="space-y-2">
							{reportTypes.map((report) => (
								<button
									key={report.id}
									type="button"
									onClick={() => setSelectedReportId(report.id)}
									className={`w-full text-left rounded-xl border p-3.5 text-xs transition-all ${
										selectedReportId === report.id
											? "border-primary bg-primary/5 shadow-xs"
											: "border-border/80 bg-surface hover:border-border"
									}`}
								>
									<div className="flex items-center justify-between">
										<span className="font-semibold text-foreground">
											{report.title}
										</span>
										<span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
											{report.category}
										</span>
									</div>
									<p className="mt-1 text-muted-foreground line-clamp-2">
										{report.description}
									</p>
								</button>
							))}
						</div>
					</div>

					{/* Right: Scope Parameters & Filter Bar */}
					<div className="space-y-4 lg:col-span-8">
						<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-semibold text-foreground">
									Parameter &amp; Cakupan Laporan
								</h3>
								<span className="text-xs text-muted-foreground">
									Scope: KPPN Malang (032)
								</span>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
								<div>
									<span className="text-muted-foreground block mb-1">
										Tahun Anggaran:
									</span>
									<select
										value={fiscalYear}
										onChange={(e) => setFiscalYear(e.target.value)}
										className="h-9 w-full rounded-lg border border-border bg-background px-3 font-medium text-foreground focus:border-primary focus:outline-none"
									>
										<option value="2026">2026</option>
										<option value="2025">2025</option>
									</select>
								</div>

								<div>
									<span className="text-muted-foreground block mb-1">
										Periode Evaluasi:
									</span>
									<select
										value={period}
										onChange={(e) => setPeriod(e.target.value)}
										className="h-9 w-full rounded-lg border border-border bg-background px-3 font-medium text-foreground focus:border-primary focus:outline-none"
									>
										<option value="08">Agustus (Bulan 8 / TW III)</option>
										<option value="07">Juli (Bulan 7 / TW III)</option>
										<option value="06">Juni (Bulan 6 / TW II)</option>
										<option value="03">Maret (Bulan 3 / TW I)</option>
									</select>
								</div>

								<div>
									<span className="text-muted-foreground block mb-1">
										Rule Set IKPA:
									</span>
									<div className="flex h-9 items-center rounded-lg border border-border bg-surface-muted/50 px-3 font-semibold text-foreground text-xs">
										2026.1 (PER-5/PB/2024)
									</div>
								</div>
							</div>
						</div>

						{/* Live Preview Card */}
						<div className="space-y-3 rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-sm font-semibold text-foreground">
										Preview: {selectedReport.title}
									</h3>
									<p className="text-xs text-muted-foreground">
										Tampilan struktur kolom dan data sampel sebelum diekspor
									</p>
								</div>
								<span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
									{activePreviewRows.length} baris data sampel
								</span>
							</div>

							{/* Preview Table */}
							<div className="overflow-x-auto rounded-lg border border-border/80">
								<table className="w-full text-left text-xs">
									<thead>
										<tr className="border-b border-border/80 bg-surface-muted/60 font-semibold text-muted-foreground">
											{selectedReport.columns.map((col) => (
												<th key={col} className="px-3 py-2.5">
													{col}
												</th>
											))}
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{activePreviewRows.map((row) => (
											<tr
												key={row.id}
												className="transition-colors hover:bg-surface-muted/30"
											>
												<td className="px-3 py-2.5 font-semibold text-foreground">
													{row.col1}
												</td>
												<td className="px-3 py-2.5 font-medium text-foreground">
													{row.col2}
												</td>
												<td className="px-3 py-2.5 text-foreground">
													{row.col3}
												</td>
												<td className="px-3 py-2.5 text-muted-foreground">
													{row.col4}
												</td>
												<td className="px-3 py-2.5 text-muted-foreground">
													{row.col5}
												</td>
												<td className="px-3 py-2.5">
													<span
														className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
															row.status === "danger"
																? "bg-danger/10 text-danger"
																: row.status === "warning"
																	? "bg-warning/10 text-warning"
																	: "bg-success/10 text-success"
														}`}
													>
														{row.col6}
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Disclaimer Footer */}
							<div className="flex items-start gap-2 rounded-lg bg-surface-muted/50 p-3 text-xs text-muted-foreground">
								<Info className="size-4 shrink-0 text-primary mt-0.5" />
								<p>
									*Laporan ini dihasilkan dari Simulator Penilaian IKPA KPPN
									Malang. Seluruh data berpedoman pada formula regulasi
									PER-5/PB/2024. Hasil simulasi adalah alat bantu monitoring
									internal dan dapat divalidasi dengan data resmi OM-SPAN.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</AdminShell>
	);
}
