import { Link } from "@tanstack/react-router";
import {
	Building2,
	CheckCircle2,
	LoaderCircle,
	LogOut,
	MessageCircle,
	ShieldAlert,
} from "lucide-react";
import { type ComponentProps, type FormEvent, useState } from "react";
import { twMerge } from "tailwind-merge";
import { SignOutAction } from "@/components/auth/sign-out-action";
import { registerSatkerOnboarding } from "@/services/settings-service";

const defaultContactHref =
	"https://wa.me/6281234567890?text=Halo%20Admin%20KPPN%2C%20saya%20ingin%20meminta%20akses%20Simulator%20IKPA";

export type AccessPendingProps = Omit<ComponentProps<"section">, "children"> & {
	email?: string;
	contactHref?: string;
};

export function maskEmail(email: string) {
	const [localPart, domain] = email.trim().split("@");

	if (!localPart || !domain) {
		return "Identitas terverifikasi";
	}

	const visibleCharacter = localPart.slice(0, 1);
	const maskedLength = Math.max(3, Math.min(5, localPart.length));

	return `${visibleCharacter}${"•".repeat(maskedLength)}@${domain}`;
}

export function AccessPending({
	email,
	contactHref = defaultContactHref,
	className,
	...props
}: AccessPendingProps) {
	const maskedEmail = email ? maskEmail(email) : "Identitas terverifikasi";
	const [activeTab, setActiveTab] = useState<"register" | "info">("register");

	// Form states
	const [kodeSatker, setKodeSatker] = useState("");
	const [namaSatker, setNamaSatker] = useState("");
	const [isBlu, setIsBlu] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const handleRegister = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);

		const cleanKode = kodeSatker.trim();
		const cleanNama = namaSatker.trim();

		if (cleanKode.length < 4) {
			setError("Kode Satker minimal 4 karakter (contoh: 411782).");
			return;
		}

		if (cleanNama.length < 3) {
			setError("Nama Satker minimal 3 karakter.");
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await registerSatkerOnboarding({
				kodeSatker: cleanKode,
				name: cleanNama,
				isBlu,
			});

			if (res.success) {
				setSuccess(true);
				setTimeout(() => {
					window.location.assign("/operator/dashboard");
				}, 600);
			}
		} catch (err: unknown) {
			const msg =
				err instanceof Error
					? err.message
					: "Gagal mendaftarkan Satker. Silakan coba lagi.";
			setError(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section
			{...props}
			aria-labelledby="access-pending-heading"
			className={twMerge("w-full max-w-lg self-center", className)}
			data-slot="access-pending"
		>
			<div className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8 space-y-6">
				{/* Top Header */}
				<div className="text-center">
					<div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
						<Building2 aria-hidden="true" className="size-6" />
					</div>
					<p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
						Onboarding Satuan Kerja
					</p>
					<h1
						className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
						id="access-pending-heading"
					>
						{activeTab === "register"
							? "Daftarkan Satuan Kerja"
							: "Akses Belum Diberikan"}
					</h1>
					<p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
						{activeTab === "register"
							? "Lengkapi identitas satuan kerja Anda untuk langsung memulai simulasi IKPA sebagai Operator Satker."
							: "Email Anda belum dipetakan ke lingkup Satker atau KPPN manapun."}
					</p>
				</div>

				{/* Tab Selector */}
				<div className="flex rounded-xl border border-border bg-surface p-1 text-xs font-semibold">
					<button
						type="button"
						onClick={() => setActiveTab("register")}
						className={`flex-1 rounded-lg py-2 transition ${
							activeTab === "register"
								? "bg-background text-primary shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Daftarkan Satker Mandiri
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("info")}
						className={`flex-1 rounded-lg py-2 transition ${
							activeTab === "info"
								? "bg-background text-primary shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Informasi &amp; Kontak Admin
					</button>
				</div>

				{/* Account identity badge */}
				<div className="flex items-center justify-between rounded-xl border border-border bg-surface/60 p-3.5 text-xs">
					<div>
						<span className="text-[11px] font-medium text-muted-foreground">
							Akun Terverifikasi:
						</span>
						<p className="font-semibold text-foreground break-all">
							{email || maskedEmail}
						</p>
					</div>
					<span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
						Operator Baru
					</span>
				</div>

				{/* TAB 1: REGISTER SATKER */}
				{activeTab === "register" && (
					<form onSubmit={handleRegister} className="space-y-4">
						{error && (
							<div
								role="alert"
								className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger"
							>
								<ShieldAlert className="mt-0.5 size-4 shrink-0" />
								<p>{error}</p>
							</div>
						)}

						{success && (
							<output className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
								<CheckCircle2 className="size-4 shrink-0" />
								<p className="font-semibold">
									Satker berhasil didaftarkan! Mengalihkan ke dashboard...
								</p>
							</output>
						)}

						<div className="space-y-1.5">
							<label
								htmlFor="onboarding-kode"
								className="block text-xs font-semibold text-foreground"
							>
								Kode Satker (6 Digit)
							</label>
							<input
								id="onboarding-kode"
								type="text"
								required
								maxLength={12}
								placeholder="Contoh: 411782"
								value={kodeSatker}
								onChange={(e) => setKodeSatker(e.target.value)}
								disabled={isSubmitting || success}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
							/>
							<p className="text-[11px] text-muted-foreground">
								Masukkan kode satuan kerja 6 digit resmi dari DIPA.
							</p>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="onboarding-nama"
								className="block text-xs font-semibold text-foreground"
							>
								Nama Satuan Kerja
							</label>
							<input
								id="onboarding-nama"
								type="text"
								required
								maxLength={200}
								placeholder="Contoh: Kantor Pelayanan Perbendaharaan Satker Contoh"
								value={namaSatker}
								onChange={(e) => setNamaSatker(e.target.value)}
								disabled={isSubmitting || success}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="rounded-lg border border-border/80 bg-surface/50 p-3 space-y-2">
							<label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
								<input
									type="checkbox"
									checked={isBlu}
									onChange={(e) => setIsBlu(e.target.checked)}
									disabled={isSubmitting || success}
									className="size-4 rounded border-border text-primary focus:ring-primary"
								/>
								<span>Satuan Kerja Badan Layanan Umum (BLU)</span>
							</label>
							<p className="text-[11px] text-muted-foreground pl-6">
								Centang jika satker Anda berstatus BLU untuk penyesuaian target
								penyerapan anggaran.
							</p>
						</div>

						<button
							type="submit"
							disabled={isSubmitting || success}
							className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
						>
							{isSubmitting ? (
								<>
									<LoaderCircle className="size-4 animate-spin" />
									<span>Mendaftarkan Satker...</span>
								</>
							) : (
								<span>Daftarkan &amp; Buka Dashboard</span>
							)}
						</button>
					</form>
				)}

				{/* TAB 2: INFO & CONTACT */}
				{activeTab === "info" && (
					<div className="space-y-4">
						<div className="rounded-xl border border-warning/30 bg-warning-surface p-4">
							<div className="flex items-start gap-2.5">
								<ShieldAlert
									aria-hidden="true"
									className="mt-0.5 size-5 shrink-0 text-warning"
								/>
								<div>
									<h2 className="text-sm font-semibold text-foreground">
										Petunjuk Akses Melalui Admin KPPN
									</h2>
									<ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
										<li>
											Hubungi Admin KPPN yang menangani satuan kerja Anda jika
											satker Anda sudah didaftarkan sebelumnya.
										</li>
										<li>
											Sampaikan email kedinasan yang digunakan untuk login.
										</li>
										<li>Ulangi login setelah mapping akses diaktifkan.</li>
									</ol>
								</div>
							</div>
						</div>

						<a
							className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							href={contactHref}
							rel="noopener noreferrer"
							target="_blank"
						>
							<MessageCircle aria-hidden="true" className="size-4" />
							<span>Hubungi Admin KPPN via WhatsApp</span>
						</a>
					</div>
				)}

				{/* Bottom Actions */}
				<div className="border-t border-border pt-4 flex items-center justify-between gap-3 text-xs">
					<Link className="text-primary hover:underline" to="/">
						Kembali ke Beranda
					</Link>

					<SignOutAction className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
						<LogOut className="size-3.5" />
						<span>Keluar dari Sesi</span>
					</SignOutAction>
				</div>
			</div>
		</section>
	);
}
