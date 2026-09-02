import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { cancelImportJob, commitImportJob, uploadImportFile } from "@/services/import-service";

export const Route = createFileRoute("/operator/import")({
	component: OperatorImportPage,
});

type JobPreview = {
	jobId: string;
	domain: string;
	filename: string;
	totalRows: number;
	validRows: number;
	invalidRows: number;
	errors: Array<{ row: number; column?: string; message: string; rawValue?: string }>;
	preview: unknown[];
	status: string;
};

function OperatorImportPage() {
	const [step, setStep] = useState<1 | 2 | 3>(1);
	const [selectedDomain, setSelectedDomain] = useState("Pagu & Revisi DIPA");
	const [file, setFile] = useState<File | null>(null);
	const [job, setJob] = useState<JobPreview | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0] ?? null;
		if (f) {
			if (f.size > 10 * 1024 * 1024) {
				setError("File melebihi 10 MB");
				return;
			}
			if (!f.name.match(/\.(csv|xlsx)$/i)) {
				setError("Hanya .csv dan .xlsx diizinkan (.xls/.xlsm ditolak)");
				return;
			}
			setError(null);
			setFile(f);
		}
	};

	const doUpload = async () => {
		if (!file) { setError("Pilih file terlebih dahulu"); return; }
		setIsProcessing(true);
		setError(null);
		try {
			const res = await uploadImportFile({ domain: selectedDomain, file });
			setJob(res);
			setStep(2);
		} catch (e) {
			setError((e as Error).message.slice(0, 300));
		} finally {
			setIsProcessing(false);
		}
	};

	const doCommit = async () => {
		if (!job) return;
		setIsProcessing(true);
		setError(null);
		try {
			const res = await commitImportJob(job.jobId);
			alert(`Berhasil commit ${res.committed} baris (dari ${job.validRows} valid). ${res.lastError ? `Terakhir error: ${res.lastError}` : ""}`);
			window.location.href = "/operator/dashboard";
		} catch (e) {
			setError((e as Error).message.slice(0, 300));
		} finally {
			setIsProcessing(false);
		}
	};

	const doCancel = async () => {
		if (job?.jobId && !job.jobId.startsWith("mock-")) {
			try { await cancelImportJob(job.jobId); } catch {}
		}
		setJob(null);
		setFile(null);
		if (inputRef.current) inputRef.current.value = "";
		setStep(1);
	};

	return (
		<OperatorShell currentPath="/operator/import">
			<div className="mx-auto max-w-4xl space-y-6">
				<div>
					<h1 className="text-xl font-bold text-foreground sm:text-2xl">Wizard Import Data Transaksional</h1>
					<p className="text-xs text-muted-foreground sm:text-sm">Unggah file CSV/XLSX OMSPAN untuk memperbarui data simulasi IKPA secara massal dan aman. Maks 10 MB / 10.000 baris. File tidak menjadi URL publik permanen.</p>
				</div>

				<div className="grid grid-cols-3 gap-2 rounded-xl bg-surface p-2 text-center text-xs font-semibold">
					<div className={`rounded-lg py-2 ${step === 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>1. Unggah File</div>
					<div className={`rounded-lg py-2 ${step === 2 ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>2. Validasi & Preview</div>
					<div className={`rounded-lg py-2 ${step === 3 ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>3. Konfirmasi Commit</div>
				</div>

				{error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-xs text-danger" role="alert">{error}</div>}

				{step === 1 && (
					<div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xs">
						<div>
							<label htmlFor="domainSelect" className="block text-xs font-semibold text-foreground">Pilih Jenis Data / Domain</label>
							<select id="domainSelect" value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
								<option value="Pagu & Revisi DIPA">Pagu & Revisi DIPA</option>
								<option value="RPD & Realisasi">RPD & Realisasi Anggaran</option>
								<option value="Kontrak & Tagihan">Kontrak & SPM-LS Tagihan</option>
								<option value="UP/TUP & KKP">UP/TUP & Kartu Kredit Pemerintah</option>
								<option value="Capaian Output">Capaian Output Satker</option>
								<option value="SPM Dispensasi">SPM Dispensasi Akhir Tahun</option>
							</select>
							<p className="mt-1 text-[11px] text-muted-foreground">Header template mengikuti validasi server: {selectedDomain === "Pagu & Revisi DIPA" ? "account_code,amount,effective_at" : selectedDomain === "RPD & Realisasi" ? "month,account_code,amount[,target]" : selectedDomain === "Kontrak & Tagihan" ? "contract_number,account_code,value,signed_at,payment_type ATAU contract_number,reference_number,bast_date,received_at" : selectedDomain === "UP/TUP & KKP" ? "type,amount,sp2d_at ATAU month,amount" : selectedDomain === "Capaian Output" ? "ro_code,month,rvro,volume_dipa,pcro,tpcro" : "reference_number,issued_at,is_dispensasi"} </p>
						</div>

						<div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-10 text-center">
							<span className="text-sm font-semibold text-foreground">Pilih File Excel (.xlsx) atau CSV</span>
							<p className="mt-1 text-xs text-muted-foreground">Ukuran maksimal file: 10 MB. Format mengikuti template resmi IKPA. Formula (= + - @) akan ditolak.</p>
							<input ref={inputRef} aria-label="Pilih file import" type="file" accept=".csv,.xlsx" onChange={handleFileChange} className="mt-4 block w-full max-w-xs text-xs text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary-hover" />
							{file && <p className="mt-2 text-xs text-muted-foreground">{file.name} • {(file.size/1024).toFixed(1)} KB</p>}
							<button type="button" disabled={!file || isProcessing} onClick={doUpload} className="mt-4 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover disabled:opacity-50">
								{isProcessing ? "Memvalidasi..." : "Unggah & Validasi"}
							</button>
							<p className="mt-2 text-[11px] text-muted-foreground">Upload langsung ke server (R2 presigned untuk &gt;4.5 MB akan diaktifkan bila env R2 tersedia).</p>
						</div>
					</div>
				)}

				{step === 2 && job && (
					<div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xs">
						<div className="flex flex-col gap-2 border-b border-border/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h2 className="text-sm font-bold text-foreground sm:text-base">Hasil Validasi File: {job.filename}</h2>
								<p className="text-xs text-muted-foreground">Domain: {job.domain} • Total: {job.totalRows} baris • Job: {job.jobId.slice(0,8)}</p>
							</div>
							<div className="flex items-center gap-2">
								<span className="rounded-md bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">{job.validRows} Baris Valid</span>
								<span className="rounded-md bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">{job.invalidRows} Baris Error</span>
							</div>
						</div>

						{job.errors.length > 0 && (
							<div className="rounded-xl border border-border/80 bg-surface p-4 text-xs">
								<span className="font-semibold text-foreground">Rincian Kesalahan Validasi ({job.errors.length} dari maks 100):</span>
								<div className="mt-2 max-h-40 space-y-1 overflow-auto">
									{job.errors.map((e, i) => (
										<p key={i} className="text-muted-foreground">Baris {e.row}{e.column ? ` • Kolom ${e.column}` : ""}: {e.message}{e.rawValue ? ` – "${e.rawValue.slice(0,60)}"` : ""}</p>
									))}
								</div>
							</div>
						)}

						{job.preview.length > 0 && (
							<div className="rounded-xl border border-border/80 bg-surface p-4 text-xs">
								<span className="font-semibold text-foreground">Preview 5 Baris Valid Pertama:</span>
								<pre className="mt-2 max-h-40 overflow-auto rounded bg-background p-2 text-[11px] text-muted-foreground">{JSON.stringify(job.preview, null, 2)}</pre>
							</div>
						)}

						{job.validRows === 0 && <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">Tidak ada baris valid. Perbaiki file sesuai template header dan coba lagi.</p>}

						<div className="flex items-center justify-between pt-2">
							<button type="button" onClick={doCancel} className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted">Unggah Ulang</button>
							<button type="button" disabled={job.validRows === 0} onClick={() => setStep(3)} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover disabled:opacity-50">Lanjut ke Komitmen ({job.validRows} Baris)</button>
						</div>
					</div>
				)}

				{step === 3 && job && (
					<div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xs">
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
							<h3 className="text-base font-bold text-primary">Konfirmasi Penyimpanan {job.validRows} Baris Data</h3>
							<p className="mt-1 text-xs text-muted-foreground">Hanya baris valid yang akan disimpan (valid-row-only). Baris error diabaikan. Duplikat akan di-upsert per aturan domain. Tindakan teraudit.</p>
							<p className="mt-1 text-[11px] text-muted-foreground">Domain: {job.domain} • File: {job.filename}</p>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4">
							<button type="button" onClick={() => setStep(2)} className="rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted">Kembali</button>
							<button type="button" disabled={isProcessing} onClick={doCommit} className="rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover disabled:opacity-50">{isProcessing ? "Menyimpan..." : "Commit Simpan Data"}</button>
						</div>
					</div>
				)}
			</div>
		</OperatorShell>
	);
}
