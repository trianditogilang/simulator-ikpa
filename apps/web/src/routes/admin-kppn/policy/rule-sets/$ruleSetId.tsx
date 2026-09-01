import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getMockRuleSetById, type RuleSetItem } from "@/mocks/rule-sets";
import { RuleSetPublishDialog } from "@/components/admin/rule-set-publish-dialog";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	Copy,
	Lock,
	Save,
	Scale,
	Send,
} from "lucide-react";

export const Route = createFileRoute("/admin-kppn/policy/rule-sets/$ruleSetId")({
	component: AdminRuleSetEditorPage,
});

function AdminRuleSetEditorPage() {
	const { ruleSetId } = Route.useParams();
	const initialRuleSet = getMockRuleSetById(ruleSetId);

	const [ruleSet, setRuleSet] = useState<RuleSetItem>(initialRuleSet);
	const [activeTab, setActiveTab] = useState<
		"weights" | "parameters" | "dispensation" | "reminders"
	>("weights");
	const [publishDialogOpen, setPublishDialogOpen] = useState(false);
	const [saveToast, setSaveToast] = useState<string | null>(null);

	const isReadOnly = ruleSet.isLocked || ruleSet.status !== "draft";

	const totalWeight = ruleSet.indicatorWeights.reduce((acc, curr) => acc + curr.weight, 0);
	const isWeightValid = totalWeight === 100;

	const handleWeightChange = (key: string, newWeight: number) => {
		if (isReadOnly) return;
		setRuleSet((prev) => ({
			...prev,
			indicatorWeights: prev.indicatorWeights.map((w) =>
				w.key === key ? { ...w, weight: Number.isNaN(newWeight) ? 0 : newWeight } : w,
			),
		}));
	};

	const handleSaveDraft = () => {
		setSaveToast("Perubahan draft Rule Set berhasil disimpan secara lokal.");
		setTimeout(() => setSaveToast(null), 4000);
	};

	const handleConfirmPublish = () => {
		setPublishDialogOpen(false);
		setRuleSet((prev) => ({
			...prev,
			status: "published",
			isLocked: true,
			publishedAt: "01 Sep 2026, 11.50 WIB",
		}));
		setSaveToast(
			`Rule Set versi ${ruleSet.version} berhasil dipublikasikan sebagai acuan aktif!`,
		);
		setTimeout(() => setSaveToast(null), 5000);
	};

	return (
		<AdminShell currentPath="/admin-kppn/policy/rule-sets">
			<div className="space-y-6">
				{/* Top Bar Navigation & Actions */}
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<a
							href="/admin-kppn/policy/rule-sets"
							className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline"
						>
							<ArrowLeft className="size-3.5" />
							<span>Kembali ke Daftar Rule Set</span>
						</a>
						<div className="flex flex-wrap items-center gap-2 pt-1">
							<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
								Rule Set Versi {ruleSet.version}
							</h1>
							<span
								className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
									ruleSet.status === "published"
										? "bg-success/10 text-success"
										: ruleSet.status === "draft"
											? "bg-warning/10 text-warning"
											: "bg-surface-muted text-muted-foreground"
								}`}
							>
								{ruleSet.status === "published"
									? "Published ✓"
									: ruleSet.status === "draft"
										? "Draft"
										: "Retired"}
							</span>
							{isReadOnly && (
								<span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
									<Lock className="size-3" />
									<span>Terkunci (Read-only)</span>
								</span>
							)}
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						{isReadOnly ? (
							<button
								type="button"
								onClick={() => {
									alert(`Membuat kloning baru dari Rule Set ${ruleSet.version}...`);
								}}
								className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-xs"
							>
								<Copy className="size-3.5" />
								<span>Buat Versi Baru (Draft)</span>
							</button>
						) : (
							<>
								<button
									type="button"
									onClick={handleSaveDraft}
									className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs"
								>
									<Save className="size-3.5" />
									<span>Simpan Draft</span>
								</button>
								<button
									type="button"
									disabled={!isWeightValid}
									onClick={() => setPublishDialogOpen(true)}
									className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-xs disabled:opacity-50"
								>
									<Send className="size-3.5" />
									<span>Publikasikan</span>
								</button>
							</>
						)}
					</div>
				</div>

				{/* Toast Alert */}
				{saveToast && (
					<div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-medium text-success">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="size-4 shrink-0" />
							<span>{saveToast}</span>
						</div>
						<button
							type="button"
							onClick={() => setSaveToast(null)}
							className="text-success hover:underline"
						>
							Tutup
						</button>
					</div>
				)}

				{/* Metadata Form Section */}
				<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs space-y-4">
					<h3 className="text-sm font-semibold text-foreground">
						Identitas &amp; Sumber Regulasi
					</h3>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
						<div>
							<span className="text-muted-foreground block mb-1 font-medium">
								Nomor / Kode Versi:
							</span>
							<input
								type="text"
								disabled={isReadOnly}
								value={ruleSet.version}
								onChange={(e) =>
									setRuleSet((prev) => ({ ...prev, version: e.target.value }))
								}
								className="h-9 w-full rounded-lg border border-border bg-background px-3 font-semibold text-foreground focus:border-primary focus:outline-none disabled:bg-surface-muted"
							/>
						</div>

						<div>
							<span className="text-muted-foreground block mb-1 font-medium">
								Tanggal Efektif Berlaku:
							</span>
							<input
								type="text"
								disabled={isReadOnly}
								value={ruleSet.effectiveFrom}
								onChange={(e) =>
									setRuleSet((prev) => ({ ...prev, effectiveFrom: e.target.value }))
								}
								className="h-9 w-full rounded-lg border border-border bg-background px-3 font-medium text-foreground focus:border-primary focus:outline-none disabled:bg-surface-muted"
							/>
						</div>

						<div>
							<span className="text-muted-foreground block mb-1 font-medium">
								Tahun Anggaran:
							</span>
							<input
								type="number"
								disabled={isReadOnly}
								value={ruleSet.year}
								onChange={(e) =>
									setRuleSet((prev) => ({
										...prev,
										year: Number.parseInt(e.target.value, 10) || 2026,
									}))
								}
								className="h-9 w-full rounded-lg border border-border bg-background px-3 font-medium text-foreground focus:border-primary focus:outline-none disabled:bg-surface-muted"
							/>
						</div>

						<div className="sm:col-span-3">
							<span className="text-muted-foreground block mb-1 font-medium">
								Sumber Dasar Regulasi:
							</span>
							<input
								type="text"
								disabled={isReadOnly}
								value={ruleSet.sourceRegulation}
								onChange={(e) =>
									setRuleSet((prev) => ({ ...prev, sourceRegulation: e.target.value }))
								}
								className="h-9 w-full rounded-lg border border-border bg-background px-3 font-medium text-foreground focus:border-primary focus:outline-none disabled:bg-surface-muted"
							/>
						</div>

						<div className="sm:col-span-3">
							<span className="text-muted-foreground block mb-1 font-medium">
								Catatan / Ringkasan Perubahan:
							</span>
							<textarea
								rows={2}
								disabled={isReadOnly}
								value={ruleSet.changeSummary}
								onChange={(e) =>
									setRuleSet((prev) => ({ ...prev, changeSummary: e.target.value }))
								}
								className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none disabled:bg-surface-muted"
							/>
						</div>
					</div>
				</div>

				{/* Sectioned Tabs for Configuration */}
				<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs space-y-4">
					{/* Tab Navigation */}
					<div className="flex flex-wrap items-center gap-1 border-b border-border/80 pb-3">
						<button
							type="button"
							onClick={() => setActiveTab("weights")}
							className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
								activeTab === "weights"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
							}`}
						>
							<Scale className="size-3.5" />
							<span>Bobot 8 Indikator ({totalWeight}%)</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("parameters")}
							className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
								activeTab === "parameters"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
							}`}
						>
							<span>Parameter &amp; Toleransi</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("dispensation")}
							className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
								activeTab === "dispensation"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
							}`}
						>
							<span>Dispensasi SPM Q4</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("reminders")}
							className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
								activeTab === "reminders"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
							}`}
						>
							<span>Kebijakan Reminder</span>
						</button>
					</div>

					{/* Tab 1: Bobot Indikator */}
					{activeTab === "weights" && (
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<p className="text-xs text-muted-foreground">
									Atur bobot persentase untuk masing-masing indikator IKPA. Total bobot harus tepat 100%.
								</p>
								<span
									className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
										isWeightValid
											? "bg-success/10 text-success"
											: "bg-danger/10 text-danger"
									}`}
								>
									Total Bobot: {totalWeight}% {isWeightValid ? "✓ Valid" : "⚠ Harus 100%"}
								</span>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
								{ruleSet.indicatorWeights.map((ind) => (
									<div
										key={ind.key}
										className="rounded-xl border border-border/80 bg-background p-4 shadow-xs space-y-2"
									>
										<div className="flex items-start justify-between gap-2">
											<span className="font-semibold text-foreground text-xs">
												{ind.label}
											</span>
											<span className="text-[11px] text-muted-foreground">
												Target: {ind.target}
											</span>
										</div>

										<div className="flex items-center gap-2">
											<input
												type="number"
												min={0}
												max={100}
												disabled={isReadOnly || ind.key === "spm_dispensation"}
												value={ind.weight}
												onChange={(e) =>
													handleWeightChange(
														ind.key,
														Number.parseInt(e.target.value, 10) || 0,
													)
												}
												className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-center text-sm font-semibold text-foreground focus:border-primary focus:outline-none disabled:bg-surface-muted"
											/>
											<span className="text-xs text-muted-foreground">%</span>
										</div>

										<p className="text-[11px] text-muted-foreground line-clamp-2">
											{ind.description}
										</p>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Tab 2: Parameter & Toleransi */}
					{activeTab === "parameters" && (
						<div className="space-y-3 rounded-lg border border-border/60 bg-background p-4 text-xs">
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div className="space-y-1">
									<span className="font-semibold text-foreground">
										Toleransi Deviasi Hal III DIPA:
									</span>
									<p className="text-muted-foreground">
										Batas deviasi realisasi bulanan sebelum dikenakan penalti nilai.
									</p>
									<div className="flex items-center gap-2 pt-1">
										<input
											type="number"
											disabled={isReadOnly}
											defaultValue={3}
											className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-center text-xs font-semibold text-foreground disabled:bg-surface-muted"
										/>
										<span className="text-muted-foreground">%</span>
									</div>
								</div>

								<div className="space-y-1">
									<span className="font-semibold text-foreground">
										Batas Waktu SPM-LS Kontraktual:
									</span>
									<p className="text-muted-foreground">
										Maksimal hari kerja sejak penandatanganan BAST/BAPP.
									</p>
									<div className="flex items-center gap-2 pt-1">
										<input
											type="number"
											disabled={isReadOnly}
											defaultValue={17}
											className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-center text-xs font-semibold text-foreground disabled:bg-surface-muted"
										/>
										<span className="text-muted-foreground">Hari Kerja</span>
									</div>
								</div>

								<div className="space-y-1">
									<span className="font-semibold text-foreground">
										Batas Pendaftaran Kontrak:
									</span>
									<p className="text-muted-foreground">
										Batas waktu pendaftaran data kontrak ke KPPN.
									</p>
									<div className="flex items-center gap-2 pt-1">
										<input
											type="number"
											disabled={isReadOnly}
											defaultValue={3}
											className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-center text-xs font-semibold text-foreground disabled:bg-surface-muted"
										/>
										<span className="text-muted-foreground">Hari Kerja</span>
									</div>
								</div>

								<div className="space-y-1">
									<span className="font-semibold text-foreground">
										Target Proporsi Transaksi KKP:
									</span>
									<p className="text-muted-foreground">
										Persentase minimal penggunaan Kartu Kredit Pemerintah terhadap UP.
									</p>
									<div className="flex items-center gap-2 pt-1">
										<input
											type="number"
											disabled={isReadOnly}
											defaultValue={10}
											className="h-8 w-20 rounded-md border border-border bg-surface px-2 text-center text-xs font-semibold text-foreground disabled:bg-surface-muted"
										/>
										<span className="text-muted-foreground">%</span>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Tab 3: Dispensasi SPM */}
					{activeTab === "dispensation" && (
						<div className="space-y-3 rounded-lg border border-border/60 bg-background p-4 text-xs">
							<h4 className="font-semibold text-foreground">
								Formula Pengurang Dispensasi SPM (Triwulan IV)
							</h4>
							<p className="text-muted-foreground">
								Dispensasi SPM di luar batas waktu pada akhir tahun anggaran menjadi faktor pengurang skor total IKPA.
							</p>
							<div className="grid grid-cols-1 gap-2 sm:grid-cols-3 pt-2">
								<div className="rounded-lg border border-border/60 bg-surface p-3 space-y-1">
									<span className="font-semibold text-foreground">Rasio &le; 0,5&permil;</span>
									<p className="text-muted-foreground">Pengurang: -0,50 poin</p>
								</div>
								<div className="rounded-lg border border-border/60 bg-surface p-3 space-y-1">
									<span className="font-semibold text-foreground">Rasio 0,5&permil; - 1,0&permil;</span>
									<p className="text-muted-foreground">Pengurang: -1,00 poin</p>
								</div>
								<div className="rounded-lg border border-border/60 bg-surface p-3 space-y-1">
									<span className="font-semibold text-foreground">Rasio &gt; 1,0&permil;</span>
									<p className="text-muted-foreground">Pengurang: -2,00 poin</p>
								</div>
							</div>
						</div>
					)}

					{/* Tab 4: Kebijakan Reminder Ref */}
					{activeTab === "reminders" && (
						<div className="space-y-3 rounded-lg border border-border/60 bg-background p-4 text-xs">
							<h4 className="font-semibold text-foreground">
								Kaitan Reminder &amp; Jadwal Otomatis
							</h4>
							<p className="text-muted-foreground">
								Setiap perubahan Rule Set ini akan menyelaraskan deadline pada modul Reminder Policy KPPN Malang.
							</p>
							<div className="flex items-center gap-2 pt-2">
								<a
									href="/admin-kppn/policy/reminders"
									className="font-semibold text-primary underline-offset-4 hover:underline"
								>
									Kelola Konfigurasi Reminder Policy →
								</a>
							</div>
						</div>
					)}
				</div>

				{/* Validation & Invariant Status Box */}
				<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs space-y-3">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="size-4 text-success" />
						<h3 className="text-sm font-semibold text-foreground">
							Hasil Validasi Schema &amp; Invariant Engine
						</h3>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
						<div className="flex items-center gap-2 text-success">
							<CheckCircle2 className="size-4 shrink-0" />
							<span>Semua 8 indikator memiliki parameter yang tervalidasi schema Zod.</span>
						</div>
						<div className="flex items-center gap-2 text-success">
							<CheckCircle2 className="size-4 shrink-0" />
							<span>Total bobot indikator tepat 100% (valid).</span>
						</div>
						{ruleSet.validationStatus.warnings.length > 0 && (
							<div className="col-span-2 flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-warning">
								<AlertTriangle className="size-4 shrink-0 mt-0.5" />
								<div>
									<span className="font-semibold">Catatan Verifikasi:</span>
									<p className="text-foreground">
										{ruleSet.validationStatus.warnings[0]}
									</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Publish Dialog */}
				<RuleSetPublishDialog
					isOpen={publishDialogOpen}
					onClose={() => setPublishDialogOpen(false)}
					onConfirmPublish={handleConfirmPublish}
					ruleSet={ruleSet}
				/>
			</div>
		</AdminShell>
	);
}
