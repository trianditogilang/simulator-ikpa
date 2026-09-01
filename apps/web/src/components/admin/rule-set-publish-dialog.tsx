import {
	AlertTriangle,
	Lock,
	Scale,
	X,
} from "lucide-react";
import type { RuleSetItem } from "@/mocks/rule-sets";

interface RuleSetPublishDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirmPublish: () => void;
	ruleSet: RuleSetItem;
}

export function RuleSetPublishDialog({
	isOpen,
	onClose,
	onConfirmPublish,
	ruleSet,
}: RuleSetPublishDialogProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
			<div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
							<Scale className="size-5" />
						</div>
						<div>
							<h3 className="text-base font-semibold text-foreground">
								Publikasikan Rule Set {ruleSet.version}?
							</h3>
							<p className="text-xs text-muted-foreground">
								Efektif per {ruleSet.effectiveFrom}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
					>
						<X className="size-4" />
					</button>
				</div>

				<div className="space-y-3 rounded-lg border border-border/80 bg-surface p-4 text-xs">
					<div className="space-y-2">
						<h4 className="font-semibold text-foreground">
							Konsekuensi Publikasi Regulasi:
						</h4>
						<ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
							<li>
								Rule Set ini akan menjadi <strong className="text-foreground">acuan resmi</strong> perhitungan IKPA seluruh satker untuk periode efektif.
							</li>
							<li>
								Seluruh jadwal reminder yang belum terkirim (<strong className="text-foreground">120 agenda</strong>) akan otomatis dievaluasi ulang berdasarkan parameter baru.
							</li>
							<li>
								<strong className="text-foreground">Snapshot historis tidak akan berubah</strong> guna menjamin integritas audit data masa lalu.
							</li>
						</ul>
					</div>

					<div className="border-t border-border/60 pt-3">
						<span className="font-semibold text-foreground">Ringkasan Perubahan:</span>
						<p className="mt-1 text-foreground/90">{ruleSet.changeSummary}</p>
					</div>

					{ruleSet.validationStatus.unverifiedParamsCount > 0 && (
						<div className="flex items-start gap-2 rounded-md bg-warning/10 p-2.5 text-xs text-warning">
							<AlertTriangle className="size-4 shrink-0 mt-0.5" />
							<div>
								<span className="font-semibold">Catatan Verifikasi Regulasi:</span>
								<p className="text-foreground">
									{ruleSet.validationStatus.warnings[0] ||
										"Pastikan dasar hukum addendum telah terbit secara resmi."}
								</p>
							</div>
						</div>
					)}
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-border pt-3">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
					>
						Batal
					</button>
					<button
						type="button"
						onClick={onConfirmPublish}
						className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
					>
						<Lock className="size-3.5" />
						<span>Konfirmasi &amp; Publikasikan</span>
					</button>
				</div>
			</div>
		</div>
	);
}
