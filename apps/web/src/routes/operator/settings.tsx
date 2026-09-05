import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	Building2,
	CheckCircle2,
	LoaderCircle,
	Save,
	ShieldCheck,
	UserCheck,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import { OperatorShell } from "@/components/layout/operator-shell";
import {
	fetchSatkerSettings,
	updateSatkerSettings,
} from "@/services/settings-service";

export const Route = createFileRoute("/operator/settings")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchSatkerSettings(activeOrgId);
	},
	component: OperatorSettingsPage,
});

function OperatorSettingsPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();

	const [satkerName, setSatkerName] = useState(initialData.satkerName);
	const [target, setTarget] = useState(initialData.targetIkpa);
	const [isBlu, setIsBlu] = useState(initialData.isBlu);

	const [isSaving, setIsSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const handleSave = async (e: FormEvent) => {
		e.preventDefault();
		setSaveMessage(null);
		setErrorMessage(null);

		const cleanName = satkerName.trim();
		if (cleanName.length < 3) {
			setErrorMessage("Nama Satuan Kerja minimal 3 karakter.");
			return;
		}

		setIsSaving(true);
		try {
			await updateSatkerSettings({
				orgId: initialData.satkerId,
				name: cleanName,
				isBlu,
			});

			setSaveMessage("Pengaturan Satker berhasil diperbarui di database.");
			await router.invalidate();
			setTimeout(() => setSaveMessage(null), 4000);
		} catch (err: unknown) {
			const msg =
				err instanceof Error
					? err.message
					: "Gagal menyimpan pengaturan. Silakan coba lagi.";
			setErrorMessage(msg);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<OperatorShell currentPath="/operator/settings">
			<div className="mx-auto max-w-4xl space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Building2 className="size-5" />
						</div>
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

					<span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
						<ShieldCheck className="size-3.5" />
						<span>Kode: {initialData.satkerCode}</span>
					</span>
				</div>

				{/* Save status notification */}
				{saveMessage && (
					<output className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
						<CheckCircle2 className="size-4 shrink-0" />
						<p>{saveMessage}</p>
					</output>
				)}

				{errorMessage && (
					<div
						role="alert"
						className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs font-semibold text-danger shadow-xs"
					>
						<AlertCircle className="size-4 shrink-0" />
						<p>{errorMessage}</p>
					</div>
				)}

				{/* Organization Profile & Configuration Form */}
				<form onSubmit={handleSave} className="space-y-6">
					<div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xs">
						<h2 className="text-sm font-bold text-foreground sm:text-base">
							Profil Satuan Kerja &amp; KPPN Pembina
						</h2>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<label
									htmlFor="satker-name"
									className="block text-xs font-semibold text-foreground"
								>
									Nama Satuan Kerja
								</label>
								<input
									id="satker-name"
									type="text"
									required
									maxLength={200}
									value={satkerName}
									onChange={(e) => setSatkerName(e.target.value)}
									disabled={isSaving}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
								<p className="text-[11px] text-muted-foreground">
									Nama resmi instansi/satker sesuai DIPA.
								</p>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="satker-code"
									className="block text-xs font-semibold text-foreground"
								>
									Kode Satker (Kemenkeu)
								</label>
								<input
									id="satker-code"
									type="text"
									disabled
									value={initialData.satkerCode}
									className="min-h-10 w-full rounded-lg border border-border/80 bg-surface px-3 text-xs text-muted-foreground cursor-not-allowed"
								/>
								<p className="text-[11px] text-muted-foreground">
									Kode unik 6 digit terdaftar di SPAN/Sakti.
								</p>
							</div>

							<div className="rounded-xl border border-border/80 bg-surface p-4 text-xs">
								<span className="text-[11px] text-muted-foreground">
									KPPN Pembina:
								</span>
								<p className="mt-1 font-bold text-foreground">
									{initialData.kppnName}
								</p>
								<p className="text-[11px] text-muted-foreground">
									Kode KPPN: {initialData.kppnCode}
								</p>
							</div>

							<div className="rounded-xl border border-border/80 bg-surface p-4 text-xs">
								<span className="text-[11px] text-muted-foreground">
									Zona Waktu Baku:
								</span>
								<p className="mt-1 font-bold text-foreground">
									{initialData.timezone}
								</p>
								<p className="text-[11px] text-muted-foreground">
									Perhitungan deadline otomatis disinkronkan.
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
									Target Nilai IKPA (%)
								</label>
								<FormattedNumberInput
									id="settingTarget"
									allowDecimal
									value={target}
									onChange={(raw) =>
										setTarget(Number.parseFloat(raw) || 0)
									}
									disabled={isSaving}
									className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="flex flex-col justify-center">
								<span className="block text-xs font-semibold text-foreground">
									Status Satker BLU
								</span>
								<label className="mt-2.5 flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
									<input
										type="checkbox"
										checked={isBlu}
										onChange={(e) => setIsBlu(e.target.checked)}
										disabled={isSaving}
										className="size-4 rounded border-border text-primary focus:ring-primary"
									/>
									<span>Badan Layanan Umum (BLU)</span>
								</label>
							</div>

							<div className="flex flex-col justify-center">
								<span className="block text-xs font-semibold text-foreground">
									Rule Set Regulasi Aktif
								</span>
								<p className="mt-2 text-xs font-bold text-primary">
									{initialData.activeRuleSet}
								</p>
							</div>
						</div>

						<div className="flex justify-end pt-2">
							<button
								type="submit"
								disabled={isSaving}
								className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
							>
								{isSaving ? (
									<>
										<LoaderCircle className="size-4 animate-spin" />
										<span>Menyimpan...</span>
									</>
								) : (
									<>
										<Save className="size-4" />
										<span>Simpan Perubahan</span>
									</>
								)}
							</button>
						</div>
					</div>
				</form>

				{/* Operators List Card */}
				<div className="space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xs">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-sm font-bold text-foreground sm:text-base">
								Daftar Pengguna / Operator Satker
							</h2>
							<p className="text-xs text-muted-foreground">
								Pengguna terverifikasi yang memiliki hak akses input &amp;
								simulasi pada Satker ini.
							</p>
						</div>
						<span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted-foreground">
							{initialData.operators.length} Operator
						</span>
					</div>

					<div className="divide-y divide-border/80 rounded-xl border border-border/80 bg-surface/50 text-xs">
						{initialData.operators.map((op) => (
							<div
								key={op.email}
								className="flex items-center justify-between p-3.5"
							>
								<div className="flex items-center gap-3">
									<div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
										<UserCheck className="size-4" />
									</div>
									<div>
										<span className="font-semibold text-foreground">
											{op.name}
										</span>
										<p className="text-[11px] text-muted-foreground">
											{op.email}
										</p>
									</div>
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
