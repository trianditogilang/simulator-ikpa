import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { mockSatkerSettings, type SatkerSettingsData } from "@/mocks/settings";

export const Route = createFileRoute("/operator/settings")({
	component: OperatorSettingsPage,
});

function OperatorSettingsPage() {
	const [settings, setSettings] =
		useState<SatkerSettingsData>(mockSatkerSettings);
	const [target, setTarget] = useState(settings.targetIkpa);
	const [isBlu, setIsBlu] = useState(settings.isBlu);

	return (
		<OperatorShell currentPath="/operator/settings">
			<div className="mx-auto max-w-4xl space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Pengaturan Satuan Kerja
						</h1>
						<p className="text-xs text-muted-foreground">
							Informasi profil Satker, KPPN pembina, target kinerja internal,
							dan daftar operator terdaftar.
						</p>
					</div>
				</div>

				{/* Organization Profile Card */}
				<div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xs">
					<h2 className="text-sm font-bold text-foreground sm:text-base">
						Profil Satuan Kerja & KPPN
					</h2>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="rounded-xl border border-border/80 bg-surface p-4 text-xs">
							<span className="text-[11px] text-muted-foreground">
								Nama Satker:
							</span>
							<p className="mt-1 font-bold text-foreground">
								{settings.satkerName}
							</p>
							<p className="text-[11px] text-muted-foreground">
								Kode Satker: {settings.satkerCode}
							</p>
						</div>

						<div className="rounded-xl border border-border/80 bg-surface p-4 text-xs">
							<span className="text-[11px] text-muted-foreground">
								KPPN Pembina:
							</span>
							<p className="mt-1 font-bold text-foreground">
								{settings.kppnName}
							</p>
							<p className="text-[11px] text-muted-foreground">
								Kode KPPN: {settings.kppnCode}
							</p>
						</div>
					</div>
				</div>

				{/* Simulation Configuration Card */}
				<div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xs">
					<h2 className="text-sm font-bold text-foreground sm:text-base">
						Parameter Default Simulasi
					</h2>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div>
							<label
								htmlFor="settingTarget"
								className="block text-xs font-semibold text-foreground"
							>
								Target Nilai IKPA
							</label>
							<input
								id="settingTarget"
								type="number"
								step="0.1"
								value={target}
								onChange={(e) =>
									setTarget(Number.parseFloat(e.target.value) || 0)
								}
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>

						<div>
							<span className="block text-xs font-semibold text-foreground">
								Status Satker BLU
							</span>
							<label className="mt-2 flex items-center gap-2 text-xs font-medium text-foreground">
								<input
									type="checkbox"
									checked={isBlu}
									onChange={(e) => setIsBlu(e.target.checked)}
									className="size-4 rounded border-border text-primary focus:ring-primary"
								/>
								<span>Badan Layanan Umum (BLU)</span>
							</label>
						</div>

						<div>
							<span className="block text-xs font-semibold text-foreground">
								Rule Set Aktif
							</span>
							<p className="mt-2 text-xs font-bold text-primary">
								{settings.activeRuleSet}
							</p>
						</div>
					</div>

					<div className="flex justify-end pt-2">
						<button
							type="button"
							onClick={() => {
								setSettings((prev) => ({ ...prev, targetIkpa: target, isBlu }));
								alert("Pengaturan Satker berhasil disimpan.");
							}}
							className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover"
						>
							Simpan Perubahan
						</button>
					</div>
				</div>

				{/* Operators List Card */}
				<div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xs">
					<h2 className="text-sm font-bold text-foreground sm:text-base">
						Daftar Pengguna / Operator Satker
					</h2>

					<div className="divide-y divide-border/80 rounded-xl border border-border/80 bg-surface/50 text-xs">
						{settings.operators.map((op) => (
							<div
								key={op.email}
								className="flex items-center justify-between p-3.5"
							>
								<div>
									<span className="font-semibold text-foreground">
										{op.name}
									</span>
									<p className="text-[11px] text-muted-foreground">
										{op.email}
									</p>
								</div>
								<span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
									{op.role}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</OperatorShell>
	);
}
