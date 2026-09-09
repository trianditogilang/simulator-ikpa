import { useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowRight,
	CheckCircle2,
	GitCompare,
	History,
	LayoutDashboard,
	Sparkles,
	X,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { type FormEvent, useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import { executeSimulation } from "@/services/simulation-service";

export interface ScenarioOverrideSummary {
	label: string;
	originalValue: string | number;
	newValue: string | number;
}

export interface SaveScenarioDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	indicatorKey: string;
	indicatorName: string;
	activePeriodMonth: number;
	fiscalYear?: number;
	targetScore?: number;
	overrides?: Record<string, string>;
	assumptions?: {
		upTup?: any;
		dispensasi?: any;
	};
	overrideSummaries?: ScenarioOverrideSummary[];
	parentSnapshotId?: string;
	onSuccess?: () => void;
}

const MONTH_NAMES = [
	"Januari",
	"Februari",
	"Maret",
	"April",
	"Mei",
	"Juni",
	"Juli",
	"Agustus",
	"September",
	"Oktober",
	"November",
	"Desember",
];

const SLOT_STORAGE_KEY = "ikpa-scenario-slot";

function readStoredSlot(): "A" | "B" | "C" {
	try {
		if (typeof window === "undefined") return "A";
		const raw = window.localStorage.getItem(SLOT_STORAGE_KEY);
		if (raw === "A" || raw === "B" || raw === "C") return raw;
	} catch {
		// ignore storage errors
	}
	return "A";
}

export function SaveScenarioDialog({
	open,
	onOpenChange,
	indicatorName,
	activePeriodMonth,
	fiscalYear = 2026,
	targetScore = 95.0,
	overrides,
	assumptions,
	overrideSummaries = [],
	parentSnapshotId,
	onSuccess,
}: SaveScenarioDialogProps) {
	const navigate = useNavigate();

	const periodLabel = `${MONTH_NAMES[activePeriodMonth - 1] || `Bulan ${activePeriodMonth}`} ${fiscalYear}`;
	const [selectedSlot, setSelectedSlot] = useState<"A" | "B" | "C">(readStoredSlot);
	const defaultScenarioName = `Skenario ${selectedSlot}: Tutup gap via ${indicatorName}`;

	const [scenarioName, setScenarioName] = useState(defaultScenarioName);
	const [notes, setNotes] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [savedResult, setSavedResult] = useState<{
		simulationId: string;
		snapshotId: string;
		totalScore: string;
	} | null>(null);

	const selectSlot = (slot: "A" | "B" | "C") => {
		setSelectedSlot(slot);
		try {
			window.localStorage.setItem(SLOT_STORAGE_KEY, slot);
		} catch {
			// ignore storage errors
		}
		setScenarioName(`Skenario ${slot}: Tutup gap via ${indicatorName}`);
	};

	useEffect(() => {
		if (open) {
			const stored = readStoredSlot();
			setSelectedSlot(stored);
			setScenarioName(`Skenario ${stored}: Tutup gap via ${indicatorName}`);
			setSavedResult(null);
			setError(null);
		}
	}, [open, indicatorName]);

	useEffect(() => {
		const onStorage = (e: StorageEvent) => {
			if (e.key === SLOT_STORAGE_KEY && (e.newValue === "A" || e.newValue === "B" || e.newValue === "C")) {
				setSelectedSlot(e.newValue);
			}
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, []);

	const hasChanges =
		(overrides && Object.keys(overrides).length > 0) ||
		Boolean(assumptions?.upTup || assumptions?.dispensasi) ||
		overrideSummaries.length > 0;

	const handleSave = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);

		const cleanName = scenarioName.trim();
		if (!cleanName) {
			setError("Nama skenario wajib diisi.");
			return;
		}

		if (!hasChanges) {
			setError(
				"Belum ada asumsi yang berubah. Skenario hanya dapat disimpan setelah Anda mengubah minimal satu asumsi.",
			);
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await executeSimulation({
				simulationType: "scenario",
				simulationName: cleanName.startsWith(`Skenario ${selectedSlot}`)
					? cleanName
					: `Skenario ${selectedSlot}: ${cleanName}`,
				period: { kind: "month", value: activePeriodMonth },
				targetScore: targetScore.toFixed(2),
				parentSnapshotId,
				overrides,
				assumptions,
			});

			setSavedResult({
				simulationId: res.simulationId,
				snapshotId: res.snapshotId,
				totalScore: res.totalScore ?? "—",
			});
			try {
				window.localStorage.setItem(SLOT_STORAGE_KEY, selectedSlot);
			} catch {
				// ignore storage errors
			}
			onSuccess?.();
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Gagal menyimpan skenario.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleClose = () => {
		setSavedResult(null);
		setError(null);
		setScenarioName(`Skenario ${selectedSlot}: Tutup gap via ${indicatorName}`);
		setNotes("");
		onOpenChange(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={(v) => !v && handleClose()}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-xs" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-2xl outline-none max-h-[85dvh] overflow-y-auto">
					<div className="flex items-center justify-between border-b border-border/80 pb-3">
						<div className="flex items-center gap-2.5">
							<div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<Sparkles className="size-4" />
							</div>
							<div>
								<Dialog.Title className="text-sm font-bold text-foreground sm:text-base">
									{savedResult ? "Skenario Berhasil Disimpan!" : "Simpan sebagai Skenario IKPA"}
								</Dialog.Title>
								<p className="text-[11px] text-muted-foreground">
									Mode simulasi lokal · data aktual database tidak berubah
								</p>
							</div>
						</div>
						<Dialog.Close asChild>
							<button
								type="button"
								className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
							>
								<X className="size-4" />
							</button>
						</Dialog.Close>
					</div>

					{savedResult ? (
						<div className="mt-4 space-y-4">
							<div className="rounded-xl border border-success/30 bg-success/10 p-4 text-xs">
								<div className="flex items-center gap-2 text-success font-bold">
									<CheckCircle2 className="size-4" />
									<span>Skenario &quot;{scenarioName}&quot; tersimpan</span>
								</div>
								<p className="mt-1 text-[11px] text-muted-foreground">
									Hasil estimasi nilai IKPA:{" "}
									<strong className="text-foreground font-bold">{savedResult.totalScore} poin</strong>
								</p>
							</div>

							<div className="space-y-2 pt-2">
								<p className="text-xs font-semibold text-muted-foreground">
									Pilih langkah berikutnya:
								</p>
								<button
									type="button"
									onClick={() => {
										handleClose();
										navigate({ to: "/operator/history" as never });
									}}
									className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3 text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-surface-muted transition"
								>
									<span className="flex items-center gap-2">
										<History className="size-4 text-primary" />
										<span>Lihat di Riwayat &amp; Skenario</span>
									</span>
									<ArrowRight className="size-3.5 text-muted-foreground" />
								</button>

								<button
									type="button"
									onClick={() => {
										handleClose();
										navigate({ to: "/operator/history" as never });
									}}
									className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3 text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-surface-muted transition"
								>
									<span className="flex items-center gap-2">
										<GitCompare className="size-4 text-primary" />
										<span>Bandingkan dengan Aktual</span>
									</span>
									<ArrowRight className="size-3.5 text-muted-foreground" />
								</button>

								<button
									type="button"
									onClick={() => {
										handleClose();
										navigate({ to: "/operator/dashboard" as never });
									}}
									className="flex w-full items-center justify-between rounded-xl border border-border bg-surface p-3 text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-surface-muted transition"
								>
									<span className="flex items-center gap-2">
										<LayoutDashboard className="size-4 text-primary" />
										<span>Kembali ke Dashboard</span>
									</span>
									<ArrowRight className="size-3.5 text-muted-foreground" />
								</button>
							</div>
						</div>
					) : (
						<form onSubmit={handleSave} className="mt-4 space-y-4">
							<div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs leading-relaxed">
								<p className="font-bold text-foreground">
									Skenario what-if ini akan disimpan di{" "}
									<span className="text-primary">Skenario {selectedSlot}</span>
								</p>
								<p className="mt-0.5 text-[11px] text-muted-foreground">
									{indicatorName} · {periodLabel} · Maks. 3 slot (A, B, C). Memilih slot yang sudah terisi akan menimpa data lama di slot tersebut.
								</p>
							</div>
							{error && (
								<div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger font-semibold">
									<AlertCircle className="size-4 shrink-0" />
									<p>{error}</p>
								</div>
							)}

							{/* Slot Selector */}
							<div>
								<div className="flex items-center justify-between">
									<label className="block text-xs font-semibold text-foreground">
										Pilih Slot Tujuan Simpan (A, B, atau C) <span className="text-danger">*</span>
									</label>
									<span className="text-[10px] font-medium text-muted-foreground">
										Maks. 3 Skenario
									</span>
								</div>
								<div className="mt-1.5 grid grid-cols-3 gap-2">
									{(["A", "B", "C"] as const).map((slot) => {
										const isSelected = selectedSlot === slot;
										return (
											<button
												key={slot}
												type="button"
												onClick={() => {
													selectSlot(slot);
												}}
												className={twMerge(
													"flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition cursor-pointer",
													isSelected
														? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary"
														: "border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground",
												)}
											>
												<span
													className={twMerge(
														"flex size-6 items-center justify-center rounded-full text-xs font-extrabold",
														slot === "A" && "bg-blue-500/20 text-blue-600 dark:text-blue-400",
														slot === "B" && "bg-purple-500/20 text-purple-600 dark:text-purple-400",
														slot === "C" && "bg-amber-500/20 text-amber-600 dark:text-amber-400",
													)}
												>
													{slot}
												</span>
												<span className="mt-1 text-xs font-bold text-foreground">
													Skenario {slot}
												</span>
											</button>
										);
									})}
								</div>
							</div>

							<div>
								<label className="block text-xs font-semibold text-foreground">
									Nama Skenario <span className="text-danger">*</span>
								</label>
								<input
									type="text"
									required
									value={scenarioName}
									onChange={(e) => setScenarioName(e.target.value)}
									placeholder="Contoh: Skenario A: Tutup gap via Penyerapan Anggaran..."
									className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className="block text-xs font-semibold text-muted-foreground">
										Periode Evaluasi
									</label>
									<p className="mt-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground">
										{periodLabel}
									</p>
								</div>
								<div>
									<label className="block text-xs font-semibold text-muted-foreground">
										Target KPPN
									</label>
									<p className="mt-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground">
										{targetScore.toFixed(2)} Poin
									</p>
								</div>
							</div>

							{/* Summary of Overrides */}
							{overrideSummaries.length > 0 && (
								<div className="space-y-1.5">
									<label className="block text-xs font-semibold text-foreground">
										Ringkasan Asumsi yang Diubah ({overrideSummaries.length})
									</label>
									<div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-surface p-2.5 text-xs">
										{overrideSummaries.map((s, i) => (
											<div key={i} className="flex items-center justify-between text-[11px]">
												<span className="text-muted-foreground">{s.label}:</span>
												<span className="font-semibold text-foreground">
													{s.originalValue} → <strong className="text-primary">{s.newValue}</strong>
												</span>
											</div>
										))}
									</div>
								</div>
							)}

							<div>
								<label className="block text-xs font-semibold text-foreground">
									Catatan Tambahan (Opsional)
								</label>
								<textarea
									rows={2}
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									placeholder="Tuliskan catatan pertimbangan skenario ini..."
									className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
								/>
							</div>

							<div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
								<button
									type="button"
									onClick={handleClose}
									className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
								>
									Batal
								</button>
								<button
									type="submit"
									disabled={isSubmitting || !hasChanges}
									className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isSubmitting ? "Menyimpan..." : "Simpan Skenario"}
								</button>
							</div>
						</form>
					)}
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
