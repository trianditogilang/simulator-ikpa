import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { mockImportJobs } from "@/mocks/import-job";

export const Route = createFileRoute("/operator/import")({
	component: OperatorImportPage,
});

function OperatorImportPage() {
	const [step, setStep] = useState<1 | 2 | 3>(1);
	const [selectedDomain, setSelectedDomain] = useState("Pagu & Revisi DIPA");
	const [isProcessing, setIsProcessing] = useState(false);

	const activeJob = mockImportJobs[0];

	return (
		<OperatorShell currentPath="/operator/import">
			<div className="mx-auto max-w-4xl space-y-6">
				<div>
					<h1 className="text-xl font-bold text-foreground sm:text-2xl">
						Wizard Import Data Transaksional
					</h1>
					<p className="text-xs text-muted-foreground sm:text-sm">
						Unggah file CSV/XLSX OMSPAN untuk memperbarui data simulasi IKPA secara
						massal dan aman.
					</p>
				</div>

				{/* Step Wizard Progress */}
				<div className="grid grid-cols-3 gap-2 rounded-xl bg-surface p-2 text-center text-xs font-semibold">
					<div
						className={`rounded-lg py-2 ${
							step === 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
						}`}
					>
						1. Unggah File
					</div>
					<div
						className={`rounded-lg py-2 ${
							step === 2 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
						}`}
					>
						2. Validasi & Preview
					</div>
					<div
						className={`rounded-lg py-2 ${
							step === 3 ? "bg-primary text-primary-foreground" : "text-muted-foreground"
						}`}
					>
						3. Konfirmasi Commit
					</div>
				</div>

				{/* Step 1: Upload */}
				{step === 1 && (
					<div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xs">
						<div>
							<label htmlFor="domainSelect" className="block text-xs font-semibold text-foreground">
								Pilih Jenis Data / Domain
							</label>
							<select
								id="domainSelect"
								value={selectedDomain}
								onChange={(e) => setSelectedDomain(e.target.value)}
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							>
								<option value="Pagu & Revisi DIPA">Pagu & Revisi DIPA</option>
								<option value="RPD & Realisasi">RPD & Realisasi Anggaran</option>
								<option value="Kontrak & Tagihan">Kontrak & SPM-LS Tagihan</option>
								<option value="UP/TUP & KKP">UP/TUP & Kartu Kredit Pemerintah</option>
								<option value="Capaian Output">Capaian Output Satker</option>
								<option value="SPM Dispensasi">SPM Dispensasi Akhir Tahun</option>
							</select>
						</div>

						<div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
							<span className="text-sm font-semibold text-foreground">
								Pilih File Excel (.xlsx) atau CSV
							</span>
							<p className="mt-1 text-xs text-muted-foreground">
								Ukuran maksimal file: 10 MB. Format mengikuti template resmi IKPA.
							</p>
							<button
								type="button"
								onClick={() => setStep(2)}
								className="mt-4 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover"
							>
								Simulasikan Unggah File
							</button>
						</div>
					</div>
				)}

				{/* Step 2: Validation & Preview */}
				{step === 2 && (
					<div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xs">
						<div className="flex items-center justify-between border-b border-border/80 pb-4">
							<div>
								<h2 className="text-sm font-bold text-foreground sm:text-base">
									Hasil Validasi File: {activeJob.fileName}
								</h2>
								<p className="text-xs text-muted-foreground">
									Domain: {activeJob.domain} · Waktu: {activeJob.uploadedAt}
								</p>
							</div>

							<div className="flex items-center gap-2">
								<span className="rounded-md bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
									{activeJob.validRows} Baris Valid
								</span>
								<span className="rounded-md bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
									{activeJob.errorRows} Baris Error
								</span>
							</div>
						</div>

						<div className="rounded-xl border border-border/80 bg-surface p-4 text-xs">
							<span className="font-semibold text-foreground">
								Rincian Kesalahan Validasi (5 Baris):
							</span>
							<p className="mt-1 text-muted-foreground">
								Baris 16: Format nominal bukan angka numerik valid.
							</p>
							<p className="text-muted-foreground">
								Baris 24: Nomor DIPA tidak sesuai pola format Satker.
							</p>
						</div>

						<div className="flex items-center justify-between pt-2">
							<button
								type="button"
								onClick={() => setStep(1)}
								className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
							>
								Unggah Ulang
							</button>
							<button
								type="button"
								onClick={() => setStep(3)}
								className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover"
							>
								Lanjut ke Komitmen ({activeJob.validRows} Baris)
							</button>
						</div>
					</div>
				)}

				{/* Step 3: Confirmation */}
				{step === 3 && (
					<div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xs">
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
							<h3 className="text-base font-bold text-primary">
								Konfirmasi Penyimpanan {activeJob.validRows} Baris Data
							</h3>
							<p className="mt-1 text-xs text-muted-foreground">
								Data akan disimpan ke database simulasi satker dan memperbarui nilai
								IKPA secara otomatis.
							</p>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4">
							<button
								type="button"
								onClick={() => setStep(2)}
								className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
							>
								Kembali
							</button>
							<button
								type="button"
								disabled={isProcessing}
								onClick={() => {
									setIsProcessing(true);
									setTimeout(() => {
										setIsProcessing(false);
										alert("Data berhasil diimport ke simulasi IKPA.");
										window.location.href = "/operator/dashboard";
									}, 1000);
								}}
								className="rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover disabled:opacity-50"
							>
								{isProcessing ? "Menyimpan..." : "Commit Simpan Data"}
							</button>
						</div>
					</div>
				)}
			</div>
		</OperatorShell>
	);
}
